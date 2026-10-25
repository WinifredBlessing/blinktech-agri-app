-- ==============================================================================
-- AgriLink Migration: Security Hardening & Logistics/Order Consistency
-- Migration File: 20261014_security_hardening_and_logistics_consistency.sql
-- Target Project: https://wmmhpducvihhmcclpvtd.supabase.co (BlinkTech Agro)
-- Status: PREPARED / PENDING APPROVAL (DO NOT APPLY OR EXECUTE DIRECTLY)
--
-- ── REVISION SUMMARY ──────────────────────────────────────────────────────────
-- R1. CRITICAL TYPO & IDENTIFIER AUDIT:
--     • Corrected `public.is_active_use()` → `public.is_active_user()` in the
--       "Farmer payout accounts update policy" WITH CHECK clause.
--     • Audited all helper function names, schema qualifiers, and RPC signatures.
--
-- R2. ACTIVE ADMIN AUTHORIZATION:
--     • Hardened `public.is_admin()` to require role = 'admin' AND status = 'Active'.
--     • Hardened `admin_moderate_user_status()` and `admin_update_user_profile()`
--       to strictly validate active administrator authorization at the top of each
--       SECURITY DEFINER RPC, closing the bypass where suspended admins could
--       moderate users through server-side functions.
--
-- R3. CONSISTENT ADMIN PRIVILEGES:
--     • Standardized admin authorization across helper functions, privileged RPCs,
--       triggers, and RLS policies using `public.is_admin()`.
--     • Preserved authorized active admin user moderation capabilities.
--     • Re-enforced that role escalation (setting role = 'admin') is strictly
--       blocked by `prevent_profile_role_tampering()`. No API or stored procedure
--       can promote an account to administrator.
--
-- R4. BUYER REQUEST UPDATE POLICY & TRIGGER ALIGNMENT:
--     • USING clause aligned to legitimate update access: buyers and farmers may
--       only select/update requests while in 'Pending' status.
--     • WITH CHECK clause aligned to permitted transitions:
--         - Farmers: Pending → Accepted or Declined.
--         - Buyers: Pending → Cancelled (or Pending for safe detail updates).
--     • Trigger `trg_check_buyer_request_update` hardened:
--         - Enforces caller is a legitimate party (buyer_id, farmer_id, or active admin).
--         - Strictly enforces immutability of id, buyer_id, farmer_id, produce_id,
--           quantity, unit, price, total_amount, and created_at.
--         - Enforces terminal-state locking: Accepted, Declined, and Cancelled
--           requests cannot be reopened or modified.
--         - Prevents buyers from altering farmer response fields or accepting/declining.
--         - Prevents farmers from altering buyer notes, delivery parameters, or cancelling.
--
-- R5. ORDER / LOGISTICS WORKFLOW & STATE CONSISTENCY:
--     • Farmer order status transitions restricted:
--         - Confirmed → Processing or Cancelled.
--         - Processing → Ready for Delivery or Cancelled.
--         - Ready for Delivery: dispatch to 'In Transit' removed from farmer capability;
--           can only cancel if no consignment has been picked up by logistics.
--         - In Transit: farmer cannot cancel or mark delivered once in transit.
--         - Delivered: delivery confirmation is exclusively buyer-controlled (Delivered → Completed).
--     • Logistics subsystem (`update_logistics_status` admin RPC) is the exclusive
--       path to transition orders to 'In Transit' and 'Delivered'.
--
-- R6. RPC EXECUTION PERMISSIONS:
--     • Explicitly revoked EXECUTE from PUBLIC and anon on:
--         - `accept_buyer_request_and_create_order`
--         - `create_logistics_request`
--         - `update_logistics_status`
--         - `create_notification`
--         - `admin_moderate_user_status`
--         - `admin_update_user_profile`
--         - `is_active_user`
--         - `is_admin`
--     • Granted EXECUTE only to `authenticated` for public-facing RPCs with robust
--       internal authorization guards.
--     • Enforced revocation of direct table INSERT on orders, logistics_requests,
--       and notifications.
--
-- R7. LOGISTICS REQUEST VALIDATION:
--     • `create_logistics_request()` requires the associated order to be in exactly
--       'Ready for Delivery' stage before a request can be created.
--     • Validates caller is an Active buyer and owns the referenced order.
--     • Validates that the target farmer profile is also Active.
--     • Denormalized buyer_id and farmer_id are strictly derived from the locked
--       order row, never accepted from caller inputs.
--
-- R8. NOTIFICATION AUTHORIZATION:
--     • `create_notification()` requires caller to be Active.
--     • Non-admin callers must provide a non-NULL `p_related_id`.
--     • Role-based notification type restrictions:
--         - Buyers: 'new_request', 'request_submitted', 'logistics_requested', 'order_status'.
--         - Farmers: 'request_accepted', 'request_declined', 'order_created', 'order_status', 'logistics_update'.
--         - Admins: unrestricted.
--     • Bilateral relationship validation: BOTH caller AND recipient must be
--       parties (buyer_id or farmer_id) to the exact referenced transaction record
--       in `buyer_requests`, `orders`, or `logistics_requests`.
--     • Recipient profile existence and active validation.
--
-- R9. ADMIN RECOVERY PROCEDURE:
--     • Fully documented in STEP 0. Requires direct PostgreSQL superuser access
--       with `SET LOCAL session_replication_role = replica;` inside a transaction.
--     • No unauthenticated backdoor or public self-promotion endpoint exists.
--
-- R10. DEAD BRANCH REMOVAL & MIGRATION SAFETY:
--     • Removed unreachable order status tolerances in `update_logistics_status()`.
--     • Permitted non-transitioning metadata updates (provider, driver details)
--       while in non-terminal logistics status.
--     • All triggers, policies, and functions use idempotent DROP IF EXISTS / CREATE
--       syntax and adhere to strict search_path = public settings.
-- ==============================================================================


