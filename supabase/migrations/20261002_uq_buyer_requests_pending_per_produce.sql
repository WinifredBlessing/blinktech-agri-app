-- Migration: Add partial unique index to prevent duplicate Pending buyer requests
-- for the same (buyer_id, produce_id) combination.
--
-- A duplicate check was run directly in Supabase before this file was created:
-- Result: No rows returned — confirming zero existing duplicates.
--
-- This index is a PARTIAL index: it only applies when status = 'Pending'.
-- Accepted, Declined, and Cancelled rows are NOT affected by this constraint.
--
-- DO NOT EXECUTE this file manually. Apply via Supabase Migrations (supabase db push).
-- DO NOT modify the base schema file (schema.sql) for this change.

CREATE UNIQUE INDEX uq_buyer_requests_pending_per_produce
  ON public.buyer_requests (buyer_id, produce_id)
  WHERE status = 'Pending';
