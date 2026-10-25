-- ==============================================================================
-- AgriLink Supabase Logistics Table, Security, Atomic RPCs & Realtime Setup
-- ==============================================================================
-- Migration File : supabase_logistics_schema.sql
-- Architecture   : 1.0
-- Run this script in your Supabase Dashboard:
--   SQL Editor → New query → Paste → Run
--
-- SAFETY NOTICE:
--   - Does NOT alter public.orders, public.profiles, public.produce,
--     or public.buyer_requests.
--   - The existing Orders table, RLS policies, security trigger
--     (trg_enforce_order_update_security), and atomic RPC
--     (accept_buyer_request_and_create_order) are completely untouched.
--   - The Delivered → Completed buyer confirmation flow is untouched.
--   - No service-role key is used or required anywhere in this script.
--   - All elevated operations use SECURITY DEFINER with strict validation.
-- ==============================================================================


-- ==============================================================================
-- SECTION 1: CREATE TABLE public.logistics_requests
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.logistics_requests (

  -- ── Primary Identifier ────────────────────────────────────────────────────
  -- Real UUID primary key — replaces all fake LOG-XXXX local IDs
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-readable display reference (mirrors 'ORD-XXXXXXXX' from orders)
  logistics_number TEXT GENERATED ALWAYS AS (
    'LOG-' || SUBSTRING(id::TEXT, 1, 8)
  ) STORED,

  -- ── Core Relationship ─────────────────────────────────────────────────────
  -- Foreign key to real Supabase orders.
  -- ON DELETE RESTRICT: an order with a logistics record cannot be deleted.
  -- This guarantees logistics_requests.order_id always references a real order.
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,

  -- Denormalized buyer and farmer UUIDs for RLS efficiency.
  -- These MUST match the referenced order and are validated atomically
  -- by create_logistics_request RPC — they are never accepted from caller input.
  -- After creation these fields are IMMUTABLE (enforced by trigger below).
  buyer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ── Logistics-Specific Fields ─────────────────────────────────────────────
  -- These do NOT duplicate commercial order data (quantity, price, total,
  -- delivery_location, produce details). Those values are read from orders
  -- via JOIN at query time.
  pickup_location  TEXT NOT NULL,   -- Region/state of pickup (e.g. 'Kano, Nigeria')
  pickup_address   TEXT,            -- Specific farm hub / aggregation centre address
  delivery_address TEXT,            -- Buyer's specific warehouse / delivery address
  preferred_date   DATE,            -- Buyer's requested pickup date
  instructions     TEXT,            -- Special handling notes (fragile, tarpaulin, etc.)

  -- ── Provider & Driver Assignment (Admin-managed only) ────────────────────
  -- These fields are NEVER set by the buyer at creation time.
  -- Only update_logistics_status RPC (admin-only) can write to them.
  provider     TEXT,
  driver       TEXT,
  driver_phone TEXT,

  -- ── Status Lifecycle ─────────────────────────────────────────────────────
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (
    status IN (
      'Requested',  -- Buyer submitted; awaiting admin assignment
      'Assigned',   -- Admin has assigned a provider and driver
      'Picked Up',  -- Driver has collected produce from farm
      'In Transit', -- Shipment is en route to buyer destination
      'Delivered',  -- Produce delivered to buyer (terminal for logistics)
      'Cancelled'   -- Request cancelled; record preserved for audit history
    )
  ),

  -- ── Timestamps ──────────────────────────────────────────────────────────
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- ==============================================================================
-- SECTION 2: INDEXES
-- ==============================================================================

-- ── PARTIAL UNIQUE INDEX (Safeguards 1 & 2) ──────────────────────────────────
-- Enforces: only ONE active (non-Cancelled) logistics request per order.
-- Cancelled records remain in the database for audit history.
-- After cancellation, a NEW logistics request CAN be created for the same order.
-- A plain UNIQUE(order_id) would block re-requesting after cancellation — too strict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_active_order
  ON public.logistics_requests(order_id)
  WHERE status != 'Cancelled';

-- Standard performance indexes
CREATE INDEX IF NOT EXISTS idx_logistics_buyer_id
  ON public.logistics_requests(buyer_id);

CREATE INDEX IF NOT EXISTS idx_logistics_farmer_id
  ON public.logistics_requests(farmer_id);

CREATE INDEX IF NOT EXISTS idx_logistics_order_id
  ON public.logistics_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_logistics_status
  ON public.logistics_requests(status);

CREATE INDEX IF NOT EXISTS idx_logistics_created_at
  ON public.logistics_requests(created_at DESC);


-- ==============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) (Safeguards 8 & 9)
-- ==============================================================================