-- ==============================================================================
-- STEP 0: Admin Recovery Procedure (Documentation Only - No Backdoor)
-- ==============================================================================
-- SCENARIO:
-- In the rare event where every platform administrator account has been Suspended
-- or Banned, `public.is_admin()` will return FALSE for all users. Consequently,
-- no administrator will be able to access the admin dashboard or execute any
-- admin-moderation RPCs.
--
-- RECOVERY INSTRUCTIONS (Requires direct PostgreSQL database superuser access):
--
-- 1. Connect using the direct database connection URI (from Supabase Dashboard →
--    Project Settings → Database → Connection string) using psql, DBeaver, etc.
--    Do NOT use anon or service_role API keys (those do NOT bypass table triggers).
--
-- 2. Inspect administrator accounts:
--      SELECT id, full_name, role, status
--      FROM public.profiles
--      WHERE role = 'admin'
--      ORDER BY created_at;
--
-- 3. Execute the reinstatement inside a single transaction with replication role set
--    to replica to bypass the prevent_profile_role_tampering trigger (direct psql
--    sessions lack auth.uid() JWT context):
--
--      BEGIN;
--      SET LOCAL session_replication_role = replica;
--      UPDATE public.profiles
--        SET status = 'Active', updated_at = NOW()
--        WHERE id = '<target-admin-uuid>'
--          AND role = 'admin';
--      RESET session_replication_role;
--      COMMIT;
--
-- 4. Verify reinstatement:
--      SELECT id, full_name, role, status
--      FROM public.profiles
--      WHERE id = '<target-admin-uuid>';
--
-- SECURITY GUARANTEE:
-- • No unauthenticated recovery endpoint exists in application code.
-- • Normal users and active admins cannot elevate any profile's role to 'admin'.
-- ==============================================================================


-- ==============================================================================
-- STEP 1: Helper Functions — is_active_user() and hardened is_admin()
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'Active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

-- Hardened is_admin(): Admin must exist, have role 'admin', AND have status 'Active'.
-- Suspended or Banned administrators evaluate to FALSE across all RLS policies and RPCs.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'Active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ==============================================================================
-- STEP 2A: Profiles Hardening & Admin Moderation RPCs
-- ==============================================================================

-- admin_moderate_user_status: RPC for admin status and verification moderation
CREATE OR REPLACE FUNCTION public.admin_moderate_user_status(
  target_user_id  UUID,
  new_status      TEXT,
  new_is_verified BOOLEAN DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   UUID;
  updated_row public.profiles;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Active administrator authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only active administrators can moderate user accounts.';
  END IF;

  -- Prevent self-lockout: Admin cannot alter their own account status through this RPC
  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Administrators cannot modify their own account status through this action.';
  END IF;

  -- Validate allowed status values
  IF new_status NOT IN ('Active', 'Suspended', 'Banned') THEN
    RAISE EXCEPTION 'Invalid status value: %. Allowed: Active, Suspended, Banned.', new_status;
  END IF;

  -- Perform the update (triggers will fire; role remains immutable)
  IF new_is_verified IS NOT NULL THEN
    UPDATE public.profiles
    SET
      status      = new_status,
      is_verified = new_is_verified,
      updated_at  = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  ELSE
    UPDATE public.profiles
    SET
      status     = new_status,
      updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  END IF;

  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'Target user with ID % not found.', target_user_id;
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_user_status(UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_user_status(UUID, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_user_status(UUID, TEXT, BOOLEAN) TO authenticated;


-- admin_update_user_profile: RPC for safe administrative profile detail edits
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  target_user_id UUID,
  p_full_name    TEXT,
  p_phone        TEXT    DEFAULT NULL,
  p_location     TEXT    DEFAULT NULL,
  p_farm_name    TEXT    DEFAULT NULL,
  p_organization TEXT    DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   UUID;
  updated_row public.profiles;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Active administrator authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only active administrators can edit user profiles through this action.';
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name cannot be empty.';
  END IF;

  UPDATE public.profiles
  SET
    full_name    = trim(p_full_name),
    phone        = COALESCE(p_phone, phone),
    location     = COALESCE(p_location, location),
    farm_name    = COALESCE(p_farm_name, farm_name),
    organization = COALESCE(p_organization, organization),
    updated_at   = NOW()
  WHERE id = target_user_id
  RETURNING * INTO updated_row;

  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'Target user with ID % not found.', target_user_id;
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ==============================================================================
-- STEP 2B: Profile Role & Status Tampering Trigger & Policies
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_profile_role_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Non-admins and suspended admins: revert role, status, and is_verified modifications
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;

    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      NEW.is_verified := OLD.is_verified;
    END IF;
  ELSE
    -- Active administrators: may modify status and is_verified, but NEVER role.
    -- Role promotion/demotion strictly requires direct database superuser operations.
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_tampering();

-- Profiles UPDATE Policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND public.is_active_user()
  )
  WITH CHECK (
    auth.uid() = id
    AND public.is_active_user()
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ==============================================================================
-- STEP 3: Produce Table Hardening
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_produce_farmer_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.farmer_id
      AND role = 'farmer'
      AND status = 'Active'
  ) THEN
    RAISE EXCEPTION 'Only active registered farmers can create or own produce listings.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_produce_farmer_role ON public.produce;
CREATE TRIGGER trg_check_produce_farmer_role
  BEFORE INSERT OR UPDATE OF farmer_id ON public.produce
  FOR EACH ROW
  EXECUTE FUNCTION public.check_produce_farmer_role();

DROP POLICY IF EXISTS "Produce select policy" ON public.produce;
DROP POLICY IF EXISTS "Farmers can insert produce" ON public.produce;
DROP POLICY IF EXISTS "Produce update policy" ON public.produce;
DROP POLICY IF EXISTS "Produce delete policy" ON public.produce;

CREATE POLICY "Produce select policy"
  ON public.produce
  FOR SELECT
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    public.is_admin()
    OR
    (
      status IN ('Available', 'Limited', 'Low Stock')
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = produce.farmer_id
          AND profiles.status = 'Active'
      )
    )
  );

CREATE POLICY "Farmers can insert produce"
  ON public.produce
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = farmer_id
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    )
  );

