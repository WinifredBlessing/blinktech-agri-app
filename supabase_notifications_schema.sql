-- ==============================================================================
-- AgriLink Supabase Notifications Table, Security, RPC & Realtime Setup
-- ==============================================================================
-- Migration File : supabase_notifications_schema.sql
-- Architecture   : 1.0
-- Run this script in your Supabase Dashboard:
--   SQL Editor → New query → Paste → Run
--
-- SAFETY NOTICE:
--   - This script does NOT alter public.orders, public.profiles, public.produce,
--     public.buyer_requests, or public.logistics_requests.
--   - No existing RLS policies, triggers, or RPCs are modified.
--   - No existing Realtime configuration is changed.
--   - All elevated operations use SECURITY DEFINER with SET search_path = public.
--   - No service-role key is used or required anywhere in this script.
-- ==============================================================================


-- ==============================================================================
-- SECTION 1: CREATE TABLE public.notifications
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (

  -- ── Primary Identifier ──────────────────────────────────────────────────────
  -- Real UUID primary key — consistent with profiles, produce, buyer_requests,
  -- orders, and logistics_requests.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Recipient ───────────────────────────────────────────────────────────────
  -- The user who should see this notification.
  -- ON DELETE CASCADE: if a user account is deleted, their notifications go too.
  -- This is consistent with how buyer_id / farmer_id cascade in orders and
  -- logistics_requests.
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ── Notification Classification ─────────────────────────────────────────────
  -- Mirrors the existing type strings already used throughout MarketplaceContext:
  --   'new_request'       — farmer receives new buyer purchase request
  --   'request_submitted' — buyer's own submission confirmation
  --   'request_accepted'  — buyer learns their request was accepted
  --   'request_declined'  — buyer learns their request was declined
  --   'order_created'     — farmer learns an order was generated
  --   'order_status'      — buyer or farmer receives order status update
  --   'logistics_requested' — buyer/farmer: delivery request created
  --   'logistics_update'  — buyer/farmer: logistics status milestone
  -- Additional types can be added to the CHECK list as the product grows.
  type TEXT NOT NULL CHECK (type IN (
    'new_request',
    'request_submitted',
    'request_accepted',
    'request_declined',
    'order_created',
    'order_status',
    'logistics_requested',
    'logistics_update'
  )),

  -- ── Display Content ──────────────────────────────────────────────────────────
  title   TEXT NOT NULL,                              -- Short heading, e.g. "Request Accepted"
  message TEXT NOT NULL,                              -- Full notification body text

  -- ── Navigation Link ──────────────────────────────────────────────────────────
  -- Optional React-Router path the notification card links to.
  -- Examples: '/buyer/requests', '/farmer/orders', '/logistics'
  link TEXT,

  -- ── Related Entity Reference ─────────────────────────────────────────────────
  -- The UUID of the entity that triggered this notification (request, order,
  -- or logistics record). Used by the frontend to build deep-links.
  -- Nullable because some informational notifications may have no single entity.
  related_id UUID,

  -- ── Read State ───────────────────────────────────────────────────────────────
  is_read   BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at   TIMESTAMPTZ,              -- Stamped when is_read is flipped to TRUE

  -- ── Timestamp ────────────────────────────────────────────────────────────────
  -- Consistent with every other AgriLink table:
  --   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Notifications are immutable after creation — there is no updated_at column
  -- because the only mutable field (is_read / read_at) is stamped by the
  -- mark_notification_read RPC, not by a generic UPDATE trigger.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- ==============================================================================
-- SECTION 2: INDEXES
-- ==============================================================================

-- Primary access pattern: fetch all notifications for a recipient, newest first.
-- This composite index covers the common WHERE recipient_id = ? ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);

-- Unread count lookup: WHERE recipient_id = ? AND is_read = FALSE
-- Supports the header bell badge count query efficiently.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_id, is_read)
  WHERE is_read = FALSE;


-- ==============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Anonymous users: ZERO access — consistent with all other AgriLink tables.
REVOKE ALL ON public.notifications FROM anon;

-- Direct INSERT is REVOKED from ALL authenticated users.
-- The ONLY path to create a notification is the SECURITY DEFINER RPC
-- create_notification() defined in Section 4 below.
-- This prevents a user from directly inserting a notification for another user.
REVOKE INSERT ON public.notifications FROM authenticated;

-- Grant SELECT, UPDATE, DELETE to authenticated users (governed by RLS policies below).
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

