-- Add onboarding fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purpose TEXT CHECK (purpose IN ('student','personal','business','researcher','other')) NULL,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT false;

-- Ensure avatar_url stays nullable but present
-- RLS policies already allow a user to update their own row by id

