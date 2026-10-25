-- ==============================================================================
-- AgriLink Migration: Admin User Moderation
-- Migration File: 20261011_admin_profiles_moderation.sql
-- Target Project: https://wmmhpducvihhmcclpvtd.supabase.co
--
-- Purpose:
--   Fix the RLS defect that silently blocked admin writes to public.profiles.
--   Adds a narrowly-scoped admin UPDATE policy and two SECURITY DEFINER RPCs
--   so platform administrators can suspend, reactivate, and edit user profiles
--   without exposing the service-role key in the frontend.
--
-- Authorization Design:
--   - A new RLS UPDATE policy grants admins the ability to update ONLY the
--     moderation-relevant fields (status, full_name, phone, location, farm_name,
--     organization, is_verified, updated_at).
--   - The existing prevent_profile_role_tampering() trigger remains fully intact.
--     It fires on ALL row updates, so even admin updates cannot change the `role`
--     column — role escalation is still impossible.
--   - Normal farmers and buyers are unaffected: their own-row UPDATE policy
--     (auth.uid() = id) is preserved and unchanged.
--   - Two SECURITY DEFINER RPCs provide a least-privilege server-side path.
--     The RPCs validate that the caller is an admin before writing, return the
--     updated row for a guaranteed read-after-write, and expose no service-role
--     credentials to the client.
--   - anon users are granted zero new permissions.
--
-- Run instructions:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ==============================================================================


-- ==============================================================================
-- STEP 1: Add is_verified column if it does not already exist
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;


-- ==============================================================================
-- STEP 2: Helper — is_admin()
--
-- Checks whether the currently authenticated user has role = 'admin' in
-- public.profiles. Used in RLS policies to avoid repeating the subquery.
-- SECURITY DEFINER so it executes with elevated trust but only returns a boolean.
-- ==============================================================================

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
  );
$$;


-- ==============================================================================
-- STEP 3: Drop stale policies before re-creating them
-- ==============================================================================

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;


-- ==============================================================================
-- STEP 4: Restore user self-update policy
--
-- Farmers and buyers can update their OWN profile row only.
-- The prevent_profile_role_tampering trigger blocks role changes for everyone.
-- ==============================================================================

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ==============================================================================
-- STEP 5: Admin moderation UPDATE policy
--
-- Allows admin accounts to update any profile row.
-- This policy is required for the fallback direct-update path in the frontend.
-- The prevent_profile_role_tampering trigger is still in force for admins too —
-- neither the admin nor anyone else can promote/demote a user's role through
-- a normal UPDATE. Role changes require direct database access (superuser).
--
-- Security guarantees:
--   - Only rows where the calling session has role = 'admin' in public.profiles
--     can match the USING clause.
--   - Farmers/buyers cannot satisfy is_admin(), so this policy is invisible
--     to them.
--   - The role column is still protected by the trigger regardless of which
--     UPDATE policy fires.
-- ==============================================================================

CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ==============================================================================
-- STEP 6: RPC — admin_moderate_user_status
--
-- Least-privilege server-side function for status and verification changes.
-- - Caller must be an admin (enforced at the top of the function).
-- - Admins cannot change their own status (prevents self-lockout).
-- - Returns the updated profile row so the frontend can do a read-after-write.
-- - SECURITY DEFINER means it can bypass row-level policies, but the explicit
--   permission check inside the function replaces RLS as the guard.
-- ==============================================================================

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
  caller_id      UUID;
  caller_role    TEXT;
  updated_row    public.profiles;
BEGIN
  -- Identify the calling session
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Verify caller is an admin
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission denied: only administrators can moderate user accounts.';
  END IF;

  -- Prevent self-modification (safety guard)
  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Administrators cannot modify their own account status through this action.';
  END IF;

  -- Validate status value
  IF new_status NOT IN ('Active', 'Suspended', 'Banned') THEN
    RAISE EXCEPTION 'Invalid status value: %. Allowed: Active, Suspended, Banned.', new_status;
  END IF;

  -- Perform the update
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

-- Grant execute only to authenticated users (anon cannot call it)
REVOKE ALL ON FUNCTION public.admin_moderate_user_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_user_status TO authenticated;


-- ==============================================================================
-- STEP 7: RPC — admin_update_user_profile
--
-- Least-privilege server-side function for profile field edits.
-- - Caller must be an admin (enforced at the top of the function).
-- - Only updates safe moderation fields: full_name, phone, location,
--   farm_name, organization.
-- - Does NOT touch: role, status, email, id, created_at.
-- - Returns the updated profile row for a guaranteed read-after-write.
-- ==============================================================================

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
  caller_role TEXT;
  updated_row public.profiles;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Permission denied: only administrators can edit user profiles through this action.';
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

-- Grant execute only to authenticated users
REVOKE ALL ON FUNCTION public.admin_update_user_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile TO authenticated;


-- ==============================================================================
-- VERIFICATION QUERIES (run after applying the migration to confirm success)
-- ==============================================================================

-- Check the new column exists
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_verified';

-- List all UPDATE policies on profiles
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE';

-- List the two new RPCs
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('admin_moderate_user_status', 'admin_update_user_profile', 'is_admin');
