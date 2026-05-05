# Supabase Email Configuration Fix

## 🚨 "Error sending confirmation email" - Solutions

### Quick Fix 1: Check Supabase Dashboard Settings

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `jiguxwsfuolxsyqkejop`

2. **Configure Authentication Settings**
   - Go to: **Authentication** → **Settings**
   - Set **Site URL**: `http://localhost:3000`
   - Add **Redirect URLs**: 
     ```
     http://localhost:3000/**
     http://localhost:5173/**
     https://your-domain.com/**
     ```

3. **Configure Email Settings**
   - Go to: **Authentication** → **Settings** → **Email**
   - **Enable email confirmations**: ✅ ON
   - **Enable email change confirmations**: ✅ ON
   - **Enable password reset confirmations**: ✅ ON

### Quick Fix 2: Check Email Provider

1. **Go to Authentication → Providers**
2. **Email Provider Settings**:
   - **Enable email provider**: ✅ ON
   - **Confirm email**: ✅ ON
   - **Secure email change**: ✅ ON

### Quick Fix 3: Test with Different Email

Sometimes the issue is with the specific email address:
- Try with a different email address
- Use a Gmail or other major email provider
- Check spam folder

### Quick Fix 4: Check Rate Limits

1. **Go to Settings → API**
2. **Check rate limits**:
   - Free tier: 2 emails per hour per user
   - If exceeded, wait or upgrade

### Quick Fix 5: Enable Debug Mode

Add this to your `.env` file:
```bash
VITE_SUPABASE_DEBUG=true
```

This will show detailed error messages in the browser console.

## 🔧 Advanced Configuration

### Custom SMTP (Optional)

If you want to use your own email service:

1. **Go to Authentication → Settings → Email**
2. **Configure SMTP**:
   - **SMTP Host**: `smtp.gmail.com` (for Gmail)
   - **SMTP Port**: `587`
   - **SMTP User**: `your-email@gmail.com`
   - **SMTP Pass**: `your-app-password`
   - **SMTP Admin Email**: `your-email@gmail.com`
   - **SMTP Sender Name**: `ProxKey`

### Email Templates (Optional)

Customize email templates:
1. **Go to Authentication → Email Templates**
2. **Customize**:
   - Confirm signup
   - Magic link
   - Change email address
   - Reset password

## 🧪 Testing

1. **Clear browser data** (cookies, localStorage)
2. **Try signup with a fresh email**
3. **Check browser console** for detailed errors
4. **Check Supabase logs** in dashboard

## 📞 Still Having Issues?

1. **Check Supabase Status**: https://status.supabase.com
2. **Check your project logs**: Dashboard → Logs
3. **Try the Supabase CLI**: `supabase status`
4. **Contact Supabase Support** if needed

## 🎯 Quick Test

Run this in your browser console to test the connection:

```javascript
// Test Supabase connection
const { createClient } = window.supabase;
const supabase = createClient(
  'https://jiguxwsfuolxsyqkejop.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3V4d3NmdW9seHN5cWtlam9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTA2MTksImV4cCI6MjA3MzIyNjYxOX0.T6xrf4iztRa19RP7mZBQPnR6-GRoFaChZJOZCVKtSy4'
);

// Test signup
supabase.auth.signUp({
  email: 'test@example.com',
  password: 'testpassword123'
}).then(console.log);
```
