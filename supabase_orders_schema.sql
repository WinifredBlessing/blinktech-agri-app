-- ==============================================================================
-- AgriLink Supabase Orders Table, Security, Atomic RPC & Realtime Setup
-- ==============================================================================
-- Migration File: supabase_orders_schema.sql
-- Architecture Version: 2.1 (Revised Atomic Orders & Inventory Architecture)
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New query -> Paste and click "Run"
--
-- IMPORTANT SAFETY NOTICE:
-- - This script does NOT alter or modify public.profiles, public.produce,
--   or public.buyer_requests.
-- - All operations on existing tables are strictly referenced or performed
--   via authenticated, transactional procedures.
-- ==============================================================================

-- ==============================================================================
-- 1. CREATE TABLE: public.orders
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  -- Primary Identifier (True UUID Primary Key)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key Relationships (Strict Relational Integrity)
  buyer_request_id UUID NOT NULL REFERENCES public.buyer_requests(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  produce_id UUID NOT NULL REFERENCES public.produce(id) ON DELETE RESTRICT,

  -- Commercial & Quantity Attributes (Inherited Authoritatively from Request)
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  price NUMERIC NOT NULL CHECK (price >= 0),
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),

  -- Logistics & Delivery Locations
  pickup_location TEXT,
  delivery_location TEXT NOT NULL,
  preferred_delivery_date DATE,

  -- Lifecycle & Fulfillment Status
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (
    status IN (
      'Confirmed',
      'Processing',
      'Ready for Delivery',
      'In Transit',
      'Delivered',
      'Completed',
      'Cancelled'
    )
  ),

  -- Negotiation & Operational Notes
  buyer_notes TEXT,
  farmer_notes TEXT,
  fulfillment_notes TEXT,

  -- Human-Friendly Display Reference (Computed Stored Column)
  order_number TEXT GENERATED ALWAYS AS (
    'ORD-' || SUBSTRING(id::TEXT, 1, 8)
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce 1-to-1 Relationship: One accepted buyer request produces at most one order
  CONSTRAINT uq_orders_buyer_request_id UNIQUE (buyer_request_id)
);

-- ==============================================================================
-- 2. INDEXES
-- ==============================================================================

-- Foreign key & relational join indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_farmer_id ON public.orders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_orders_produce_id ON public.orders(produce_id);

-- Note: buyer_request_id is uniquely indexed by the uq_orders_buyer_request_id
-- constraint above. Creating a redundant secondary index on buyer_request_id is omitted.

-- Lifecycle & chronological sorting indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anonymous users have NO access to orders
REVOKE ALL ON public.orders FROM anon;

-- Direct INSERT privilege is strictly REVOKED from all authenticated users.
-- Normal order creation has EXACTLY ONE path: the atomic SECURITY DEFINER RPC
-- public.accept_buyer_request_and_create_order(). No second pathway exists.
REVOKE INSERT ON public.orders FROM authenticated;

-- Grant SELECT, UPDATE, DELETE privileges to authenticated users (governed by RLS policies)
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Orders select policy" ON public.orders;
DROP POLICY IF EXISTS "Orders admin insert policy" ON public.orders;
DROP POLICY IF EXISTS "Orders update policy" ON public.orders;
DROP POLICY IF EXISTS "Orders admin delete policy" ON public.orders;

-- Policy A: SELECT
-- - Buyers can view only their own purchase orders.
-- - Farmers can view only orders placed for their produce listings.
-- - Platform Admins can view all orders across the platform.
CREATE POLICY "Orders select policy"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR
    farmer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy B: UPDATE
-- - Farmers can update their own orders (fulfillment milestones & fulfillment notes).
-- - Buyers can update their own orders (specifically delivery confirmation / receipt).
-- - Admins can update any order.
-- - NOTE: Field immutability, role permissions, and valid status transitions are
--   strictly enforced by the BEFORE UPDATE trigger trg_enforce_order_update_security below.
CREATE POLICY "Orders update policy"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    buyer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    farmer_id = auth.uid()
    OR
    buyer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy C: DELETE
-- - Restricted to Platform Admins ONLY.
-- - Regular buyers and farmers cannot delete commercial trade records.
CREATE POLICY "Orders admin delete policy"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ==============================================================================
-- 4. ORDER UPDATE SECURITY & STATUS TRANSITION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER AS $$
DECLARE
  caller_id UUID := auth.uid();
  user_role TEXT;