ALTER TABLE public.logistics_requests ENABLE ROW LEVEL SECURITY;

-- Anonymous users: ZERO access
REVOKE ALL ON public.logistics_requests FROM anon;

-- Direct INSERT is REVOKED from ALL authenticated users.
-- The ONLY path to create a logistics record is the SECURITY DEFINER RPC
-- create_logistics_request() below. No direct client INSERT is possible.
REVOKE INSERT ON public.logistics_requests FROM authenticated;

-- Grant SELECT, UPDATE, DELETE to authenticated users (governed by RLS below)
GRANT SELECT, UPDATE, DELETE ON public.logistics_requests TO authenticated;

-- Remove any pre-existing policies before creating clean ones
DROP POLICY IF EXISTS "Logistics select policy" ON public.logistics_requests;
DROP POLICY IF EXISTS "Logistics update policy" ON public.logistics_requests;
DROP POLICY IF EXISTS "Logistics delete policy" ON public.logistics_requests;

-- ── Policy A: SELECT ──────────────────────────────────────────────────────────
-- Buyer: sees ONLY their own logistics requests (buyer_id = their UUID)
-- Farmer: sees ONLY logistics related to their own farm orders (farmer_id = their UUID)
-- Admin: sees ALL logistics requests platform-wide
-- Anonymous / other roles: BLOCKED
CREATE POLICY "Logistics select policy"
  ON public.logistics_requests
  FOR SELECT
  TO authenticated
  USING (
    buyer_id  = auth.uid()
    OR
    farmer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Policy B: UPDATE ──────────────────────────────────────────────────────────
-- ONLY platform admins may directly UPDATE logistics records.
-- Buyers and Farmers are BLOCKED from any direct UPDATE.
-- All legitimate status changes must go through update_logistics_status RPC.
CREATE POLICY "Logistics update policy"
  ON public.logistics_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Policy C: DELETE ──────────────────────────────────────────────────────────
-- ONLY platform admins may delete logistics records.
-- Buyers and Farmers cannot delete.
CREATE POLICY "Logistics delete policy"
  ON public.logistics_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );


-- ==============================================================================
-- SECTION 4: FIELD IMMUTABILITY & STATUS TRANSITION TRIGGER (Safeguard 4)
-- ==============================================================================
-- Prevents modification of identity/relationship fields after creation.
-- Enforces forward-only, valid status transitions.
-- Provides a second layer of defence beyond RLS (defence in depth).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_logistics_update_security()
RETURNS TRIGGER AS $$
DECLARE
  caller_id UUID := auth.uid();
  user_role TEXT;
BEGIN
  -- Retrieve caller platform role
  SELECT role INTO user_role FROM public.profiles WHERE id = caller_id;

  -- ── Identity / Relationship Immutability (Safeguard 4) ─────────────────────
  -- These fields CANNOT be changed after creation by ANY role, including admin.
  IF NEW.id        IS DISTINCT FROM OLD.id        OR
     NEW.order_id  IS DISTINCT FROM OLD.order_id  OR
     NEW.buyer_id  IS DISTINCT FROM OLD.buyer_id  OR
     NEW.farmer_id IS DISTINCT FROM OLD.farmer_id OR
     NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION
      'Logistics identity fields are immutable after creation. '
      'Fields id, order_id, buyer_id, farmer_id, and created_at cannot be modified.';
  END IF;

  -- ── Terminal Status Protection ─────────────────────────────────────────────
  -- Delivered and Cancelled are terminal — no further changes allowed.
  IF OLD.status = 'Delivered' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Delivered logistics requests are terminal and cannot be further modified.';
  END IF;

  IF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Cancelled logistics requests are terminal and cannot be reopened or modified.';
  END IF;

  -- ── Forward-Only Status Transition Enforcement ─────────────────────────────
  -- Prevents skipping statuses or reversing the lifecycle.
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    IF OLD.status = 'Requested' AND NEW.status NOT IN ('Assigned', 'Cancelled') THEN
      RAISE EXCEPTION
        'Requested logistics can only advance to Assigned or Cancelled. Attempted: %',
        NEW.status;

    ELSIF OLD.status = 'Assigned' AND NEW.status NOT IN ('Picked Up', 'Cancelled') THEN
      RAISE EXCEPTION
        'Assigned logistics can only advance to Picked Up or Cancelled. Attempted: %',
        NEW.status;

    ELSIF OLD.status = 'Picked Up' AND NEW.status NOT IN ('In Transit') THEN
      RAISE EXCEPTION
        'Picked Up logistics can only advance to In Transit. Attempted: %',
        NEW.status;

    ELSIF OLD.status = 'In Transit' AND NEW.status NOT IN ('Delivered') THEN
      RAISE EXCEPTION
        'In Transit logistics can only advance to Delivered. Attempted: %',
        NEW.status;

    END IF;
  END IF;

  -- Always maintain updated_at
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_logistics_update_security
  ON public.logistics_requests;