-- Remove any pre-existing policies before creating clean ones.
DROP POLICY IF EXISTS "Notifications select policy"        ON public.notifications;
DROP POLICY IF EXISTS "Notifications update policy"        ON public.notifications;
DROP POLICY IF EXISTS "Notifications admin delete policy"  ON public.notifications;

-- ── Policy A: SELECT ──────────────────────────────────────────────────────────
-- Users can ONLY read notifications addressed to them.
-- Admins can read all notifications for support/moderation purposes.
CREATE POLICY "Notifications select policy"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Policy B: UPDATE ──────────────────────────────────────────────────────────
-- Users can ONLY update their own notifications — and only to mark them as read.
-- Field-level immutability (preventing tampering with type/title/message/related_id)
-- is enforced by the trg_enforce_notification_update trigger in Section 5.
-- Admins can also update any notification (for support/moderation).
CREATE POLICY "Notifications update policy"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Policy C: DELETE ──────────────────────────────────────────────────────────
-- Restricted to Platform Admins ONLY — consistent with orders and logistics.
-- Regular users cannot delete notification records.
CREATE POLICY "Notifications admin delete policy"
  ON public.notifications
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
-- SECTION 4: FIELD IMMUTABILITY TRIGGER
-- ==============================================================================
-- Prevents modification of identity and content fields after creation.
-- Users can ONLY change is_read and read_at — nothing else.
-- Automatically stamps read_at when is_read is flipped to TRUE.
-- Consistent with enforce_order_update_security and
-- enforce_logistics_update_security patterns.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_notification_update_security()
RETURNS TRIGGER AS $$
DECLARE
  caller_id UUID := auth.uid();
  user_role TEXT;
BEGIN
  -- Retrieve caller role
  SELECT role INTO user_role FROM public.profiles WHERE id = caller_id;

  -- Admins may update any field on any notification (support/moderation)
  IF user_role = 'admin' THEN
    -- Auto-stamp read_at when admin marks as read
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE AND NEW.read_at IS NULL THEN
      NEW.read_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  -- ── Identity / Content Immutability (for non-admin callers) ─────────────────
  -- These fields CANNOT be changed after creation by any regular user.
  IF NEW.id           IS DISTINCT FROM OLD.id           OR
     NEW.recipient_id IS DISTINCT FROM OLD.recipient_id OR
     NEW.type         IS DISTINCT FROM OLD.type         OR
     NEW.title        IS DISTINCT FROM OLD.title        OR
     NEW.message      IS DISTINCT FROM OLD.message      OR
     NEW.link         IS DISTINCT FROM OLD.link         OR
     NEW.related_id   IS DISTINCT FROM OLD.related_id   OR
     NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION
      'Notification identity and content fields are immutable after creation. '
      'Only is_read and read_at may be changed.';
  END IF;

  -- ── Auto-stamp read_at when is_read is flipped TRUE ─────────────────────────
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    NEW.read_at := NOW();
  END IF;

  -- ── Prevent un-reading a notification ────────────────────────────────────────
  -- Once read, a notification cannot be reverted to unread by a regular user.
  IF NEW.is_read = FALSE AND OLD.is_read = TRUE THEN
    RAISE EXCEPTION
      'Notifications cannot be reverted from read to unread.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_notification_update_security
  ON public.notifications;

CREATE TRIGGER trg_enforce_notification_update_security
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_notification_update_security();


-- ==============================================================================
-- SECTION 5: RPC — create_notification
-- ==============================================================================
-- SECURITY DEFINER function. The SOLE trusted path for inserting a notification
-- for another user (e.g. buyer creates a request → farmer gets notified).
--
-- In a single atomic operation this function:
--   1. Rejects unauthenticated callers
--   2. Validates required inputs are non-empty
--   3. Validates the recipient_id references a real profile
--   4. Validates the notification type is an allowed value
--   5. Inserts exactly one notifications row
--   6. Returns the new row
--
-- Because INSERT is REVOKED from authenticated on the notifications table,
-- this SECURITY DEFINER function (running as the table owner) is the only
-- mechanism that can write a row. This prevents any user from directly
-- inserting a notification for another user.
--
-- The caller does NOT need to supply a recipient who is themselves — the
-- function is intentionally designed to allow cross-user notification delivery,
-- which is the core business requirement (buyer action → farmer notification).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id UUID,
  p_type         TEXT,
  p_title        TEXT,
  p_message      TEXT,
  p_link         TEXT    DEFAULT NULL,
  p_related_id   UUID    DEFAULT NULL
)
RETURNS public.notifications AS $$
DECLARE
  caller_id  UUID;
  v_new_row  public.notifications%ROWTYPE;