BEGIN
  -- Retrieve caller's platform role
  SELECT role INTO user_role FROM public.profiles WHERE id = caller_id;

  -- Platform Admins have full moderation latitude
  IF user_role = 'admin' THEN
    NEW.created_at := OLD.created_at; -- Created timestamp is always immutable
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Verify caller is either the farmer or the buyer
  IF caller_id IS DISTINCT FROM OLD.farmer_id AND caller_id IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'You are not authorized to modify this order.';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Commercial & Identity Immutability Check (Applies to both Farmer and Buyer)
  -- ----------------------------------------------------------------------------
  IF NEW.buyer_request_id IS DISTINCT FROM OLD.buyer_request_id OR
     NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR
     NEW.farmer_id IS DISTINCT FROM OLD.farmer_id OR
     NEW.produce_id IS DISTINCT FROM OLD.produce_id OR
     NEW.quantity IS DISTINCT FROM OLD.quantity OR
     NEW.unit IS DISTINCT FROM OLD.unit OR
     NEW.price IS DISTINCT FROM OLD.price OR
     NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
     NEW.pickup_location IS DISTINCT FROM OLD.pickup_location OR
     NEW.delivery_location IS DISTINCT FROM OLD.delivery_location OR
     NEW.preferred_delivery_date IS DISTINCT FROM OLD.preferred_delivery_date OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Commercial and identity order terms are strictly immutable after creation.';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Terminal State Protection (Completed and Cancelled orders cannot be altered)
  -- ----------------------------------------------------------------------------
  IF OLD.status = 'Completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Completed orders cannot be modified or reopened.';
  END IF;

  IF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cancelled orders cannot be modified or reopened.';
  END IF;

  -- ----------------------------------------------------------------------------
  -- Buyer-Specific Update Restrictions
  -- ----------------------------------------------------------------------------
  IF caller_id = OLD.buyer_id THEN
    -- Buyers cannot alter farmer notes or operational fulfillment notes
    IF NEW.farmer_notes IS DISTINCT FROM OLD.farmer_notes THEN
      RAISE EXCEPTION 'Buyers are not permitted to modify farmer notes.';
    END IF;

    IF NEW.fulfillment_notes IS DISTINCT FROM OLD.fulfillment_notes THEN
      RAISE EXCEPTION 'Buyers are not permitted to modify fulfillment notes.';
    END IF;

    -- Buyers can ONLY update status when confirming completion (Delivered -> Completed)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Delivered' AND NEW.status = 'Completed' THEN
        -- Permitted: Buyer confirms delivery receipt and finalizes the order
        NULL;
      ELSE
        RAISE EXCEPTION 'Buyers can only update order status from Delivered to Completed.';
      END IF;
    END IF;
  END IF;

  -- ----------------------------------------------------------------------------
  -- Farmer-Specific Update Restrictions
  -- ----------------------------------------------------------------------------
  IF caller_id = OLD.farmer_id THEN
    -- Farmers cannot modify original buyer notes
    IF NEW.buyer_notes IS DISTINCT FROM OLD.buyer_notes THEN
      RAISE EXCEPTION 'Farmers are not permitted to modify buyer notes.';
    END IF;

    -- Farmers must follow the approved forward-only fulfillment lifecycle:
    -- Confirmed -> Processing
    -- Processing -> Ready for Delivery
    -- Ready for Delivery -> In Transit
    -- In Transit -> Delivered
    -- Delivered -> Completed
    -- Cancellation allowed only at appropriate pre-terminal stages
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Confirmed' AND NEW.status NOT IN ('Processing', 'Cancelled') THEN
        RAISE EXCEPTION 'Confirmed orders can only transition to Processing or Cancelled. Attempted: %', NEW.status;
      ELSIF OLD.status = 'Processing' AND NEW.status NOT IN ('Ready for Delivery', 'Cancelled') THEN
        RAISE EXCEPTION 'Processing orders can only transition to Ready for Delivery or Cancelled. Attempted: %', NEW.status;
      ELSIF OLD.status = 'Ready for Delivery' AND NEW.status NOT IN ('In Transit', 'Cancelled') THEN
        RAISE EXCEPTION 'Ready for Delivery orders can only transition to In Transit or Cancelled. Attempted: %', NEW.status;
      ELSIF OLD.status = 'In Transit' AND NEW.status NOT IN ('Delivered') THEN
        RAISE EXCEPTION 'In Transit orders can only transition to Delivered. Attempted: %', NEW.status;
      ELSIF OLD.status = 'Delivered' AND NEW.status NOT IN ('Completed') THEN
        RAISE EXCEPTION 'Delivered orders can only transition to Completed. Attempted: %', NEW.status;
      END IF;
    END IF;
  END IF;

  -- Maintain updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_order_update_security ON public.orders;

