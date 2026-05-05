-- Migration: Update profiles table for Storage-based avatars and JSONB preferences
-- Run this SQL in your Supabase SQL Editor

-- First, let's backup existing data by creating a temporary table
CREATE TEMP TABLE profiles_backup AS 
SELECT * FROM public.profiles;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Drop the existing profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create the new profiles table with Storage support
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT GENERATED ALWAYS AS (COALESCE((auth.jwt() ->> 'email'), NULL)) STORED, -- optional convenience
  display_name TEXT,
  avatar_path TEXT,                 -- e.g. 'avatars/<uid>/avatar.png'
  prefs JSONB NOT NULL DEFAULT '{}'::JSONB,  -- user preferences
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage only their row
CREATE POLICY "profiles select own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles insert own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service_role everything (it already bypasses RLS, but explicit grants are fine)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Migrate existing data from backup
INSERT INTO public.profiles (id, display_name, avatar_path, prefs, created_at, updated_at)
SELECT 
  id,
  COALESCE(full_name, username) as display_name,
  avatar_url as avatar_path,  -- This will be migrated to Storage later
  jsonb_build_object(
    'timezone', timezone,
    'notify_product', notify_product,
    'notify_security', notify_security,
    'onboarding_complete', onboarding_complete,
    'twofa_enabled', twofa_enabled,
    'purpose', purpose
  ) as prefs,
  created_at,
  updated_at
FROM profiles_backup;

-- Create/upsert a private bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars','avatars', false, 5*1024*1024, array['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: owners can read/write their own files
DROP POLICY IF EXISTS "avatars owner read" ON storage.objects;
CREATE POLICY "avatars owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars owner write" ON storage.objects;
CREATE POLICY "avatars owner write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

-- OPTIONAL: public-read avatars (uncomment if you want avatars publicly visible)
-- DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
-- CREATE POLICY "avatars public read"
--   ON storage.objects FOR SELECT
--   TO anon, authenticated
--   USING (bucket_id = 'avatars');

-- Update the handle_new_user function to work with new schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_path, prefs)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    jsonb_build_object(
      'timezone', NEW.raw_user_meta_data->>'timezone',
      'notify_product', COALESCE((NEW.raw_user_meta_data->>'notify_product')::boolean, true),
      'notify_security', COALESCE((NEW.raw_user_meta_data->>'notify_security')::boolean, true),
      'onboarding_complete', COALESCE((NEW.raw_user_meta_data->>'onboarding_complete')::boolean, false),
      'twofa_enabled', COALESCE((NEW.raw_user_meta_data->>'twofa_enabled')::boolean, false),
      'purpose', NEW.raw_user_meta_data->>'purpose'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clean up
DROP TABLE profiles_backup;