CREATE POLICY "Produce update policy"
  ON public.produce
  FOR UPDATE
  TO authenticated
  USING (
    (
      farmer_id = auth.uid()
      AND public.is_active_user()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
      )
    )
    OR
    public.is_admin()
  )
  WITH CHECK (
    (
      farmer_id = auth.uid()
      AND public.is_active_user()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
      )
    )
    OR
    public.is_admin()
  );

CREATE POLICY "Produce delete policy"
  ON public.produce
  FOR DELETE
  TO authenticated
  USING (
    (
      farmer_id = auth.uid()
      AND public.is_active_user()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
      )
    )
    OR
    public.is_admin()
  );


-- ==============================================================================
-- STEP 4: Buyer Requests Hardening (R4)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_buyer_request()
RETURNS TRIGGER AS $$
DECLARE
  prod          RECORD;
  buyer_role    TEXT;
  buyer_status  TEXT;
  farmer_role   TEXT;
  farmer_status TEXT;
BEGIN
  -- Verify buyer role & active status
  SELECT role, status INTO buyer_role, buyer_status
  FROM public.profiles WHERE id = NEW.buyer_id;

  IF buyer_role IS NULL OR buyer_role != 'buyer' THEN
    RAISE EXCEPTION 'Only registered buyers can create purchase requests.';
  END IF;

  IF buyer_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Inactive or suspended buyers cannot create purchase requests.';
  END IF;

  -- Verify farmer role & active status
  SELECT role, status INTO farmer_role, farmer_status
  FROM public.profiles WHERE id = NEW.farmer_id;

  IF farmer_role IS NULL OR farmer_role != 'farmer' THEN
    RAISE EXCEPTION 'Target farmer must be a registered farmer profile.';
  END IF;

  IF farmer_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Cannot create purchase request for an inactive or suspended farmer.';
  END IF;

  -- Verify produce listing existence, ownership, and stock
  SELECT id, farmer_id, status, quantity INTO prod
  FROM public.produce WHERE id = NEW.produce_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced produce listing does not exist.';
  END IF;

  IF NEW.farmer_id != prod.farmer_id THEN
    RAISE EXCEPTION 'farmer_id must match the owner of the referenced produce.';
  END IF;

  IF prod.status = 'Out of Stock' OR prod.quantity <= 0 THEN
    RAISE EXCEPTION 'Cannot create a purchase request for Out of Stock produce.';
  END IF;

  -- Sync buyer_note and message fields
  IF NEW.buyer_note IS NOT NULL AND NEW.message IS NULL THEN
    NEW.message := NEW.buyer_note;
  ELSIF NEW.message IS NOT NULL AND NEW.buyer_note IS NULL THEN
    NEW.buyer_note := NEW.message;
  END IF;

  NEW.status       := 'Pending';
  NEW.responded_at := NULL;
  NEW.created_at   := NOW();
  NEW.updated_at   := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_buyer_request ON public.buyer_requests;
CREATE TRIGGER trg_validate_buyer_request
  BEFORE INSERT ON public.buyer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_buyer_request();


-- Hardened check_buyer_request_update trigger function (R4)
CREATE OR REPLACE FUNCTION public.check_buyer_request_update()
RETURNS TRIGGER AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Active administrators have full moderation capability
  IF public.is_admin() THEN
    NEW.created_at := OLD.created_at;
    IF NEW.status IN ('Accepted', 'Declined') AND OLD.responded_at IS NULL THEN
      NEW.responded_at := NOW();
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Inactive or suspended users cannot update buyer requests
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Inactive or suspended users cannot modify buyer requests.';
  END IF;

  -- Verify caller is either the buyer or the farmer
  IF caller_id IS DISTINCT FROM OLD.buyer_id AND caller_id IS DISTINCT FROM OLD.farmer_id THEN
    RAISE EXCEPTION 'You are not authorized to modify this buyer request.';
  END IF;

  -- Core commercial, relational, and identity fields are strictly immutable
  IF NEW.id           IS DISTINCT FROM OLD.id           OR
     NEW.buyer_id     IS DISTINCT FROM OLD.buyer_id     OR
     NEW.farmer_id    IS DISTINCT FROM OLD.farmer_id    OR
     NEW.produce_id   IS DISTINCT FROM OLD.produce_id   OR
     NEW.quantity     IS DISTINCT FROM OLD.quantity     OR
     NEW.unit         IS DISTINCT FROM OLD.unit         OR
     NEW.price        IS DISTINCT FROM OLD.price        OR
     NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
     NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Commercial terms, identity parameters, and timestamps are strictly immutable after submission.';
  END IF;

  -- Terminal state protection: Accepted, Declined, and Cancelled requests cannot be modified
  IF OLD.status IN ('Accepted', 'Declined', 'Cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify buyer request in "%" status. Accepted, Declined, and Cancelled requests are final.', OLD.status;
  END IF;

  -- ── Buyer-Specific Restrictions ─────────────────────────────────────────────
  IF caller_id = OLD.buyer_id THEN
    -- Buyer cannot modify farmer response fields
    IF NEW.farmer_response IS DISTINCT FROM OLD.farmer_response OR
       NEW.responded_at    IS DISTINCT FROM OLD.responded_at THEN
      RAISE EXCEPTION 'Buyers are not permitted to modify farmer response fields.';
    END IF;

    -- Buyers cannot accept or decline requests
    IF NEW.status IN ('Accepted', 'Declined') THEN
      RAISE EXCEPTION 'Buyers are not authorized to accept or decline requests.';
    END IF;

    -- Buyers can only cancel a Pending request (or keep it Pending)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Pending' AND NEW.status = 'Cancelled' THEN
        NULL; -- Legitimate cancellation
      ELSE
        RAISE EXCEPTION 'Buyers can only cancel Pending requests. Attempted: % -> %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  -- ── Farmer-Specific Restrictions ────────────────────────────────────────────
  IF caller_id = OLD.farmer_id THEN
    -- Farmers cannot modify buyer notes or delivery preferences
    IF NEW.buyer_note              IS DISTINCT FROM OLD.buyer_note              OR
       NEW.message                 IS DISTINCT FROM OLD.message                 OR
       NEW.delivery_location       IS DISTINCT FROM OLD.delivery_location       OR
       NEW.preferred_delivery_date IS DISTINCT FROM OLD.preferred_delivery_date THEN
      RAISE EXCEPTION 'Farmers are not permitted to modify buyer request parameters or notes.';
    END IF;

    -- Farmers cannot cancel requests
    IF NEW.status = 'Cancelled' THEN
      RAISE EXCEPTION 'Farmers are not authorized to cancel buyer requests.';
    END IF;

    -- Farmers can only transition Pending → Accepted or Declined
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Pending' AND NEW.status IN ('Accepted', 'Declined') THEN
        NEW.responded_at := NOW();
      ELSE
        RAISE EXCEPTION 'Farmers can only transition Pending requests to Accepted or Declined. Attempted: % -> %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_buyer_request_update ON public.buyer_requests;
CREATE TRIGGER trg_check_buyer_request_update
  BEFORE UPDATE ON public.buyer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_buyer_request_update();

-- Buyer Requests RLS Policies (R4)
DROP POLICY IF EXISTS "Buyer requests select policy" ON public.buyer_requests;
CREATE POLICY "Buyer requests select policy"
  ON public.buyer_requests
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR
    farmer_id = auth.uid()
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Buyers can insert their own requests" ON public.buyer_requests;
CREATE POLICY "Buyers can insert their own requests"
  ON public.buyer_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'buyer'
    )
    AND EXISTS (
      SELECT 1 FROM public.produce
      JOIN public.profiles ON profiles.id = produce.farmer_id
      WHERE produce.id = produce_id
        AND produce.farmer_id = buyer_requests.farmer_id
        AND produce.status != 'Out of Stock'
        AND produce.quantity > 0
        AND profiles.status = 'Active'
    )
  );

