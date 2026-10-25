-- ==============================================================================
-- AgriLink Supabase Profiles Table, RLS Policies & Hardened Security Setup
-- ==============================================================================
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New query -> Paste and click "Run"
-- ==============================================================================

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'buyer', 'admin')),
  phone TEXT,
  buyer_type TEXT,
  farm_name TEXT,
  organization TEXT,
  location TEXT,
  state TEXT,
  city TEXT,
  lga TEXT,
  address TEXT,
  description TEXT,
  farming_type TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Permissions & Grants
-- Ensure unauthenticated (anon) users have NO direct access to profiles
REVOKE ALL ON public.profiles FROM anon;

-- Grant minimal necessary DML privileges to authenticated users (governed by RLS)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- 4. Clean up any existing policies
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 5. Define Hardened RLS Policies

-- Policy A: SELECT
-- Only authenticated users can read profiles.
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy B: INSERT
-- Authenticated users can ONLY insert their own profile row.
-- Role is strictly restricted to 'farmer' or 'buyer' (cannot self-assign 'admin').
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role IN ('farmer', 'buyer')
  );

-- Policy C: UPDATE
-- Authenticated users can ONLY update their own profile row.
-- Role escalation is strictly blocked at the database level by the BEFORE UPDATE trigger.
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Trigger to Prevent Users from Changing Their Own Role
-- Ensures that whenever a user updates their profile, their assigned role cannot be modified.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent role escalation: Always preserve the existing role on client updates
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  -- Maintain updated_at timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_tampering ON public.profiles;

CREATE TRIGGER trg_prevent_profile_role_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_tampering();

-- 7. Automatic Profile Creation Function & Trigger
-- Automatically executes on auth.users signup.
-- Strictly enforces that public signups can ONLY become 'farmer' or 'buyer'.
-- Any other role request (including 'admin') strictly defaults to 'farmer'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  assigned_role TEXT;
  extracted_name TEXT;
  extracted_phone TEXT;
  extracted_buyer_type TEXT;
  extracted_farm_name TEXT;
  extracted_organization TEXT;
  extracted_location TEXT;
  extracted_state TEXT;
  extracted_city TEXT;
  extracted_lga TEXT;
  extracted_address TEXT;
  extracted_description TEXT;
  extracted_farming_type TEXT;
BEGIN
  -- Extract requested role from auth metadata
  requested_role := LOWER(COALESCE(
    NEW.raw_user_meta_data->>'role',
    'farmer'
  ));

  -- SECURITY ENFORCEMENT:
  -- Public signup can ONLY create 'farmer' or 'buyer'.
  -- If 'farmer', assign 'farmer'.
  -- If 'buyer', assign 'buyer'.
  -- For ANY other value (including 'admin' or arbitrary strings), strictly default to 'farmer'.
  IF requested_role = 'buyer' THEN
    assigned_role := 'buyer';
  ELSIF requested_role = 'farmer' THEN
    assigned_role := 'farmer';
  ELSE
    assigned_role := 'farmer';
  END IF;

  -- Extract user display name
  extracted_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Extract all supported profile fields from metadata
  extracted_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  extracted_buyer_type := COALESCE(
    NEW.raw_user_meta_data->>'buyerType',
    NEW.raw_user_meta_data->>'buyer_type',
    ''
  );
  extracted_farm_name := COALESCE(
    NEW.raw_user_meta_data->>'farmName',
    NEW.raw_user_meta_data->>'farm_name',
    CASE WHEN assigned_role = 'farmer' THEN extracted_name || '''s Farm' ELSE NULL END
  );
  extracted_organization := COALESCE(
    NEW.raw_user_meta_data->>'organization',
    CASE WHEN assigned_role = 'buyer' THEN extracted_name ELSE NULL END
  );
  extracted_location := COALESCE(NEW.raw_user_meta_data->>'location', '');
  extracted_state := COALESCE(NEW.raw_user_meta_data->>'state', '');
  extracted_city := COALESCE(NEW.raw_user_meta_data->>'city', '');
  extracted_lga := COALESCE(NEW.raw_user_meta_data->>'lga', '');
  extracted_address := COALESCE(NEW.raw_user_meta_data->>'address', '');
  extracted_description := COALESCE(NEW.raw_user_meta_data->>'description', '');
  extracted_farming_type := COALESCE(
    NEW.raw_user_meta_data->>'farmingType',
    NEW.raw_user_meta_data->>'farming_type',
    ''
  );

  -- Insert profile record
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    phone,
    buyer_type,
    farm_name,
    organization,
    location,
    state,
    city,
    lga,
    address,
    description,
    farming_type,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    extracted_name,
    NEW.email,
    assigned_role,
    extracted_phone,
    extracted_buyer_type,
    extracted_farm_name,
    extracted_organization,
    extracted_location,
    extracted_state,
    extracted_city,
    extracted_lga,
    extracted_address,
    extracted_description,
    extracted_farming_type,
    'Active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    buyer_type = EXCLUDED.buyer_type,
    farm_name = EXCLUDED.farm_name,
    organization = EXCLUDED.organization,
    location = EXCLUDED.location,
    state = EXCLUDED.state,
    city = EXCLUDED.city,
    lga = EXCLUDED.lga,
    address = EXCLUDED.address,
    description = EXCLUDED.description,
    farming_type = EXCLUDED.farming_type,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
