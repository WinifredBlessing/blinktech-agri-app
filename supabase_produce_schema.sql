-- ==============================================================================
-- AgriLink Supabase Produce Table, RLS Policies & Realtime Setup
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New query -> Paste and click "Run"
-- ==============================================================================

-- 1. Create the produce table
CREATE TABLE IF NOT EXISTS public.produce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  state TEXT,
  lga TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  harvest_date DATE,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Limited', 'Low Stock', 'Out of Stock')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for search, filter, and join performance
CREATE INDEX IF NOT EXISTS idx_produce_farmer_id ON public.produce(farmer_id);
CREATE INDEX IF NOT EXISTS idx_produce_status ON public.produce(status);
CREATE INDEX IF NOT EXISTS idx_produce_category ON public.produce(category);
CREATE INDEX IF NOT EXISTS idx_produce_created_at ON public.produce(created_at DESC);

-- 2. Trigger: Enforce that only users with the 'farmer' role can own produce
CREATE OR REPLACE FUNCTION public.check_produce_farmer_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.farmer_id AND role = 'farmer'
  ) THEN
    RAISE EXCEPTION 'Only registered users with the farmer role can own produce.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_produce_farmer_role ON public.produce;
CREATE TRIGGER trg_check_produce_farmer_role
  BEFORE INSERT OR UPDATE OF farmer_id ON public.produce
  FOR EACH ROW
  EXECUTE FUNCTION public.check_produce_farmer_role();

-- 3. Trigger: Maintain updated_at timestamp on record modification
CREATE OR REPLACE FUNCTION public.set_produce_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_produce_updated_at ON public.produce;
CREATE TRIGGER trg_set_produce_updated_at
  BEFORE UPDATE ON public.produce
  FOR EACH ROW
  EXECUTE FUNCTION public.set_produce_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.produce ENABLE ROW LEVEL SECURITY;

-- Permissions & Grants: revoke from anon, grant to authenticated
REVOKE ALL ON public.produce FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produce TO authenticated;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Produce select policy" ON public.produce;
DROP POLICY IF EXISTS "Farmers can insert produce" ON public.produce;
DROP POLICY IF EXISTS "Produce update policy" ON public.produce;
DROP POLICY IF EXISTS "Produce delete policy" ON public.produce;

-- Policy A: SELECT
-- - Farmers can view all their own produce (any status).
-- - Admins can view all produce across the platform (any status).
-- - Buyers & authenticated users can view active available produce.
CREATE POLICY "Produce select policy"
  ON public.produce
  FOR SELECT
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR
    status IN ('Available', 'Limited', 'Low Stock')
  );

-- Policy B: INSERT
-- Authenticated farmers can ONLY create produce records for themselves.
-- Blocked if user is a buyer, admin, or attempting to set another farmer's ID.
CREATE POLICY "Farmers can insert produce"
  ON public.produce
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = farmer_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    )
  );

-- Policy C: UPDATE
-- - Farmers can update their own produce.
-- - Admins can update any produce (e.g. moderation, status flags).
CREATE POLICY "Produce update policy"
  ON public.produce
  FOR UPDATE
  TO authenticated
  USING (
    (farmer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    farmer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy D: DELETE
-- - Farmers can delete their own produce.
-- - Admins can delete any produce.
CREATE POLICY "Produce delete policy"
  ON public.produce
  FOR DELETE
  TO authenticated
  USING (
    (farmer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    ))
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 5. Enable Supabase Realtime on public.produce
-- Full replica identity allows DELETE and UPDATE events to broadcast old row attributes
ALTER TABLE public.produce REPLICA IDENTITY FULL;

-- Add produce table to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'produce'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produce;
  END IF;
END $$;

-- 6. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