BEGIN
  -- 1. Authenticate caller — anon execution is rejected
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION
      'Authentication required: You must be logged in to create a notification.';
  END IF;

  -- 2. Validate required inputs are non-empty
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

  -- 3. Validate notification type is an allowed value
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
      'create_notification: Unknown notification type "%". '
      'Allowed values: new_request, request_submitted, request_accepted, '
      'request_declined, order_created, order_status, logistics_requested, '
      'logistics_update.',
      p_type;
  END IF;

  -- 4. Validate the recipient exists in public.profiles
  --    Prevents creating orphaned notifications for non-existent users.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_recipient_id
  ) THEN
    RAISE EXCEPTION
      'create_notification: Recipient profile % not found.', p_recipient_id;
  END IF;

  -- 5. Insert the notification row.
  --    INSERT privilege on this table is held by the function owner (SECURITY
  --    DEFINER), not by the calling authenticated user. This is intentional —
  --    it is the mechanism that allows cross-user notification delivery.
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
    p_title,
    p_message,
    p_link,
    p_related_id,
    FALSE,
    NOW()
  )
  RETURNING * INTO v_new_row;

  -- 6. Return the newly created notification record
  RETURN v_new_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public and anonymous — consistent with all other AgriLink RPCs
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM anon;

-- Grant execution to authenticated users only
-- (function self-verifies auth.uid() is not null)
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO authenticated;


-- ==============================================================================
-- SECTION 6: SUPABASE REALTIME CONFIGURATION
-- ==============================================================================

-- REPLICA IDENTITY FULL required so UPDATE and DELETE Realtime events broadcast
-- the complete previous AND new row data to all subscribers.
-- Consistent with orders, buyer_requests, and logistics_requests.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Idempotent: add notifications to the supabase_realtime publication
-- only if it is not already a member. Consistent with all other AgriLink tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Tell PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';


-- ==============================================================================
-- SECTION 7: VERIFICATION QUERIES
-- Run these individually in the SQL Editor AFTER the migration to confirm setup.
-- ==============================================================================
/*

-- V1. Table existence
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'notifications';

-- V2. All columns, data types, nullability, defaults
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- V3. CHECK constraint on type
SELECT
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name    = cc.constraint_name
 AND tc.constraint_schema  = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'notifications';

-- V4. Foreign key constraints
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name  AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name   = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name   = rc.constraint_name
 AND tc.constraint_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
 AND ccu.constraint_schema     = tc.constraint_schema
WHERE tc.table_schema    = 'public'
  AND tc.table_name      = 'notifications'
  AND tc.constraint_type = 'FOREIGN KEY';

-- V5. All indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY indexname;

-- V6. RLS enabled
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.notifications'::regclass;

-- V7. RLS policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY policyname;

-- V8. Trigger on notifications
SELECT
  t.tgname    AS trigger_name,
  t.tgenabled AS enabled,
  p.proname   AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid      = 'public.notifications'::regclass
  AND t.tgisinternal = FALSE;

-- V9. RPC function — existence, SECURITY DEFINER flag, search_path
SELECT
  p.proname                                 AS function_name,
  p.prosecdef                               AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid)             AS return_type,
  p.proconfig                               AS config  -- should include search_path=public
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname  = 'public'
  AND p.proname  = 'create_notification';

-- V10. Realtime publication membership
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';

-- V11. REPLICA IDENTITY setting (must be 'f' = FULL)
SELECT relname, relreplident
FROM pg_class
WHERE oid = 'public.notifications'::regclass;
-- Expected: relreplident = 'f'  (FULL)
-- Bad:      relreplident = 'd'  (DEFAULT)

-- V12. Privilege grants — confirm INSERT is NOT granted to authenticated or anon
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name   = 'notifications'
ORDER BY grantee, privilege_type;
-- Expected: authenticated has SELECT, UPDATE, DELETE — NOT INSERT
-- Expected: anon has NOTHING

-- V13. RPC execute privilege — confirm authenticated CAN execute, anon CANNOT
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name   = 'create_notification'
ORDER BY grantee;
-- Expected: authenticated has EXECUTE
-- Expected: anon does NOT appear

-- V14. Existing tables unmodified — confirm no schema changes to other tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles','produce','buyer_requests','orders','logistics_requests','notifications')
ORDER BY table_name;

*/
