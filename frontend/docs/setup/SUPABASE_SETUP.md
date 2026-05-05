# Supabase Authentication Setup

This guide will help you set up Supabase authentication for the ProxKey frontend.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A new Supabase project created

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `proxkey-website`
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
5. Click "Create new project"

### 2. Get Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - Project URL
   - Anon public key

### 3. Configure Environment Variables

Create a `.env.local` file in the frontend root directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual Supabase project credentials.

### 4. Set Up Database Schema

Run the following SQL in your Supabase SQL Editor to create the profiles table:

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

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 5. Configure Authentication Settings

1. Go to Authentication > Settings in your Supabase dashboard
2. Configure the following:

**Site URL:**
```
http://localhost:5173
```

**Redirect URLs:**
```
http://localhost:5173/**
https://your-domain.com/**
```

**Email Templates:**
- Customize the confirmation email template
- Customize the password reset email template

### 6. Enable Email Authentication

1. Go to Authentication > Providers
2. Enable Email provider
3. Configure SMTP settings (optional, uses Supabase's default email service)

### 7. Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173`
3. Click "Get Started" or "Sign In"
4. Try creating a new account
5. Check your email for the confirmation link
6. Sign in with your credentials

## Features Implemented

- ✅ User registration with email verification
- ✅ User login/logout
- ✅ Password reset functionality
- ✅ Protected dashboard route
- ✅ User profile management
- ✅ Responsive authentication modals
- ✅ Form validation and error handling
- ✅ Loading states and success messages

## Security Features

- Row Level Security (RLS) enabled on profiles table
- Users can only access their own profile data
- Secure password requirements
- Email verification required for new accounts
- Automatic profile creation on signup

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your site URL is added to the allowed origins in Supabase
2. **Email Not Sending**: Check your SMTP configuration or use Supabase's default email service
3. **Profile Not Created**: Ensure the trigger function is properly set up
4. **Environment Variables**: Make sure your `.env.local` file is in the correct location

### Debug Mode

Enable debug mode by adding this to your `.env.local`:
```bash
VITE_SUPABASE_DEBUG=true
```

This will log additional information to the browser console.

## Next Steps

1. Customize the email templates in Supabase
2. Set up custom SMTP for production
3. Configure additional OAuth providers (Google, GitHub, etc.)
4. Add user role management
5. Implement additional profile fields as needed
