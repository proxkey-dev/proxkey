# Production Deployment Guide - Password Reset

This guide covers deploying the password reset functionality to production with proper security and configuration.

## 🚀 Quick Deployment Checklist

### 1. Environment Variables
Set these environment variables in your deployment platform (Cloudflare Pages, Vercel, Netlify, etc.):

```bash
# Required
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional (with defaults)
VITE_MAX_RESET_ATTEMPTS=3
VITE_RESET_ATTEMPT_WINDOW=900000
VITE_PASSWORD_MIN_LENGTH=8
VITE_PASSWORD_MAX_LENGTH=128
```

### 2. Supabase Configuration
In your Supabase dashboard:

1. **Authentication → Settings**
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/auth/reset/**`

2. **Authentication → Email Templates**
   - Update reset password template to use: `{{ .SiteURL }}/auth/reset?recovery_url={{ .ConfirmationURL | urlquery }}`

3. **Database → Security**
   - Ensure RLS policies are enabled
   - Review password policies

### 3. Security Headers
The `_headers` file is already configured with production security headers:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy: Strict CSP
- Strict-Transport-Security: HSTS enabled

### 4. Redirects
The `_redirects` file handles backward compatibility:
- `/auth/reset-password.html` → `/auth/reset/index.html`
- `/auth/reset-password` → `/auth/reset/index.html`

## 🔧 Platform-Specific Instructions

### Cloudflare Pages
1. Connect your repository
2. Set environment variables in Pages settings
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy!

### Vercel
1. Import your repository
2. Set environment variables in project settings
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy!

### Netlify
1. Connect your repository
2. Set environment variables in Site settings
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

## 🛡️ Security Features

### Rate Limiting
- **3 attempts per 15 minutes** per session
- Automatic cleanup of expired attempts
- Clear error messages for rate limit exceeded

### Password Validation
- **Minimum 8 characters**, maximum 128 characters
- **Common password detection** (blocks weak passwords)
- **Real-time strength indicator**
- **Client-side validation** with server-side enforcement

### Input Sanitization
- **XSS protection** with input sanitization
- **HTML escaping** for user inputs
- **URL validation** for recovery links

### Error Handling
- **No sensitive information** in error messages
- **Graceful degradation** for configuration errors
- **Proper logging** for debugging (production-safe)

## 📊 Monitoring & Analytics

### Recommended Monitoring
1. **Error tracking**: Monitor failed password resets
2. **Rate limiting**: Track blocked attempts
3. **Success rates**: Monitor completion rates
4. **Performance**: Track page load times

### Logging
The page logs warnings and errors to console:
- Invalid token formats
- Rate limit violations
- Configuration errors
- Network failures

## 🧪 Testing in Production

### Test URLs
1. **Valid recovery URL**: `https://yourdomain.com/auth/reset?recovery_url=...`
2. **Valid access token**: `https://yourdomain.com/auth/reset#access_token=...&refresh_token=...`
3. **Invalid link**: `https://yourdomain.com/auth/reset`
4. **Rate limiting**: Try multiple failed attempts

### Test Checklist
- [ ] Valid reset link shows password form
- [ ] Invalid link shows error message
- [ ] Password validation works correctly
- [ ] Rate limiting blocks after 3 attempts
- [ ] Success redirect works
- [ ] Security headers are present
- [ ] Mobile responsiveness works
- [ ] Error messages are user-friendly

## 🔄 Maintenance

### Regular Tasks
1. **Monitor error rates** in your analytics
2. **Review rate limiting** effectiveness
3. **Update common passwords list** if needed
4. **Check Supabase logs** for issues
5. **Test reset flow** monthly

### Updates
- **Supabase client**: Keep updated for security patches
- **Password policies**: Review and update as needed
- **Rate limiting**: Adjust based on usage patterns

## 🚨 Troubleshooting

### Common Issues

**"Configuration error"**
- Check environment variables are set
- Verify Supabase URL and key are correct

**"Invalid or expired reset link"**
- Check Supabase redirect URLs configuration
- Verify email template URLs are correct

**"Too many attempts"**
- Rate limiting is working correctly
- Wait 15 minutes or clear browser session storage

**Password validation errors**
- Check password meets requirements
- Ensure not using common passwords

### Debug Mode
To enable debug logging, add to your environment:
```bash
VITE_DEBUG=true
```

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Supabase configuration
3. Test with the provided test page
4. Review this documentation

---

**Security Note**: This implementation follows security best practices but should be reviewed by your security team before production deployment.