CREATE TRIGGER trg_enforce_logistics_update_security
  BEFORE UPDATE ON public.logistics_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_logistics_update_security();


-- ==============================================================================
-- SECTION 5: RPC — create_logistics_request (Safeguards 1, 2, 3, 8, 9)
-- ==============================================================================
-- Atomic SECURITY DEFINER function. The SOLE path for buyer-initiated creation.
--
-- In a single atomic transaction this function:
--   1. Rejects unauthenticated callers
--   2. Validates caller is a registered buyer
--   3. Locks and retrieves the referenced order row (FOR UPDATE)
--   4. Validates order.buyer_id = auth.uid()       (IDOR prevention)
--   5. Validates order is not in a terminal status
--   6. Validates no active logistics exists for this order (explicit check +
--      partial unique index provides second enforcement layer)
--   7. Inserts exactly one logistics_requests row
--      — buyer_id and farmer_id are taken from the LOCKED order row,
--        NEVER from caller-supplied parameters (Safeguard 3)
--   8. Returns the new row
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_logistics_request(
  p_order_id         UUID,
  p_pickup_location  TEXT,
  p_pickup_address   TEXT DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_preferred_date   DATE DEFAULT NULL,
  p_instructions     TEXT DEFAULT NULL
)
RETURNS public.logistics_requests AS $$
DECLARE
  caller_id  UUID;
  user_role  TEXT;
  v_order    public.orders%ROWTYPE;
  v_new_row  public.logistics_requests%ROWTYPE;
BEGIN
  -- 1. Authenticate caller (Safeguard 8)
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION
      'Authentication required: You must be logged in to request logistics.';
  END IF;

  -- 2. Verify caller is a registered buyer
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = caller_id;

  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF user_role != 'buyer' THEN
    RAISE EXCEPTION
      'Only registered buyers can create logistics requests.';
  END IF;

  -- 3. Retrieve and lock the order row (Safeguard 3)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Order not found. Logistics can only be requested for a real, confirmed Supabase order.';
  END IF;

  -- 4. IDOR prevention: caller must be the buyer for this specific order (Safeguard 3)
  IF v_order.buyer_id != caller_id THEN
    RAISE EXCEPTION
      'You are not authorised to request logistics for this order.';
  END IF;

  -- 5. Block logistics for terminal-status orders
  IF v_order.status = 'Cancelled' THEN
    RAISE EXCEPTION
      'Logistics cannot be requested for a Cancelled order.';
  END IF;

  IF v_order.status = 'Completed' THEN
    RAISE EXCEPTION
      'Logistics cannot be requested for a Completed order.';
  END IF;

  -- 6. One active logistics per order enforcement (Safeguards 1 & 2)
  --    Explicit check for a clean error message before the DB unique index fires.
  IF EXISTS (
    SELECT 1 FROM public.logistics_requests
    WHERE order_id = p_order_id
      AND status   != 'Cancelled'
  ) THEN
    RAISE EXCEPTION
      'An active logistics request already exists for this order. '
      'Cancel the existing request before submitting a new one.';
  END IF;

  -- 7. Insert the logistics record.
  --    buyer_id and farmer_id are sourced from the LOCKED order row — never
  --    from caller input. This is the core of Safeguard 3.
  INSERT INTO public.logistics_requests (
    order_id,
    buyer_id,
    farmer_id,
    pickup_location,
    pickup_address,
    delivery_address,
    preferred_date,
    instructions,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_order.id,
    v_order.buyer_id,    -- taken from the locked order row, not from caller
    v_order.farmer_id,   -- taken from the locked order row, not from caller
    p_pickup_location,
    p_pickup_address,
    p_delivery_address,
    p_preferred_date,
    p_instructions,
    'Requested',
    NOW(),
    NOW()
  )
  RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public and anonymous (Safeguard 8)
REVOKE ALL ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT)
  FROM anon;

-- Grant execution to authenticated users (function self-verifies buyer role)
GRANT EXECUTE ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT)
  TO authenticated;


