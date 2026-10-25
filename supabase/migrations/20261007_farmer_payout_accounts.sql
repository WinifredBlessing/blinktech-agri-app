-- ==============================================================================
-- AgriLink Migration: farmer_payout_accounts table
-- Migration File: 20261007_farmer_payout_accounts.sql
-- Purpose: Secure storage of verified farmer bank payout account details.
--          The raw account number is NEVER stored here.
--          Only masked account numbers (e.g. ****6789) are client-readable.
-- Run: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ==============================================================================

-- ==============================================================================
-- 1. CREATE TABLE: public.farmer_payout_accounts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.farmer_payout_accounts (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One payout account record per farmer (enforced by UNIQUE)
  farmer_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Bank identification (from Paystack bank list)
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,

  -- Verified account holder name returned by Paystack
  account_name TEXT NOT NULL,

  -- Masked account number for display only, e.g. ****6789
  -- The raw account number is NEVER stored in this table.
  masked_account_number TEXT NOT NULL,

  -- Verification lifecycle status
  verification_status TEXT NOT NULL DEFAULT 'not_verified'
    CHECK (verification_status IN ('not_verified', 'verifying', 'verified', 'failed')),

  -- Reserved for future Paystack subaccount integration (Stage 2+).
  -- DO NOT populate or use this field in Stage 1.
  paystack_subaccount_code TEXT,

  -- Soft-delete / deactivation flag for future multi-account history support
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. INDEXES
-- ==============================================================================

-- farmer_id is already indexed by the UNIQUE constraint.
-- Additional composite indexes for admin/analytics queries.
CREATE INDEX IF NOT EXISTS idx_farmer_payout_accounts_farmer_id
  ON public.farmer_payout_accounts (farmer_id);

CREATE INDEX IF NOT EXISTS idx_farmer_payout_accounts_verification_status
  ON public.farmer_payout_accounts (verification_status);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.farmer_payout_accounts ENABLE ROW LEVEL SECURITY;

-- Anonymous users have NO access whatsoever
REVOKE ALL ON public.farmer_payout_accounts FROM anon;

-- Grant DML to authenticated users (governed strictly by RLS policies below)
GRANT SELECT, INSERT, UPDATE ON public.farmer_payout_accounts TO authenticated;

-- Clean up any pre-existing policies (idempotent)
DROP POLICY IF EXISTS "Farmer payout accounts select policy" ON public.farmer_payout_accounts;
DROP POLICY IF EXISTS "Farmer payout accounts insert policy" ON public.farmer_payout_accounts;
DROP POLICY IF EXISTS "Farmer payout accounts update policy" ON public.farmer_payout_accounts;
DROP POLICY IF EXISTS "Farmer payout accounts admin select policy" ON public.farmer_payout_accounts;

-- Policy A: SELECT
-- A farmer can only read their OWN payout account record.
-- Platform admins can read all records.
-- No other user can read another farmer's payout account.
CREATE POLICY "Farmer payout accounts select policy"
  ON public.farmer_payout_accounts
  FOR SELECT
  TO authenticated
  USING (
    farmer_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Policy B: INSERT
-- A farmer can only insert a record where farmer_id = auth.uid().
-- They cannot insert a record for another farmer.
CREATE POLICY "Farmer payout accounts insert policy"
  ON public.farmer_payout_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    farmer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'farmer'
    )
  );

-- Policy C: UPDATE
-- A farmer can only update their own record.
-- Admins can update any record (for support/moderation).
CREATE POLICY "Farmer payout accounts update policy"
  ON public.farmer_payout_accounts
  FOR UPDATE
  TO authenticated
  USING (
    farmer_id = auth.uid()
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

-- ==============================================================================
-- 4. TRIGGER: auto-maintain updated_at timestamp
-- ==============================================================================

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
  FOR EACH ROW
  EXECUTE FUNCTION public.set_farmer_payout_account_updated_at();

-- ==============================================================================
-- 5. REALTIME (optional, for future real-time UI updates)
-- ==============================================================================

ALTER TABLE public.farmer_payout_accounts REPLICA IDENTITY FULL;

-- ==============================================================================
-- SUMMARY:
-- Table: public.farmer_payout_accounts
-- RLS:   Enabled — farmers can only read/write their own record
-- Raw account number: NEVER stored — only masked_account_number is kept
-- paystack_subaccount_code: nullable, reserved for Stage 2
-- ==============================================================================
