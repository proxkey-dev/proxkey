# Post-Signup Onboarding Implementation

This document describes the complete post-signup onboarding flow implementation for the ProxKey application.

## Overview

The onboarding flow consists of 4 steps that run immediately after a user confirms their email:

1. **Purpose Selection** - User selects how they'll use the service (student, personal, business, researcher, other)
2. **2FA Setup** - User enrolls and verifies Time-based One-Time Password (TOTP) MFA
3. **Avatar Upload** - User uploads a profile picture to Supabase Storage
4. **Review & Finish** - User reviews their selections and completes onboarding

## Database Changes

### Migration: `supabase/migrations/20250116000000_add_onboarding_fields.sql`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purpose TEXT CHECK (purpose IN ('student','personal','business','researcher','other')) NULL,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT false;
```

## Storage Setup

You need to create a public `avatars` bucket in Supabase Storage:

1. Go to Supabase Dashboard > Storage
2. Create a new bucket named `avatars`
3. Set it to public
4. Configure RLS policies to allow users to upload their own avatars

## Components Created

### Core Components
- `src/hooks/useProfile.ts` - Profile management hook
- `src/components/OnboardingGate.tsx` - Route protection component
- `src/routes/Onboarding.tsx` - Main onboarding wizard container

### Step Components
- `src/routes/onboarding/PurposeStep.tsx` - Purpose selection
- `src/routes/onboarding/TwoFAStep.tsx` - TOTP enrollment and verification
- `src/routes/onboarding/AvatarStep.tsx` - Profile picture upload
- `src/routes/onboarding/ReviewStep.tsx` - Final review and completion

### Route Components
- `src/routes/Dashboard.tsx` - Protected dashboard component

## Routing

The onboarding flow is integrated into the main app routing:

- `/onboarding` - Onboarding wizard (redirects to dashboard if already complete)
- `/dashboard` - Protected by OnboardingGate (redirects to onboarding if incomplete)

## Key Features

### 2FA Implementation
- Uses Supabase Auth MFA API
- QR code generation for authenticator apps
- 6-digit code verification
- Handles already-enrolled users gracefully

### Avatar Upload
- File size validation (5MB limit)
- Image type validation (PNG, JPG, WEBP)
- Automatic file naming with user ID
- Public URL generation

### Error Handling
- Comprehensive error states for all operations
- User-friendly error messages
- Graceful fallbacks for edge cases

### Accessibility
- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly

## Testing Checklist

- [ ] After email confirmation, user lands on `/onboarding`
- [ ] Step 1 saves purpose to `profiles.purpose`
- [ ] Step 2 shows QR code and verifies 6-digit code
- [ ] Step 2 sets `profiles.twofa_enabled = true`
- [ ] Step 3 uploads to avatars bucket and updates `profiles.avatar_url`
- [ ] Step 4 sets `onboarding_complete = true` and redirects to `/dashboard`
- [ ] RLS policies prevent users from modifying other profiles
- [ ] Already-onboarded users are redirected to dashboard
- [ ] Non-authenticated users are redirected to home

## Environment Variables

Ensure these are set in your `.env` file:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Supabase Configuration

### Email Confirmation Redirect
Update your Supabase Auth settings to redirect to `/onboarding` after email confirmation:

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Set "Site URL" to your domain
3. Set "Redirect URLs" to include `https://yourdomain.com/onboarding`

### Storage Bucket
Create the `avatars` bucket with appropriate RLS policies:

```sql
-- Allow users to upload their own avatars
CREATE POLICY "Users can upload their own avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');
```

## Usage

The onboarding flow will automatically trigger for new users after email confirmation. Existing users with `onboarding_complete = false` will be redirected to the onboarding flow when accessing protected routes.

To manually trigger onboarding for testing:
1. Set `onboarding_complete = false` in the database
2. Navigate to `/dashboard` - you'll be redirected to `/onboarding`