-- ==============================================================================
-- SECTION 6: RPC — update_logistics_status (Safeguards 4, 5, 6, 7, 9)
-- ==============================================================================
-- Atomic SECURITY DEFINER function. The SOLE path for admin status management.
--
-- In a single atomic transaction this function:
--   1. Rejects unauthenticated callers
--   2. Validates caller is a platform admin (Safeguard 9 — no service-role key)
--   3. Validates the target logistics record exists
--   4. Validates the status transition is forward-only and valid
--   5. Updates logistics_requests (status, provider, driver, driver_phone)
--   6. Conditionally updates orders.status — SAME TRANSACTION (Safeguard 5):
--        Logistics → 'In Transit'  AND  order.status = 'Ready for Delivery'
--          → order becomes 'In Transit'
--        Logistics → 'Delivered'   AND  order.status = 'In Transit'
--          → order becomes 'Delivered'
--   7. NEVER sets order.status = 'Completed' (Safeguards 6 & 7)
--      The Delivered → Completed buyer confirmation flow remains exclusively
--      in the existing confirmDelivery() → orderService.confirmOrderDelivered()
--      → trg_enforce_order_update_security pathway. This RPC does not touch it.
--   8. Returns the updated logistics_requests row
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_logistics_status(
  p_logistics_id UUID,
  p_status       TEXT,
  p_provider     TEXT DEFAULT NULL,
  p_driver       TEXT DEFAULT NULL,
  p_driver_phone TEXT DEFAULT NULL
)
RETURNS public.logistics_requests AS $$
DECLARE
  caller_id      UUID;
  user_role      TEXT;
  v_logistics    public.logistics_requests%ROWTYPE;
  v_order_status TEXT;
  v_updated_row  public.logistics_requests%ROWTYPE;
BEGIN
  -- 1. Authenticate caller (Safeguard 8)
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Validate caller is admin (Safeguard 9 — role from DB profile, not JWT claim)
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = caller_id;

  IF user_role IS NULL OR user_role != 'admin' THEN
    RAISE EXCEPTION
      'Only platform administrators can update logistics status.';
  END IF;

  -- 3. Validate the incoming status value is a known logistics status
  IF p_status NOT IN (
    'Requested', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled'
  ) THEN
    RAISE EXCEPTION
      'Invalid logistics status: %. '
      'Allowed values: Requested, Assigned, Picked Up, In Transit, Delivered, Cancelled.',
      p_status;
  END IF;

  -- 4. Retrieve and lock the logistics record
  SELECT * INTO v_logistics
  FROM public.logistics_requests
  WHERE id = p_logistics_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Logistics request % not found.', p_logistics_id;
  END IF;

  -- 5. Terminal status protection
  IF v_logistics.status = 'Delivered' THEN
    RAISE EXCEPTION
      'Delivered logistics requests are terminal and cannot be further modified.';
  END IF;

  IF v_logistics.status = 'Cancelled' THEN
    RAISE EXCEPTION
      'Cancelled logistics requests are terminal and cannot be reopened.';
  END IF;

  -- 6. Forward-only transition validation (mirrors the trigger check)
  IF v_logistics.status = 'Requested'
     AND p_status NOT IN ('Assigned', 'Cancelled') THEN
    RAISE EXCEPTION
      'Requested logistics can only advance to Assigned or Cancelled. Attempted: %', p_status;
  ELSIF v_logistics.status = 'Assigned'
     AND p_status NOT IN ('Picked Up', 'Cancelled') THEN
    RAISE EXCEPTION
      'Assigned logistics can only advance to Picked Up or Cancelled. Attempted: %', p_status;
  ELSIF v_logistics.status = 'Picked Up'
     AND p_status NOT IN ('In Transit') THEN
    RAISE EXCEPTION
      'Picked Up logistics can only advance to In Transit. Attempted: %', p_status;
  ELSIF v_logistics.status = 'In Transit'
     AND p_status NOT IN ('Delivered') THEN
    RAISE EXCEPTION
      'In Transit logistics can only advance to Delivered. Attempted: %', p_status;
  END IF;

  -- 7. Update the logistics record (Safeguard 4 — trigger will also re-validate)
  UPDATE public.logistics_requests
  SET
    status       = p_status,
    provider     = COALESCE(p_provider,     provider),
    driver       = COALESCE(p_driver,       driver),
    driver_phone = COALESCE(p_driver_phone, driver_phone),
    updated_at   = NOW()
  WHERE id = p_logistics_id
  RETURNING * INTO v_updated_row;

  -- 8. Conditional Order synchronisation — SAME TRANSACTION (Safeguard 5)
  --    Reads the current order status AFTER locking logistics to avoid stale data.
  --    auth.uid() = admin UUID throughout this SECURITY DEFINER function.
  --    The existing trg_enforce_order_update_security on orders sees role='admin'
  --    and returns NEW immediately — no conflict with the existing trigger.
  --
  --    CRITICAL (Safeguards 6 & 7):
  --    This block NEVER sets order.status = 'Completed'.
  --    The Delivered → Completed transition remains exclusively with the buyer
  --    via confirmDelivery() → orderService.confirmOrderDelivered().

  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = v_logistics.order_id;

  -- Logistics In Transit → Order In Transit
  -- Guard: only advances order if it is currently 'Ready for Delivery'
  IF p_status = 'In Transit' AND v_order_status = 'Ready for Delivery' THEN
    UPDATE public.orders
    SET
      status     = 'In Transit',
      updated_at = NOW()
    WHERE id = v_logistics.order_id;

  -- Logistics Delivered → Order Delivered
  -- Guard: only advances order if it is currently 'In Transit'
  -- Sets order to 'Delivered' ONLY — NEVER 'Completed'
  ELSIF p_status = 'Delivered' AND v_order_status = 'In Transit' THEN
    UPDATE public.orders
    SET
      status     = 'Delivered',
      updated_at = NOW()
    WHERE id = v_logistics.order_id;

  -- All other logistics transitions (Requested, Assigned, Picked Up, Cancelled)
  -- make ZERO changes to the orders table.
  END IF;

  RETURN v_updated_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public and anonymous (Safeguard 8)
