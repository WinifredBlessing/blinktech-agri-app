-- =============================================================
-- AgriLink: Produce Table Verification + Fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- STEP 1: Check if the produce table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'produce'
    ) 
    THEN '✅ public.produce EXISTS'
    ELSE '❌ public.produce DOES NOT EXIST — table was never created!'
  END AS table_status;

-- STEP 2: Check RLS policies on produce
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'produce'
ORDER BY policyname;

-- STEP 3: Check triggers on produce
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'produce'
ORDER BY trigger_name;

-- STEP 4: Check if produce is in Realtime publication
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'produce';

-- STEP 5: If table does NOT exist yet — run the full schema below
-- (If table already exists, skip to STEP 6)

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_produce_farmer_id ON public.produce(farmer_id);
CREATE INDEX IF NOT EXISTS idx_produce_status ON public.produce(status);
CREATE INDEX IF NOT EXISTS idx_produce_category ON public.produce(category);
CREATE INDEX IF NOT EXISTS idx_produce_created_at ON public.produce(created_at DESC);

-- Trigger: enforce farmer role
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

-- Trigger: auto-update updated_at
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

-- RLS
ALTER TABLE public.produce ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.produce FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produce TO authenticated;

-- Drop old policies if exist
DROP POLICY IF EXISTS "Produce select policy" ON public.produce;
DROP POLICY IF EXISTS "Farmers can insert produce" ON public.produce;
DROP POLICY IF EXISTS "Produce update policy" ON public.produce;
DROP POLICY IF EXISTS "Produce delete policy" ON public.produce;

-- SELECT: farmers see own, admins see all, buyers see active
CREATE POLICY "Produce select policy"
  ON public.produce FOR SELECT TO authenticated
  USING (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR status IN ('Available', 'Limited', 'Low Stock')
  );

-- INSERT: only farmers, only for themselves
CREATE POLICY "Farmers can insert produce"
  ON public.produce FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = farmer_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'farmer')
  );

-- UPDATE: farmers own rows, admins any
CREATE POLICY "Produce update policy"
  ON public.produce FOR UPDATE TO authenticated
  USING (
    (farmer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- DELETE: farmers own rows, admins any
CREATE POLICY "Produce delete policy"
  ON public.produce FOR DELETE TO authenticated
  USING (
    (farmer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Realtime
ALTER TABLE public.produce REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'produce'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produce;
  END IF;
END $$;

-- STEP 6: Force PostgREST schema cache reload (CRITICAL)
NOTIFY pgrst, 'reload schema';

-- STEP 7: Final confirmation
SELECT 
  '✅ Schema setup complete. public.produce is ready.' AS final_status,
  (SELECT COUNT(*) FROM public.produce) AS existing_rows;