CREATE TRIGGER trg_enforce_order_update_security
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_update_security();

-- ==============================================================================
-- 5. ATOMIC RPC: accept_buyer_request_and_create_order
-- ==============================================================================
-- Coordinates in a single ACID PostgreSQL transaction:
-- 1. Pessimistic row-locking on buyer_requests (FOR UPDATE)
-- 2. Strict caller identity & role verification: caller must be a registered farmer
-- 3. Strict farmer authorization: auth.uid() must exactly match request.farmer_id
--    (Admins are NOT permitted to use this normal farmer acceptance workflow)
-- 4. Status validation (request must be 'Pending')
-- 5. Pessimistic row-locking on produce listing (FOR UPDATE)
-- 6. Produce existence & ownership check
-- 7. Inventory availability validation (requested quantity <= available quantity)
-- 8. Atomic inventory reduction:
--    - If remaining quantity = 0 -> status becomes 'Out of Stock'
--    - Otherwise -> preserves existing produce status without inventing thresholds
-- 9. Buyer request status update ('Pending' -> 'Accepted')
-- 10. Creation of exactly one public.orders record inheriting authoritative values
-- 11. Complete rollback if any step fails
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_buyer_request_and_create_order(
  p_request_id UUID,
  p_farmer_response TEXT DEFAULT NULL
)
RETURNS public.orders AS $$
DECLARE
  caller_id UUID;
  user_role TEXT;
  v_request public.buyer_requests%ROWTYPE;
  v_produce public.produce%ROWTYPE;
  v_new_order public.orders%ROWTYPE;
  v_remaining_qty NUMERIC;
  v_new_produce_status TEXT;
  v_buyer_note TEXT;
