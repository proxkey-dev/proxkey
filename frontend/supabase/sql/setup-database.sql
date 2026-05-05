-- ProxKey Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  timezone TEXT,
  notify_product BOOLEAN DEFAULT true,
  notify_security BOOLEAN DEFAULT true,
  onboarding_complete BOOLEAN DEFAULT false,
  twofa_enabled BOOLEAN DEFAULT false,
  purpose TEXT,
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
  INSERT INTO public.profiles (id, email, full_name, avatar_url, username, timezone, notify_product, notify_security, onboarding_complete, twofa_enabled, purpose)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'timezone',
    COALESCE((NEW.raw_user_meta_data->>'notify_product')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'notify_security')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'onboarding_complete')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'twofa_enabled')::boolean, false),
    NEW.raw_user_meta_data->>'purpose'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
