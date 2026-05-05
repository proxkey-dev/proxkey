# Quick Setup Guide

## Fix "Load failed" Error in Sign-up

The "Load failed" error you're seeing is because Supabase is not configured. Follow these steps to fix it:

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter project details and create the project

### 2. Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://your-project-id.supabase.co`)
   - **Anon public key** (long string starting with `eyJ...`)

### 3. Configure Environment Variables

Create a `.env.local` file in the frontend root directory (`/Users/omer/Local_Repo/proxkey/frontend/`):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual Supabase credentials.

### 4. Set Up Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 5. Configure Authentication

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Set **Site URL** to: `http://localhost:5173`
3. Add **Redirect URLs**: `http://localhost:5173/**`
4. Enable **Email** provider in **Authentication** → **Providers**

### 6. Restart Development Server

```bash
cd frontend
npm run dev
```

The sign-up form should now work properly!

## Troubleshooting

- **Still getting "Load failed"?** Check the browser console for detailed error messages
- **Environment variables not loading?** Make sure `.env.local` is in the frontend root directory
- **Database errors?** Ensure the profiles table was created successfully
- **Email not sending?** Check your Supabase email settings

For more detailed setup instructions, see `SUPABASE_SETUP.md`.
