-- ==============================================================================
-- AgriLink Migration: Prevent Duplicate Pending Buyer Requests Per Produce
-- ==============================================================================
-- File: supabase_buyer_requests_unique_pending_index.sql
-- Purpose:
--   Ensures that a buyer cannot have more than one 'Pending' purchase request
--   for the exact same produce listing simultaneously.
--
-- Safety & Behavior:
--   - Partial unique index: only constrains rows where status = 'Pending'.
--   - Does NOT block legitimate subsequent requests once a prior request is
--     Accepted, Declined, or Cancelled.
--   - Does NOT affect existing non-pending records.
--   - Zero modifications or deletions to existing data.
--   - Raises PostgreSQL error code 23505 (unique_violation) on duplicate attempts.
--
-- To execute manually in Supabase:
--   Dashboard -> SQL Editor -> New query -> Paste -> Run
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_requests_pending_per_produce
ON public.buyer_requests (buyer_id, produce_id)
WHERE status = 'Pending';