BEGIN
  -- 1. Get authenticated user ID
  caller_id := auth.uid();

  -- 2. Reject unauthenticated callers
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: You must be logged in to accept a request.';
  END IF;

  -- 3. Verify caller has an active profile and is a registered farmer
  SELECT role INTO user_role FROM public.profiles WHERE id = caller_id;
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF user_role != 'farmer' THEN
    RAISE EXCEPTION 'Only registered farmers can accept buyer requests.';
  END IF;

  -- 4. Lock the buyer request row first using SELECT ... FOR UPDATE
  SELECT * INTO v_request
  FROM public.buyer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buyer request not found.';
  END IF;

  -- 5. Strict Farmer Authorization: Caller must be the farmer associated with this specific request
  -- (Admins are NOT permitted to use this normal farmer acceptance workflow)
  IF v_request.farmer_id != caller_id THEN
    RAISE EXCEPTION 'You are not authorized to accept this request.';
  END IF;

  -- 6. Duplicate Protection: Verify this request has not already been converted to an order
  IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_request_id = v_request.id) THEN
    RAISE EXCEPTION 'This buyer request has already been converted to an order.';
  END IF;

  -- 7. Verify request status is 'Pending'
  IF v_request.status != 'Pending' THEN
    IF v_request.status = 'Accepted' THEN
      RAISE EXCEPTION 'This buyer request has already been accepted.';
    ELSIF v_request.status = 'Declined' THEN
      RAISE EXCEPTION 'Cannot accept a declined request.';
    ELSIF v_request.status = 'Cancelled' THEN
      RAISE EXCEPTION 'Cannot accept a cancelled request.';
    ELSE
      RAISE EXCEPTION 'Only Pending requests can be accepted. Current status: %', v_request.status;
    END IF;
  END IF;

  -- 8. Lock the referenced produce row using SELECT ... FOR UPDATE
  SELECT * INTO v_produce
  FROM public.produce
  WHERE id = v_request.produce_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced produce listing no longer exists.';
  END IF;

  -- 9. Verify the farmer owns the referenced produce listing
  IF v_produce.farmer_id != v_request.farmer_id THEN
    RAISE EXCEPTION 'Produce ownership mismatch.';
  END IF;

  -- 10. Concurrency & Availability Check: Verify sufficient inventory exists
  IF v_produce.quantity < v_request.quantity THEN
    RAISE EXCEPTION 'Insufficient inventory: requested % %, but only % % is available in stock.',
      v_request.quantity, v_request.unit, v_produce.quantity, v_produce.unit;
  END IF;

  -- 11. Calculate remaining quantity
  v_remaining_qty := v_produce.quantity - v_request.quantity;

  -- 12. Determine produce status:
  -- Only transition to 'Out of Stock' if remaining quantity reaches zero.
  -- Otherwise, preserve the existing produce status without inventing arbitrary thresholds.
  IF v_remaining_qty = 0 THEN
    v_new_produce_status := 'Out of Stock';
  ELSE
    v_new_produce_status := v_produce.status;
  END IF;

  -- 13. Update produce quantity and status atomically
  UPDATE public.produce
  SET
    quantity = v_remaining_qty,
    status = v_new_produce_status,
    updated_at = NOW()
  WHERE id = v_produce.id;

  -- 14. Update buyer_request to Accepted
  UPDATE public.buyer_requests
  SET
    status = 'Accepted',
    farmer_response = COALESCE(p_farmer_response, farmer_response, 'Accepted by farmer'),
    responded_at = NOW(),
    updated_at = NOW()
  WHERE id = v_request.id;

  -- Extract authoritative buyer note from request
  v_buyer_note := COALESCE(v_request.buyer_note, v_request.message);

  -- 15. Create exactly one order inheriting authoritative parameters from locked buyer_request
  INSERT INTO public.orders (
    buyer_request_id,
    buyer_id,
    farmer_id,
    produce_id,
    quantity,
    unit,
    price,
    total_amount,
    pickup_location,
    delivery_location,
    preferred_delivery_date,
    status,
    buyer_notes,
    farmer_notes,
    fulfillment_notes,
    created_at,
    updated_at
  ) VALUES (
    v_request.id,
    v_request.buyer_id,
    v_request.farmer_id,
    v_request.produce_id,
    v_request.quantity,
    v_request.unit,
    v_request.price,
    v_request.total_amount,
    COALESCE(v_produce.location, 'Farm Location'),
    v_request.delivery_location,
    v_request.preferred_delivery_date,
    'Confirmed',
    v_buyer_note,
    p_farmer_response,
    NULL,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_new_order;

  -- 16. Return the newly created order record
  RETURN v_new_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execution from public and anonymous users
REVOKE ALL ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) FROM anon;

-- Grant execution strictly to authenticated users (function self-verifies auth.uid and farmer role)
GRANT EXECUTE ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 6. SUPABASE REALTIME CONFIGURATION
-- ==============================================================================

-- Enable full replica identity so UPDATE and DELETE events broadcast full row state
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add public.orders to supabase_realtime publication safely (no duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- 7. VERIFICATION QUERIES (COMMENTED - DO NOT EXECUTE AUTOMATICALLY)
-- ==============================================================================
/*
-- 1. Verify orders table existence
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'orders';

-- 2. Verify orders columns, data types, and generated order_number column
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default, 
  is_generated, 
  generation_expression
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'orders' 
ORDER BY ordinal_position;

-- 3. Verify foreign key constraints on public.orders
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public' AND tc.table_name = 'orders';

-- 4. Verify unique constraint on buyer_request_id
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'orders' AND constraint_type = 'UNIQUE';

-- 5. Verify indexes on public.orders
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'orders';

-- 6. Verify Row Level Security is enabled
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE oid = 'public.orders'::regclass;

-- 7. Verify RLS policies on public.orders
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'orders';

-- 8. Verify trigger on public.orders
SELECT tgname, tgtype, proname 
FROM pg_trigger t 
JOIN pg_proc p ON t.tgfoid = p.oid 
WHERE tgrelid = 'public.orders'::regclass;

-- 9. Verify atomic RPC function definition and security attributes
SELECT 
  p.proname, 
  p.prosecdef, 
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p 
WHERE p.proname = 'accept_buyer_request_and_create_order';

-- 10. Verify Realtime publication membership
SELECT pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'orders';
*/