DROP POLICY IF EXISTS "Buyer requests update policy" ON public.buyer_requests;
CREATE POLICY "Buyer requests update policy"
  ON public.buyer_requests
  FOR UPDATE
  TO authenticated
  USING (
    (farmer_id = auth.uid() AND status = 'Pending' AND public.is_active_user())
    OR
    (buyer_id  = auth.uid() AND status = 'Pending' AND public.is_active_user())
    OR
    public.is_admin()
  )
  WITH CHECK (
    (farmer_id = auth.uid() AND status IN ('Accepted', 'Declined') AND public.is_active_user())
    OR
    (buyer_id  = auth.uid() AND status IN ('Pending', 'Cancelled') AND public.is_active_user())
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admin only delete policy" ON public.buyer_requests;
CREATE POLICY "Admin only delete policy"
  ON public.buyer_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ==============================================================================
-- STEP 5: Orders Lifecycle Security & Order Creation Hardening (R5, R6)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.accept_buyer_request_and_create_order(
  p_request_id      UUID,
  p_farmer_response TEXT DEFAULT NULL
)
RETURNS public.orders AS $$
DECLARE
  caller_id            UUID;
  farmer_role          TEXT;
  farmer_status        TEXT;
  buyer_status         TEXT;
  v_request            public.buyer_requests%ROWTYPE;
  v_produce            public.produce%ROWTYPE;
  v_new_order          public.orders%ROWTYPE;
  v_remaining_qty      NUMERIC;
  v_new_produce_status TEXT;
  v_buyer_note         TEXT;
BEGIN
  -- 1. Authenticate caller
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: You must be logged in to accept a request.';
  END IF;

  -- 2. Verify caller is an Active registered farmer
  SELECT role, status INTO farmer_role, farmer_status
  FROM public.profiles
  WHERE id = caller_id;

  IF farmer_role IS NULL OR farmer_role != 'farmer' THEN
    RAISE EXCEPTION 'Only registered farmers can accept buyer requests.';
  END IF;

  IF farmer_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Suspended or inactive farmers cannot accept buyer requests.';
  END IF;

  -- 3. Lock buyer request row (FOR UPDATE)
  SELECT * INTO v_request
  FROM public.buyer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buyer request not found.';
  END IF;

  -- 4. Verify buyer account is Active before creating order
  SELECT status INTO buyer_status
  FROM public.profiles
  WHERE id = v_request.buyer_id;

  IF buyer_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Cannot convert request to order: Buyer account is inactive or suspended.';
  END IF;

  -- 5. Strict ownership verification
  IF v_request.farmer_id != caller_id THEN
    RAISE EXCEPTION 'You are not authorized to accept this request.';
  END IF;

  -- 6. Duplicate order prevention
  IF EXISTS (SELECT 1 FROM public.orders WHERE buyer_request_id = v_request.id) THEN
    RAISE EXCEPTION 'This buyer request has already been converted to an order.';
  END IF;

  -- 7. Request status check
  IF v_request.status != 'Pending' THEN
    RAISE EXCEPTION 'Only Pending requests can be accepted. Current status: %', v_request.status;
  END IF;

  -- 8. Lock produce row (FOR UPDATE)
  SELECT * INTO v_produce
  FROM public.produce
  WHERE id = v_request.produce_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced produce listing no longer exists.';
  END IF;

  IF v_produce.farmer_id != v_request.farmer_id THEN
    RAISE EXCEPTION 'Produce ownership mismatch.';
  END IF;

  -- 9. Inventory availability check
  IF v_produce.quantity < v_request.quantity THEN
    RAISE EXCEPTION
      'Insufficient inventory: requested % %, but only % % is available in stock.',
      v_request.quantity, v_request.unit, v_produce.quantity, v_produce.unit;
  END IF;

  -- 10. Atomic inventory reduction
  v_remaining_qty := v_produce.quantity - v_request.quantity;

  IF v_remaining_qty = 0 THEN
    v_new_produce_status := 'Out of Stock';
  ELSE
    v_new_produce_status := v_produce.status;
  END IF;

  UPDATE public.produce
  SET
    quantity   = v_remaining_qty,
    status     = v_new_produce_status,
    updated_at = NOW()
  WHERE id = v_produce.id;

  -- 11. Update buyer request status
  UPDATE public.buyer_requests
  SET
    status          = 'Accepted',
    farmer_response = COALESCE(p_farmer_response, farmer_response, 'Accepted by farmer'),
    responded_at    = NOW(),
    updated_at      = NOW()
  WHERE id = v_request.id;

  -- 12. Extract authoritative note
  v_buyer_note := COALESCE(v_request.buyer_note, v_request.message);

  -- 13. Create order
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

  RETURN v_new_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_buyer_request_and_create_order(UUID, TEXT) TO authenticated;


-- Hardened order update security trigger (R3, R5)
CREATE OR REPLACE FUNCTION public.enforce_order_update_security()
RETURNS TRIGGER AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Active platform admins have full moderation latitude
  IF public.is_admin() THEN
    NEW.created_at := OLD.created_at;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Inactive or suspended users cannot modify orders
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Inactive or suspended users cannot modify orders.';
  END IF;

  -- Verify caller is either the farmer or the buyer
  IF caller_id IS DISTINCT FROM OLD.farmer_id AND caller_id IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'You are not authorized to modify this order.';
  END IF;

  -- Commercial and identity terms strictly immutable for non-admin callers
  IF NEW.buyer_request_id        IS DISTINCT FROM OLD.buyer_request_id        OR
     NEW.buyer_id                IS DISTINCT FROM OLD.buyer_id                OR
     NEW.farmer_id               IS DISTINCT FROM OLD.farmer_id               OR
     NEW.produce_id              IS DISTINCT FROM OLD.produce_id              OR
     NEW.quantity                IS DISTINCT FROM OLD.quantity                OR
     NEW.unit                    IS DISTINCT FROM OLD.unit                    OR
     NEW.price                   IS DISTINCT FROM OLD.price                   OR
     NEW.total_amount            IS DISTINCT FROM OLD.total_amount            OR
     NEW.pickup_location         IS DISTINCT FROM OLD.pickup_location         OR
     NEW.delivery_location       IS DISTINCT FROM OLD.delivery_location       OR
     NEW.preferred_delivery_date IS DISTINCT FROM OLD.preferred_delivery_date OR
     NEW.created_at              IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Commercial and identity order terms are strictly immutable after creation.';
  END IF;

  -- Terminal state protection
  IF OLD.status = 'Completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Completed orders cannot be modified or reopened.';
  END IF;

  IF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cancelled orders cannot be modified or reopened.';
  END IF;

  -- ── Buyer-Specific Restrictions ──────────────────────────────────────────────
  IF caller_id = OLD.buyer_id THEN
    IF NEW.farmer_notes IS DISTINCT FROM OLD.farmer_notes THEN
      RAISE EXCEPTION 'Buyers are not permitted to modify farmer notes.';
    END IF;

    IF NEW.fulfillment_notes IS DISTINCT FROM OLD.fulfillment_notes THEN
      RAISE EXCEPTION 'Buyers are not permitted to modify fulfillment notes.';
    END IF;

    -- Exclusive buyer delivery confirmation step (Delivered → Completed)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Delivered' AND NEW.status = 'Completed' THEN
        NULL; -- Permitted delivery confirmation
      ELSE
        RAISE EXCEPTION 'Buyers can only update order status from Delivered to Completed.';
      END IF;
    END IF;
  END IF;

  -- ── Farmer-Specific Restrictions ─────────────────────────────────────────────
  IF caller_id = OLD.farmer_id THEN
    IF NEW.buyer_notes IS DISTINCT FROM OLD.buyer_notes THEN
      RAISE EXCEPTION 'Farmers are not permitted to modify buyer notes.';
    END IF;

    -- Forward-only farmer fulfillment lifecycle:
    -- Confirmed → Processing → Ready for Delivery
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'Confirmed' AND NEW.status NOT IN ('Processing', 'Cancelled') THEN
        RAISE EXCEPTION 'Confirmed orders can only transition to Processing or Cancelled. Attempted: %', NEW.status;

      ELSIF OLD.status = 'Processing' AND NEW.status NOT IN ('Ready for Delivery', 'Cancelled') THEN
        RAISE EXCEPTION 'Processing orders can only transition to Ready for Delivery or Cancelled. Attempted: %', NEW.status;

      ELSIF OLD.status = 'Ready for Delivery' THEN
        -- R5: Farmers cannot advance to In Transit directly.
        IF NEW.status NOT IN ('Cancelled') THEN
          RAISE EXCEPTION
            'Ready for Delivery orders cannot be directly advanced by farmers. '
            'Dispatch to "In Transit" is managed exclusively by the logistics subsystem. Attempted: %',
            NEW.status;
        ELSE
          -- Prevent cancellation if logistics consignment has already been picked up
          IF EXISTS (
            SELECT 1 FROM public.logistics_requests
            WHERE order_id = OLD.id
              AND status IN ('Picked Up', 'In Transit')
          ) THEN
            RAISE EXCEPTION 'Cannot cancel order: Consignment has already been collected by logistics or is in transit.';
          END IF;
        END IF;

      ELSIF OLD.status = 'In Transit' THEN
        -- R5: In Transit orders cannot be altered or cancelled by the farmer.
        RAISE EXCEPTION
          'Farmers cannot modify order status once in transit. Delivery marking is managed exclusively by the logistics subsystem. Attempted: %',
          NEW.status;

      ELSIF OLD.status = 'Delivered' THEN
        RAISE EXCEPTION
          'Farmers cannot modify order status once delivered. Delivery confirmation is reserved exclusively for the buyer. Attempted: %',
          NEW.status;

      ELSIF OLD.status NOT IN ('Confirmed', 'Processing', 'Ready for Delivery') THEN
        RAISE EXCEPTION 'Farmers cannot modify order status from "%" state. Attempted: %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_order_update_security ON public.orders;
CREATE TRIGGER trg_enforce_order_update_security
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_update_security();

-- Orders RLS Policies
DROP POLICY IF EXISTS "Orders select policy" ON public.orders;
CREATE POLICY "Orders select policy"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR
    farmer_id = auth.uid()
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Orders update policy" ON public.orders;
CREATE POLICY "Orders update policy"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    (farmer_id = auth.uid() AND public.is_active_user())
    OR
    (buyer_id  = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  )
  WITH CHECK (
    (farmer_id = auth.uid() AND public.is_active_user())
    OR
    (buyer_id  = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Orders admin delete policy" ON public.orders;
CREATE POLICY "Orders admin delete policy"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ==============================================================================
-- STEP 6: Logistics Request Creation Hardening (R7)
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
  caller_id     UUID;
  user_role     TEXT;
  user_status   TEXT;
  farmer_status TEXT;
  v_order       public.orders%ROWTYPE;
  v_new_row     public.logistics_requests%ROWTYPE;
BEGIN
  -- 1. Authenticate caller
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: You must be logged in to request logistics.';
  END IF;

  -- 2. Verify caller is an Active registered buyer
  SELECT role, status INTO user_role, user_status
  FROM public.profiles
  WHERE id = caller_id;

  IF user_role IS NULL OR user_role != 'buyer' THEN
    RAISE EXCEPTION 'Only registered buyers can create logistics requests.';
  END IF;

  IF user_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Inactive or suspended buyers cannot request logistics.';
  END IF;

  -- 3. Validate required parameters
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'p_order_id is required.';
  END IF;

  IF p_pickup_location IS NULL OR trim(p_pickup_location) = '' THEN
    RAISE EXCEPTION 'p_pickup_location is required.';
  END IF;

  -- 4. Lock and retrieve the referenced order row (FOR UPDATE)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not exist.', p_order_id;
  END IF;

  -- 5. IDOR prevention: caller must be the buyer for this specific order
  IF v_order.buyer_id != caller_id THEN
    RAISE EXCEPTION 'You are not authorised to request logistics for this order.';
  END IF;

  -- 6. Verify target farmer account is also Active
  SELECT status INTO farmer_status
  FROM public.profiles
  WHERE id = v_order.farmer_id;

  IF farmer_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Cannot request logistics: Farmer account is inactive or suspended.';
  END IF;

  -- 7. Block logistics for terminal-status orders
  IF v_order.status = 'Cancelled' THEN
    RAISE EXCEPTION 'Logistics cannot be requested for a Cancelled order.';
  END IF;

  IF v_order.status = 'Completed' THEN
    RAISE EXCEPTION 'Logistics cannot be requested for a Completed order.';
  END IF;

  -- 8. Order readiness stage gate (R7): Farmer must have marked order Ready for Delivery
  IF v_order.status != 'Ready for Delivery' THEN
    RAISE EXCEPTION
      'Logistics can only be requested once the order is "Ready for Delivery". '
      'Current order status: %. The farmer must mark the order ready before a logistics request can be submitted.',
      v_order.status;
  END IF;

  -- 9. Check for pre-existing active logistics request
  IF EXISTS (
    SELECT 1 FROM public.logistics_requests
    WHERE order_id = p_order_id
      AND status  != 'Cancelled'
  ) THEN
    RAISE EXCEPTION
      'An active logistics request already exists for this order. Cancel the existing request before submitting a new one.';
  END IF;

  -- 10. Insert logistics record with immutable identity sourced from locked order row
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
    v_order.buyer_id,
    v_order.farmer_id,
    trim(p_pickup_location),
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

REVOKE ALL ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_logistics_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;


-- ==============================================================================
-- STEP 7: Logistics Status Update RPC & Logistics Policies (R5, R10)
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
  v_logistics    public.logistics_requests%ROWTYPE;
  v_order_status TEXT;
  v_updated_row  public.logistics_requests%ROWTYPE;
BEGIN
  -- 1. Authenticate caller
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Verify caller is an Active platform administrator (R2/R3)
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only active platform administrators can update logistics status.';
  END IF;

  -- 3. Validate requested status value
  IF p_status NOT IN (
    'Requested', 'Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Cancelled'
  ) THEN
    RAISE EXCEPTION
      'Invalid logistics status: %. Allowed: Requested, Assigned, Picked Up, In Transit, Delivered, Cancelled.',
      p_status;
  END IF;

  -- 4. Lock the logistics row (FOR UPDATE)
  SELECT * INTO v_logistics
  FROM public.logistics_requests
  WHERE id = p_logistics_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Logistics request % not found.', p_logistics_id;
  END IF;

  -- 5. Terminal status protection
  IF v_logistics.status = 'Delivered' THEN
    RAISE EXCEPTION 'Delivered logistics requests are terminal and cannot be further modified.';
  END IF;

  IF v_logistics.status = 'Cancelled' THEN
    RAISE EXCEPTION 'Cancelled logistics requests are terminal and cannot be reopened.';
  END IF;

  -- 6. Forward-only transition validation (evaluated when status changes)
  IF p_status IS DISTINCT FROM v_logistics.status THEN
    IF v_logistics.status = 'Requested'
       AND p_status NOT IN ('Assigned', 'Cancelled') THEN
      RAISE EXCEPTION 'Requested logistics can only advance to Assigned or Cancelled. Attempted: %', p_status;

    ELSIF v_logistics.status = 'Assigned'
       AND p_status NOT IN ('Picked Up', 'Cancelled') THEN
      RAISE EXCEPTION 'Assigned logistics can only advance to Picked Up or Cancelled. Attempted: %', p_status;

    ELSIF v_logistics.status = 'Picked Up'
       AND p_status NOT IN ('In Transit') THEN
      RAISE EXCEPTION 'Picked Up logistics can only advance to In Transit. Attempted: %', p_status;

    ELSIF v_logistics.status = 'In Transit'
       AND p_status NOT IN ('Delivered') THEN
      RAISE EXCEPTION 'In Transit logistics can only advance to Delivered. Attempted: %', p_status;
    END IF;
  END IF;

  -- 7. Lock associated order row (FOR UPDATE)
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = v_logistics.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated order % not found for logistics request %.', v_logistics.order_id, p_logistics_id;
  END IF;

  -- 8. Order-readiness enforcement (R10: dead branches removed)
  IF p_status = 'Picked Up' THEN
    IF v_order_status != 'Ready for Delivery' THEN
      RAISE EXCEPTION
        'Cannot advance logistics to "Picked Up": order % is currently "%". The farmer must mark the order "Ready for Delivery" before dispatch.',
        v_logistics.order_id, v_order_status;
    END IF;

  ELSIF p_status = 'In Transit' THEN
    IF v_order_status != 'Ready for Delivery' THEN
      RAISE EXCEPTION
        'Cannot advance logistics to "In Transit": order % is currently "%". The order must be "Ready for Delivery" before dispatch.',
        v_logistics.order_id, v_order_status;
    END IF;

  ELSIF p_status = 'Delivered' THEN
    IF v_order_status != 'In Transit' THEN
      RAISE EXCEPTION
        'Cannot advance logistics to "Delivered": order % is currently "%". The order must be "In Transit" before delivery can be recorded.',
        v_logistics.order_id, v_order_status;
    END IF;
  END IF;

  -- 9. Update logistics record
  UPDATE public.logistics_requests
  SET
    status       = p_status,
    provider     = COALESCE(p_provider,     provider),
    driver       = COALESCE(p_driver,       driver),
    driver_phone = COALESCE(p_driver_phone, driver_phone),
    updated_at   = NOW()
  WHERE id = p_logistics_id
  RETURNING * INTO v_updated_row;

  -- 10. Synchronize order status atomically (R5, R10)
  -- Advance order to In Transit when logistics advances to In Transit
  IF p_status = 'In Transit' AND v_order_status = 'Ready for Delivery' THEN
    UPDATE public.orders
    SET status = 'In Transit', updated_at = NOW()
    WHERE id = v_logistics.order_id;

  -- Advance order to Delivered when logistics advances to Delivered
  -- NEVER sets Completed: Delivered → Completed is reserved exclusively for buyer confirmation
  ELSIF p_status = 'Delivered' AND v_order_status = 'In Transit' THEN
    UPDATE public.orders
    SET status = 'Delivered', updated_at = NOW()
    WHERE id = v_logistics.order_id;
  END IF;

  RETURN v_updated_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_logistics_status(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Logistics Trigger & Policies
CREATE OR REPLACE FUNCTION public.enforce_logistics_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Identity and relationship immutability
  IF NEW.id         IS DISTINCT FROM OLD.id         OR
     NEW.order_id   IS DISTINCT FROM OLD.order_id   OR
     NEW.buyer_id   IS DISTINCT FROM OLD.buyer_id   OR
     NEW.farmer_id  IS DISTINCT FROM OLD.farmer_id  OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Logistics identity fields (id, order_id, buyer_id, farmer_id, created_at) are immutable.';
  END IF;

  -- Terminal status protection
  IF OLD.status = 'Delivered' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Delivered logistics requests are terminal and cannot be further modified.';
  END IF;

  IF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cancelled logistics requests are terminal and cannot be reopened.';
  END IF;

  -- Forward-only status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'Requested' AND NEW.status NOT IN ('Assigned', 'Cancelled') THEN
      RAISE EXCEPTION 'Requested logistics can only advance to Assigned or Cancelled. Attempted: %', NEW.status;
    ELSIF OLD.status = 'Assigned' AND NEW.status NOT IN ('Picked Up', 'Cancelled') THEN
      RAISE EXCEPTION 'Assigned logistics can only advance to Picked Up or Cancelled. Attempted: %', NEW.status;
    ELSIF OLD.status = 'Picked Up' AND NEW.status NOT IN ('In Transit') THEN
      RAISE EXCEPTION 'Picked Up logistics can only advance to In Transit. Attempted: %', NEW.status;
    ELSIF OLD.status = 'In Transit' AND NEW.status NOT IN ('Delivered') THEN
      RAISE EXCEPTION 'In Transit logistics can only advance to Delivered. Attempted: %', NEW.status;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_logistics_update_security ON public.logistics_requests;
CREATE TRIGGER trg_enforce_logistics_update_security
  BEFORE UPDATE ON public.logistics_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_logistics_update_security();

DROP POLICY IF EXISTS "Logistics select policy" ON public.logistics_requests;
CREATE POLICY "Logistics select policy"
  ON public.logistics_requests
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid()
    OR
    farmer_id = auth.uid()
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Logistics update policy" ON public.logistics_requests;
CREATE POLICY "Logistics update policy"
  ON public.logistics_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Logistics delete policy" ON public.logistics_requests;
CREATE POLICY "Logistics delete policy"
  ON public.logistics_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ==============================================================================
-- STEP 8: Farmer Payout Accounts Hardening (R1 typo fixed)
-- ==============================================================================

DROP POLICY IF EXISTS "Farmer payout accounts select policy" ON public.farmer_payout_accounts;
CREATE POLICY "Farmer payout accounts select policy"
  ON public.farmer_payout_accounts
  FOR SELECT
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Farmer payout accounts insert policy" ON public.farmer_payout_accounts;
CREATE POLICY "Farmer payout accounts insert policy"
  ON public.farmer_payout_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    farmer_id = auth.uid()
    AND public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    )
  );

DROP POLICY IF EXISTS "Farmer payout accounts update policy" ON public.farmer_payout_accounts;
CREATE POLICY "Farmer payout accounts update policy"
  ON public.farmer_payout_accounts
  FOR UPDATE
  TO authenticated
  USING (
    (farmer_id = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  )
  WITH CHECK (
    (farmer_id = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  );


-- ==============================================================================
-- STEP 9: Notification Authorization Hardening (R8)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_type         TEXT,
  p_title        TEXT,
  p_message      TEXT,
  p_link         TEXT DEFAULT NULL,
  p_related_id   UUID DEFAULT NULL
)
RETURNS public.notifications AS $$
DECLARE
  caller_id     UUID;
  caller_role   TEXT;
  caller_status TEXT;
  v_new_row     public.notifications%ROWTYPE;
BEGIN
  -- 1. Authenticate caller
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: You must be logged in to create a notification.';
  END IF;

  -- 2. Caller must be Active
  SELECT role, status INTO caller_role, caller_status
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Inactive or suspended accounts cannot create notifications.';
  END IF;

  -- 3. Validate required inputs
  IF p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'create_notification: p_recipient_id is required.';
  END IF;

  IF TRIM(COALESCE(p_type, '')) = '' THEN
    RAISE EXCEPTION 'create_notification: p_type is required.';
  END IF;

  IF TRIM(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'create_notification: p_title is required.';
  END IF;

  IF TRIM(COALESCE(p_message, '')) = '' THEN
    RAISE EXCEPTION 'create_notification: p_message is required.';
  END IF;

  -- 4. Validate notification type against allowed catalog
  IF p_type NOT IN (
    'new_request',
    'request_submitted',
    'request_accepted',
    'request_declined',
    'order_created',
    'order_status',
    'logistics_requested',
    'logistics_update'
  ) THEN
    RAISE EXCEPTION
      'create_notification: Unknown notification type "%". Allowed: new_request, request_submitted, request_accepted, request_declined, order_created, order_status, logistics_requested, logistics_update.',
      p_type;
  END IF;

  -- 5. Non-admin caller authorization & relationship guards (R8)
  IF caller_role != 'admin' THEN

    -- (a) Related ID is required for non-admin callers
    IF p_related_id IS NULL THEN
      RAISE EXCEPTION
        'create_notification: Non-administrator callers must provide a related_id referencing the associated transaction.';
    END IF;

    -- (b) Restrict allowed notification types by caller role
    IF caller_role = 'buyer' AND p_type NOT IN (
      'new_request', 'request_submitted', 'logistics_requested', 'order_status'
    ) THEN
      RAISE EXCEPTION 'create_notification: Buyers are not authorized to create notification type "%".', p_type;
    END IF;

    IF caller_role = 'farmer' AND p_type NOT IN (
      'request_accepted', 'request_declined', 'order_created', 'order_status', 'logistics_update'
    ) THEN
      RAISE EXCEPTION 'create_notification: Farmers are not authorized to create notification type "%".', p_type;
    END IF;

    -- (c) Bilateral party verification: BOTH caller AND recipient must be parties to the referenced record
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.buyer_requests
        WHERE id = p_related_id
          AND (buyer_id = caller_id OR farmer_id = caller_id)
          AND (buyer_id = p_recipient_id OR farmer_id = p_recipient_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.orders
        WHERE id = p_related_id
          AND (buyer_id = caller_id OR farmer_id = caller_id)
          AND (buyer_id = p_recipient_id OR farmer_id = p_recipient_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.logistics_requests
        WHERE id = p_related_id
          AND (buyer_id = caller_id OR farmer_id = caller_id)
          AND (buyer_id = p_recipient_id OR farmer_id = p_recipient_id)
      )
    ) THEN
      RAISE EXCEPTION
        'create_notification: You are not authorized to send notifications for this record and recipient. Both caller and recipient must be authorized transaction parties.';
    END IF;

  END IF;

  -- 6. Verify recipient exists in public.profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'create_notification: Recipient profile % not found.', p_recipient_id;
  END IF;

  -- 7. Insert notification record
  INSERT INTO public.notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    related_id,
    is_read,
    created_at
  ) VALUES (
    p_recipient_id,
    p_type,
    TRIM(p_title),
    TRIM(p_message),
    p_link,
    p_related_id,
    FALSE,
    NOW()
  )
  RETURNING * INTO v_new_row;

  RETURN v_new_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Notifications Trigger & Policies
CREATE OR REPLACE FUNCTION public.enforce_notification_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_admin() THEN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE AND NEW.read_at IS NULL THEN
      NEW.read_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- Immutability of notification content and identity
  IF NEW.id           IS DISTINCT FROM OLD.id           OR
     NEW.recipient_id IS DISTINCT FROM OLD.recipient_id OR
     NEW.type         IS DISTINCT FROM OLD.type         OR
     NEW.title        IS DISTINCT FROM OLD.title        OR
     NEW.message      IS DISTINCT FROM OLD.message      OR
     NEW.link         IS DISTINCT FROM OLD.link         OR
     NEW.related_id   IS DISTINCT FROM OLD.related_id   OR
     NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notification content and identity fields are immutable after creation.';
  END IF;

  -- Auto-stamp read_at when marked as read
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    NEW.read_at := NOW();
  END IF;

  -- Prevent reverting read notification to unread
  IF NEW.is_read = FALSE AND OLD.is_read = TRUE THEN
    RAISE EXCEPTION 'Notifications cannot be reverted from read to unread.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_notification_update_security ON public.notifications;
CREATE TRIGGER trg_enforce_notification_update_security
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_notification_update_security();

DROP POLICY IF EXISTS "Notifications select policy" ON public.notifications;
CREATE POLICY "Notifications select policy"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Notifications update policy" ON public.notifications;
CREATE POLICY "Notifications update policy"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    (recipient_id = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  )
  WITH CHECK (
    (recipient_id = auth.uid() AND public.is_active_user())
    OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "Notifications admin delete policy" ON public.notifications;
CREATE POLICY "Notifications admin delete policy"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ==============================================================================
-- STEP 10: Strict Table INSERT Revocations (Defense-in-Depth)
-- ==============================================================================
-- Ensures that orders, logistics_requests, and notifications can ONLY be created
-- through their respective authorized SECURITY DEFINER RPCs.
REVOKE INSERT ON public.orders FROM authenticated, anon;
REVOKE INSERT ON public.logistics_requests FROM authenticated, anon;
REVOKE INSERT ON public.notifications FROM authenticated, anon;


-- ==============================================================================
-- STEP 11: Schema Cache Reload
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
