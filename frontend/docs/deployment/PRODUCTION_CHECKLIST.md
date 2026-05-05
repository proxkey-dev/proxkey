# 🚀 Production Deployment Checklist

## Pre-Deployment Checklist

### ✅ Environment Configuration
- [ ] **Supabase URL** set in environment variables
- [ ] **Supabase Anon Key** set in environment variables
- [ ] **Optional settings** configured (rate limits, password policies)
- [ ] **Redirect URLs** configured in Supabase dashboard
- [ ] **Email templates** updated with correct URLs

### ✅ Security Configuration
- [ ] **Security headers** are present (`_headers` file)
- [ ] **CSP policy** is properly configured
- [ ] **Rate limiting** is enabled (3 attempts per 15 minutes)
- [ ] **Password validation** is enforced
- [ ] **Input sanitization** is working
- [ ] **Error messages** don't leak sensitive information

### ✅ File Structure
- [ ] **Main reset page**: `/auth/reset/index.html`
- [ ] **Production config**: `/auth/reset/config.prod.js`
- [ ] **Security headers**: `/auth/reset/_headers`
- [ ] **URL redirects**: `/auth/reset/_redirects`
- [ ] **Health check**: `/auth/reset/health.html`
- [ ] **Legacy redirect**: `/auth/reset-password.html` → `/auth/reset/`

### ✅ Testing
- [ ] **Page loads** correctly
- [ ] **Invalid links** show proper error messages
- [ ] **Rate limiting** blocks after 3 attempts
- [ ] **Password validation** works correctly
- [ ] **Security headers** are present
- [ ] **Redirects** work for old URLs
- [ ] **Mobile responsiveness** works
- [ ] **Error handling** is graceful

## Deployment Commands

### Build for Production
```bash
# Build the entire site
npm run build:production

# Or build just the reset page
npm run build:reset
```

### Test Production Build
```bash
# Test the reset functionality
npm run test:production

# Or test with custom URL
TEST_BASE_URL=https://yourdomain.com npm run test:reset
```

## Post-Deployment Verification

### ✅ Immediate Checks
- [ ] **Page loads** at `/auth/reset/`
- [ ] **Old URLs redirect** properly
- [ ] **Health check** responds at `/auth/reset/health.html`
- [ ] **Security headers** are present
- [ ] **No console errors** in browser

### ✅ Functional Tests
- [ ] **Test with valid recovery URL** (from email)
- [ ] **Test with invalid URL** (shows error)
- [ ] **Test rate limiting** (3 attempts max)
- [ ] **Test password validation** (strength, length, common passwords)
- [ ] **Test success flow** (redirects after reset)

### ✅ Security Tests
- [ ] **XSS protection** (try injecting scripts)
- [ ] **CSRF protection** (check for proper tokens)
- [ ] **Rate limiting** (multiple rapid attempts)
- [ ] **Input validation** (special characters, length limits)
- [ ] **Error messages** (no sensitive data leaked)

## Monitoring Setup

### ✅ Analytics & Monitoring
- [ ] **Error tracking** configured (Sentry, LogRocket, etc.)
- [ ] **Performance monitoring** set up
- [ ] **Uptime monitoring** for reset page
- [ ] **Rate limit monitoring** configured
- [ ] **Success rate tracking** implemented

### ✅ Logging
- [ ] **Console errors** are logged
- [ ] **Failed attempts** are tracked
- [ ] **Rate limit violations** are logged
- [ ] **Configuration errors** are logged
- [ ] **Performance metrics** are collected

## Supabase Configuration

### ✅ Authentication Settings
- [ ] **Site URL**: `https://yourdomain.com`
- [ ] **Redirect URLs**: `https://yourdomain.com/auth/reset/**`
- [ ] **Email templates** updated with bounce URLs
- [ ] **Password policies** configured
- [ ] **Rate limiting** enabled in Supabase

### ✅ Database Security
- [ ] **RLS policies** are enabled
- [ ] **Password reset tokens** have proper expiration
- [ ] **User sessions** are properly managed
- [ ] **Audit logging** is enabled

## Rollback Plan

### ✅ Emergency Procedures
- [ ] **Rollback script** prepared
- [ ] **Old reset page** kept as backup
- [ ] **Database rollback** procedure documented
- [ ] **Configuration rollback** steps ready
- [ ] **Emergency contacts** available

## Success Criteria

### ✅ Performance
- [ ] **Page load time** < 2 seconds
- [ ] **Time to interactive** < 3 seconds
- [ ] **Error rate** < 1%
- [ ] **Success rate** > 95%

### ✅ Security
- [ ] **No security vulnerabilities** detected
- [ ] **Rate limiting** working effectively
- [ ] **Input validation** preventing attacks
- [ ] **Error handling** not leaking information

### ✅ User Experience
- [ ] **Clear error messages** for users
- [ ] **Smooth password reset flow**
- [ ] **Mobile-friendly** interface
- [ ] **Accessible** to screen readers

---

## 🎯 Quick Commands

```bash
# Full production build and test
npm run build:production && npm run test:production

# Test specific environment
TEST_BASE_URL=https://staging.yourdomain.com npm run test:reset

# Check security headers
curl -I https://yourdomain.com/auth/reset/

# Test redirect
curl -I https://yourdomain.com/auth/reset-password.html
```

**Remember**: Always test in a staging environment before production deployment!
