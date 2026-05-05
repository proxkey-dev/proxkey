# Avatar & Preferences Setup Guide

This guide explains how to use the new Storage-based avatar system and JSONB preferences in your ProxKey application.

## Overview

The new setup provides:
- **Storage-based avatars**: Profile pictures stored in Supabase Storage with proper RLS
- **JSONB preferences**: Flexible user preferences stored as structured JSON
- **TypeScript helpers**: Easy-to-use functions for avatar and preference management
- **React components**: Ready-to-use UI components

## Database Migration

### 1. Run the Migration

Execute the SQL migration in your Supabase SQL Editor:

```sql
-- The migration file is located at:
-- frontend/supabase/migrations/20250117000000_update_profiles_for_storage.sql
```

This migration will:
- Update the `profiles` table structure
- Create the `avatars` Storage bucket
- Set up proper RLS policies
- Migrate existing data

### 2. Verify the Setup

Check that the following are created:
- `profiles` table with `avatar_path` and `prefs` columns
- `avatars` Storage bucket (private by default)
- RLS policies for both table and storage

## TypeScript Usage

### Avatar Management

```typescript
import { 
  uploadAvatar, 
  getAvatarUrl, 
  deleteAvatar, 
  getTransformedAvatarUrl 
} from '../lib/profile';

// Upload a new avatar
const file = event.target.files[0];
const avatarUrl = await uploadAvatar(file);

// Get avatar URL (signed URL for private bucket)
const url = await getAvatarUrl(profile.avatar_path);

// Get transformed avatar (resized, optimized)
const thumbnailUrl = getTransformedAvatarUrl(profile.avatar_path, {
  width: 128,
  height: 128,
  resize: 'cover',
  format: 'webp'
});

// Delete avatar
await deleteAvatar(profile.avatar_path);
```

### Preferences Management

```typescript
import { 
  setUserPrefs, 
  getUserPref, 
  getCurrentProfile 
} from '../lib/profile';

// Update preferences (merge with existing)
await setUserPrefs({
  theme: 'dark',
  language: 'en',
  notify_product: true,
  timezone: 'America/New_York'
});

// Get a specific preference
const theme = await getUserPref('theme', 'system');

// Get current profile with all preferences
const profile = await getCurrentProfile();
console.log(profile.prefs);
```

## React Components

### AvatarUpload Component

```tsx
import AvatarUpload from '../components/AvatarUpload';

function ProfilePage() {
  const [avatarUrl, setAvatarUrl] = useState(null);

  return (
    <div>
      <h2>Profile Picture</h2>
      <AvatarUpload
        currentAvatarPath={profile?.avatar_path}
        onAvatarChange={setAvatarUrl}
        size="lg"
        className="mb-6"
      />
    </div>
  );
}
```

### PreferencesForm Component

```tsx
import PreferencesForm from '../components/PreferencesForm';

function SettingsPage() {
  return (
    <div>
      <h2>Preferences</h2>
      <PreferencesForm
        onSave={(prefs) => console.log('Saved:', prefs)}
        className="max-w-2xl"
      />
    </div>
  );
}
```

## Storage Configuration

### Private vs Public Buckets

The default setup uses a **private bucket** for security. This means:
- Avatars require signed URLs to access
- Only the owner can view their avatars
- Better privacy and security

To make avatars public (for team pages, etc.), uncomment this policy in the migration:

```sql
-- OPTIONAL: public-read avatars
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
```

### Image Transformations

Supabase provides built-in image transformations via CDN:

```typescript
// Get optimized avatar
const optimizedUrl = getTransformedAvatarUrl(avatarPath, {
  width: 200,
  height: 200,
  resize: 'cover',
  quality: 80,
  format: 'webp'
});
```

## Security Considerations

### Row Level Security (RLS)

The setup includes proper RLS policies:
- Users can only access their own profile data
- Users can only upload/delete their own avatars
- Service role has full access for admin operations

### File Validation

The `AvatarUpload` component includes:
- File type validation (PNG, JPEG, WebP, SVG)
- File size limits (5MB max)
- Error handling and user feedback

### Cleanup

The system automatically cleans up old avatar files when new ones are uploaded to prevent storage bloat.

## Migration from Old System

If you're migrating from the old `avatar_url` system:

1. **Run the SQL migration** - it will migrate existing data
2. **Update your components** - replace `avatar_url` with `avatar_path`
3. **Upload existing avatars** - move them to Storage if needed
4. **Update TypeScript types** - use the new `Database` type

## Example Integration

Here's a complete example of a profile page:

```tsx
import React, { useState, useEffect } from 'react';
import { getCurrentProfile, updateDisplayName } from '../lib/profile';
import AvatarUpload from '../components/AvatarUpload';
import PreferencesForm from '../components/PreferencesForm';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const profileData = await getCurrentProfile();
    setProfile(profileData);
    setLoading(false);
  };

  const handleDisplayNameChange = async (newName: string) => {
    await updateDisplayName(newName);
    setProfile(prev => ({ ...prev, display_name: newName }));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
          <AvatarUpload
            currentAvatarPath={profile?.avatar_path}
            onAvatarChange={(url) => {
              // Handle avatar change
              console.log('New avatar URL:', url);
            }}
            size="lg"
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Display Name</h2>
          <input
            type="text"
            value={profile?.display_name || ''}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter your display name"
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Preferences</h2>
        <PreferencesForm
          onSave={(prefs) => {
            console.log('Preferences saved:', prefs);
            // Optionally refresh profile data
            loadProfile();
          }}
        />
      </div>
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **"Not signed in" error**: Ensure user is authenticated before calling avatar/preference functions
2. **Storage upload fails**: Check RLS policies and bucket configuration
3. **Signed URLs not working**: Verify the bucket is private and policies are correct
4. **TypeScript errors**: Make sure to update your `Database` type in `supabase.ts`

### Debug Tips

- Check Supabase logs for RLS policy violations
- Verify Storage bucket permissions in the dashboard
- Use browser dev tools to inspect network requests
- Check that environment variables are properly set

## Next Steps

1. Run the migration in your Supabase project
2. Update your existing components to use the new system
3. Test avatar upload and preference management
4. Consider adding more preference options as needed
5. Implement avatar cleanup in your user management flows

For questions or issues, check the Supabase documentation or create an issue in the repository.
