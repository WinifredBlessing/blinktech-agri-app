-- ==============================================================================
-- AgriLink: farmer_payout_accounts schema (standalone copy for SQL Editor)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- This is the same content as the migration file but formatted for manual paste.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.farmer_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  masked_account_number TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'not_verified'
    CHECK (verification_status IN ('not_verified', 'verifying', 'verified', 'failed')),
  paystack_subaccount_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_payout_accounts_farmer_id
  ON public.farmer_payout_accounts (farmer_id);

CREATE INDEX IF NOT EXISTS idx_farmer_payout_accounts_verification_status
  ON public.farmer_payout_accounts (verification_status);

ALTER TABLE public.farmer_payout_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.farmer_payout_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.farmer_payout_accounts TO authenticated;

DROP POLICY IF EXISTS "Farmer payout accounts select policy" ON public.farmer_payout_accounts;
DROP POLICY IF EXISTS "Farmer payout accounts insert policy" ON public.farmer_payout_accounts;
DROP POLICY IF EXISTS "Farmer payout accounts update policy" ON public.farmer_payout_accounts;

CREATE POLICY "Farmer payout accounts select policy"
  ON public.farmer_payout_accounts FOR SELECT TO authenticated
  USING (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Farmer payout accounts insert policy"
  ON public.farmer_payout_accounts FOR INSERT TO authenticated
  WITH CHECK (
    farmer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'farmer')
  );

CREATE POLICY "Farmer payout accounts update policy"
  ON public.farmer_payout_accounts FOR UPDATE TO authenticated
  USING (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.set_farmer_payout_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_farmer_payout_accounts_updated_at ON public.farmer_payout_accounts;

CREATE TRIGGER trg_farmer_payout_accounts_updated_at
  BEFORE UPDATE ON public.farmer_payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_farmer_payout_account_updated_at();

ALTER TABLE public.farmer_payout_accounts REPLICA IDENTITY FULL;

-- Verification queries (optional)
-- SELECT * FROM public.farmer_payout_accounts LIMIT 5;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'farmer_payout_accounts';