REVOKE ALL ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM anon;

-- Grant execution to authenticated (function self-verifies admin role)
GRANT EXECUTE ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;


-- ==============================================================================
-- SECTION 7: SUPABASE REALTIME CONFIGURATION
-- ==============================================================================

-- REPLICA IDENTITY FULL required so UPDATE and DELETE Realtime events
-- broadcast the complete previous AND new row data to all subscribers.
ALTER TABLE public.logistics_requests REPLICA IDENTITY FULL;

-- Idempotent: add logistics_requests to the supabase_realtime publication
-- only if it is not already a member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'logistics_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_requests;
  END IF;
END $$;

-- Tell PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- SECTION 8: VERIFICATION QUERIES
-- Run these individually in the SQL Editor AFTER the migration to confirm setup.
-- ==============================================================================
/*

-- V1. Table existence
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'logistics_requests';

-- V2. All columns, data types, generated columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'logistics_requests'
ORDER BY ordinal_position;

-- V3. CHECK constraint on status
SELECT
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
     AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'logistics_requests';

-- V4. Foreign key constraints
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name  AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
     AND tc.constraint_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'logistics_requests'
  AND tc.constraint_type = 'FOREIGN KEY';

-- V5. All indexes (must include partial unique index uq_logistics_active_order)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'logistics_requests'
ORDER BY indexname;

-- V6. RLS enabled
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.logistics_requests'::regclass;

-- V7. RLS policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'logistics_requests'
ORDER BY policyname;

-- V8. Triggers on logistics_requests
SELECT
  t.tgname    AS trigger_name,
  t.tgenabled AS enabled,
  p.proname   AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid   = 'public.logistics_requests'::regclass
  AND t.tgisinternal = FALSE;

-- V9. RPC functions — existence and security settings
SELECT
  p.proname                                         AS function_name,
  p.prosecdef                                       AS security_definer,
  pg_get_function_identity_arguments(p.oid)         AS arguments,
  pg_get_function_result(p.oid)                     AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_logistics_request',
    'update_logistics_status',
    'enforce_logistics_update_security'
  )
ORDER BY p.proname;

-- V10. Realtime publication membership
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'logistics_requests';

-- V11. REPLICA IDENTITY setting (must be 'f' = FULL)
SELECT relname, relreplident
FROM pg_class
WHERE oid = 'public.logistics_requests'::regclass;
-- Expected: relreplident = 'f'   (FULL)
-- Bad:      relreplident = 'd'   (DEFAULT)

-- V12. Privilege grants — confirm INSERT is NOT granted to authenticated or anon
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name   = 'logistics_requests'
ORDER BY grantee, privilege_type;
-- Expected: authenticated has SELECT, UPDATE, DELETE — NOT INSERT
-- Expected: anon has NOTHING

*/
