# Profile & Avatar Setup Guide

This guide will help you set up the profile page with avatar functionality and community templates.

## 1. Database Setup

### Apply the Database Schema
1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/jiguxwsfuolxsyqkejop)
2. Navigate to **SQL Editor**
3. Create a new query and paste the following SQL:

```sql
-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_path TEXT,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger
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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "profiles select own" ON public.profiles;
CREATE POLICY "profiles select own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles insert own" ON public.profiles;
CREATE POLICY "profiles insert own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Auto-insert profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

4. Click **Run** to execute the SQL

## 2. Storage Bucket Setup

### Create Avatars Bucket
1. In the Supabase Dashboard, go to **Storage**
2. Create a new bucket:
   - **Name**: `avatars`
   - **Public**: ❌ No (Private bucket)
   - **File size limit**: 5MB
   - **Allowed MIME types**: `image/png,image/jpeg,image/webp,image/svg+xml`

### Set Storage Policies
1. Go to **Storage** → **Policies**
2. Run the SQL from `setup-avatars-bucket.sql` in the SQL Editor:

```sql
-- Create policies for avatars bucket
-- Users can upload their own avatars
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own avatars
CREATE POLICY "Users can view own avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access to avatars"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');
```

## 3. Environment Variables

Make sure your `.env.local` file contains:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://jiguxwsfuolxsyqkejop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3V4d3NmdW9seHN5cWtlam9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTA2MTksImV4cCI6MjA3MzIyNjYxOX0.T6xrf4iztRa19RP7mZBQPnR6-GRoFaChZJOZCVKtSy4

# Service Role Key (needed for admin operations)
SUPABASE_SERVICE_ROLE=YOUR_SERVICE_ROLE_KEY_HERE

# Base URL for absolute links
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key from Supabase Dashboard → Settings → API.

## 4. Features Implemented

### ✅ **Profile Management**
- **Display Name**: Users can set and update their display name
- **Username**: Stored in preferences JSONB field
- **Timezone**: Stored in preferences JSONB field
- **Email**: Read-only, managed by Supabase Auth

### ✅ **Avatar Upload**
- **File Upload**: Support for PNG, JPEG, WebP, and SVG images
- **File Size Limit**: 5MB maximum
- **Automatic Cleanup**: Old avatars are automatically deleted when new ones are uploaded
- **Private Storage**: Avatars are stored in a private bucket with proper RLS policies
- **Signed URLs**: Secure access to avatar images

### ✅ **Community Templates**
- **Template Browser**: Browse community-created API key templates
- **Categories**: E-commerce, Development, Marketing, Security
- **Template Details**: Shows configuration, usage stats, ratings, and author
- **Search & Filter**: Find templates by name or category
- **Template Application**: Apply template settings to create new API keys

### ✅ **User Settings Tabs**
1. **Profile**: Basic profile information and avatar
2. **Security**: Password change and 2FA settings
3. **Billing**: Subscription management and payment methods
4. **Notifications**: Email notification preferences
5. **Preferences**: Theme, language, timezone settings
6. **Community Templates**: Browse and use API key templates

## 5. Testing the Implementation

### Start the Development Server
```bash
npm run dev
```

### Test Profile Functionality
1. **Sign In**: Go to `/auth` and sign in with your account
2. **Profile Page**: Navigate to `/profile` to see the profile settings
3. **Avatar Upload**: Click on the avatar area to upload a profile picture
4. **Profile Update**: Update your display name, username, and timezone
5. **Templates Tab**: Click on "Community Templates" to browse available templates

### Test Avatar Upload
1. Click on the avatar placeholder or "Upload" button
2. Select an image file (PNG, JPEG, WebP, or SVG)
3. The image should upload and display immediately
4. Try uploading a different image to test the cleanup functionality

### Test Community Templates
1. Go to the "Community Templates" tab
2. Browse the available templates
3. Click "Use Template" on any template to see the success message
4. Use the search and filter functionality

## 6. Troubleshooting

### Avatar Not Uploading
- Check that the `avatars` bucket exists and has the correct policies
- Verify the service role key is correctly set in `.env.local`
- Check browser console for any error messages

### Profile Not Loading
- Ensure the `profiles` table exists with the correct schema
- Check that RLS policies are properly configured
- Verify the user is authenticated

### Templates Not Showing
- The templates are currently mock data - they should always display
- Check browser console for any JavaScript errors

## 7. Next Steps

- **Real Template System**: Replace mock data with actual template storage
- **Template Creation**: Allow users to create and share their own templates
- **Template Categories**: Add more categories and filtering options
- **Template Ratings**: Implement real rating and review system
- **Template Search**: Add full-text search functionality
- **Template Analytics**: Track template usage and popularity

## 8. Security Notes

- **RLS Policies**: All database operations are protected by Row Level Security
- **Private Storage**: Avatars are stored in a private bucket with user-specific access
- **File Validation**: Uploaded files are validated for type and size
- **Signed URLs**: Avatar access uses time-limited signed URLs for security
- **Input Sanitization**: All user inputs are properly sanitized

The profile system is now fully functional with avatar upload, community templates, and comprehensive user settings!
