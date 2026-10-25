-- ==============================================================================
-- AgriLink Supabase Buyer Requests Table, RLS Policies & Realtime Setup
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New query -> Paste and click "Run"
-- ==============================================================================

-- 1. Create the buyer_requests table
CREATE TABLE IF NOT EXISTS public.buyer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  produce_id UUID NOT NULL REFERENCES public.produce(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  delivery_location TEXT,
  preferred_delivery_date DATE,
  buyer_note TEXT,
  message TEXT,
  farmer_response TEXT,
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Declined', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast lookup, join, and filtering
CREATE INDEX IF NOT EXISTS idx_requests_buyer
  ON public.buyer_requests(buyer_id);

CREATE INDEX IF NOT EXISTS idx_requests_farmer
  ON public.buyer_requests(farmer_id);

CREATE INDEX IF NOT EXISTS idx_requests_produce
  ON public.buyer_requests(produce_id);

CREATE INDEX IF NOT EXISTS idx_requests_status
  ON public.buyer_requests(status);

CREATE INDEX IF NOT EXISTS idx_requests_created_at
  ON public.buyer_requests(created_at DESC);

-- 3. Trigger Function: Validate Buyer Request on INSERT
CREATE OR REPLACE FUNCTION public.validate_buyer_request()
RETURNS TRIGGER AS $$
DECLARE
  prod RECORD;
  buyer_role TEXT;
  farmer_role TEXT;
BEGIN
  -- Verify buyer role
  SELECT role INTO buyer_role FROM public.profiles WHERE id = NEW.buyer_id;
  IF buyer_role IS NULL OR buyer_role != 'buyer' THEN
    RAISE EXCEPTION 'Only registered buyers can create purchase requests.';
  END IF;

  -- Verify farmer role
  SELECT role INTO farmer_role FROM public.profiles WHERE id = NEW.farmer_id;
  IF farmer_role IS NULL OR farmer_role != 'farmer' THEN
    RAISE EXCEPTION 'Target farmer must be a registered farmer profile.';
  END IF;

  -- Verify produce listing existence & ownership
  SELECT id, farmer_id, status, quantity INTO prod FROM public.produce WHERE id = NEW.produce_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced produce listing does not exist.';
  END IF;

  IF NEW.farmer_id != prod.farmer_id THEN
    RAISE EXCEPTION 'farmer_id must match the owner of the referenced produce.';
  END IF;

  -- Block requests for Out of Stock produce
  IF prod.status = 'Out of Stock' OR prod.quantity <= 0 THEN
    RAISE EXCEPTION 'Cannot create a purchase request for Out of Stock produce.';
  END IF;

  -- Sync buyer_note and message if one is populated and the other is not
  IF NEW.buyer_note IS NOT NULL AND NEW.message IS NULL THEN
    NEW.message := NEW.buyer_note;
  ELSIF NEW.message IS NOT NULL AND NEW.buyer_note IS NULL THEN
    NEW.buyer_note := NEW.message;
  END IF;

  -- Always initialize status to 'Pending' on creation
  NEW.status := 'Pending';
  NEW.responded_at := NULL;
  NEW.created_at := NOW();
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_buyer_request ON public.buyer_requests;
CREATE TRIGGER trg_validate_buyer_request
  BEFORE INSERT ON public.buyer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_buyer_request();

-- 4. Trigger Function: Enforce Permissions & Timestamps on UPDATE
CREATE OR REPLACE FUNCTION public.check_buyer_request_update()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  caller_id UUID := auth.uid();
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = caller_id;

  -- Admins have full moderation capability
  IF user_role = 'admin' THEN
    IF NEW.status IN ('Accepted', 'Declined') AND OLD.responded_at IS NULL THEN
      NEW.responded_at := NOW();
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Buyer Update Restrictions
  IF caller_id = OLD.buyer_id THEN
    -- Buyer cannot change immutable core parameters
    IF NEW.farmer_id != OLD.farmer_id OR 
       NEW.produce_id != OLD.produce_id OR 
       NEW.quantity != OLD.quantity OR
       NEW.price != OLD.price THEN
      RAISE EXCEPTION 'Buyers cannot modify request details after submission.';
    END IF;

    -- Buyer CANNOT Accept or Decline
    IF NEW.status IN ('Accepted', 'Declined') THEN
      RAISE EXCEPTION 'Buyers are not authorized to accept or decline requests.';
    END IF;

    -- Buyer can only Cancel a Pending request
    IF NEW.status = 'Cancelled' AND OLD.status != 'Pending' THEN
      RAISE EXCEPTION 'Only Pending requests can be cancelled.';
    END IF;
  END IF;

  -- Farmer Update Restrictions
  IF caller_id = OLD.farmer_id THEN
    -- Farmer cannot change buyer or quantity
    IF NEW.buyer_id != OLD.buyer_id OR 
       NEW.produce_id != OLD.produce_id OR 
       NEW.quantity != OLD.quantity THEN
      RAISE EXCEPTION 'Farmers cannot modify request volume or buyer information.';
    END IF;

    -- Farmer can only transition Pending -> Accepted or Declined
    IF OLD.status = 'Pending' AND NEW.status NOT IN ('Accepted', 'Declined', 'Pending') THEN
      RAISE EXCEPTION 'Farmers can only accept or decline pending requests.';
    END IF;

    -- Automatically stamp responded_at when farmer accepts or declines
    IF NEW.status IN ('Accepted', 'Declined') AND OLD.status = 'Pending' THEN
      NEW.responded_at := NOW();
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

-- 5. Row Level Security (RLS)
ALTER TABLE public.buyer_requests ENABLE ROW LEVEL SECURITY;

-- Permissions: revoke all from public/anon, grant DML to authenticated
REVOKE ALL ON public.buyer_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_requests TO authenticated;

-- Clean up existing policies
DROP POLICY IF EXISTS "Buyer requests select policy" ON public.buyer_requests;
DROP POLICY IF EXISTS "Buyers can insert their own requests" ON public.buyer_requests;
DROP POLICY IF EXISTS "Buyer requests update policy" ON public.buyer_requests;
DROP POLICY IF EXISTS "Admin only delete policy" ON public.buyer_requests;

-- Policy A: SELECT
-- - Buyers can only view their own requests.
-- - Farmers can only view requests submitted for their produce listings.
-- - Admins can view all requests across the platform.
CREATE POLICY "Buyer requests select policy"
  ON public.buyer_requests
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

-- Policy B: INSERT
-- - Authenticated buyers only (`auth.uid() = buyer_id`).
-- - User must have the 'buyer' role in public.profiles.
-- - Must target real produce owned by farmer_id that is not Out of Stock.
CREATE POLICY "Buyers can insert their own requests"
  ON public.buyer_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'buyer'
    )
    AND EXISTS (
      SELECT 1 FROM public.produce
      WHERE produce.id = produce_id
        AND produce.farmer_id = buyer_requests.farmer_id
        AND produce.status != 'Out of Stock'
        AND produce.quantity > 0
    )
  );

-- Policy C: UPDATE
-- - Farmers can accept or decline requests sent to them.
-- - Buyers can cancel their own pending requests.
-- - Admins can update any request.
CREATE POLICY "Buyer requests update policy"
  ON public.buyer_requests
  FOR UPDATE
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    (buyer_id = auth.uid() AND status = 'Pending')
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    farmer_id = auth.uid()
    OR
    (buyer_id = auth.uid() AND status = 'Cancelled')
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy D: DELETE
-- Restricted to Platform Admins only
CREATE POLICY "Admin only delete policy"
  ON public.buyer_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 6. Supabase Realtime Setup
ALTER TABLE public.buyer_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'buyer_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_requests;
  END IF;
END $$;

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
