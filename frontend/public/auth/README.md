# Static Authentication Pages for ProxKey

This directory contains static HTML pages for handling Supabase authentication flows. These pages are designed to work with static hosting providers like Cloudflare Pages, Vercel, or Netlify.

## 📁 Files

### Verification Pages
- `confirm.html` - Email confirmation page
- `reset-password.html` - Password reset verification
- `magic-link.html` - Magic link authentication
- `config.js` - Configuration file for Supabase settings

## 🚀 Usage

### 1. Deploy Static Pages

These pages can be deployed to any static hosting provider:

```bash
# Copy to your static hosting provider
cp -r auth/ /path/to/your/static/site/
```

### 2. Configure Supabase

Update the Supabase configuration in `config.js`:

```javascript
window.SUPABASE_CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',
    // ... other settings
};
```

### 3. Set Up Email Templates

Configure Supabase to use the email templates:

1. Go to Supabase Dashboard > Authentication > Email Templates
2. Update each template with the HTML from `email-templates/` directory
3. Set the redirect URLs to point to these static pages

### 4. Configure Redirect URLs

In your Supabase project settings:

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: 
  - `https://your-domain.com/auth/confirm.html`
  - `https://your-domain.com/auth/reset-password.html`
  - `https://your-domain.com/auth/magic-link.html`

## 🎨 Design Features

- **ProxKey Branding**: Matches the main website design
- **Dark Theme**: Consistent with ProxKey's aesthetic
- **Glass Morphism**: Modern UI with backdrop blur effects
- **Responsive**: Works on desktop and mobile
- **Loading States**: Visual feedback during processing
- **Error Handling**: Clear error messages for users

## 🔧 Customization

### Styling
The pages use inline CSS that matches ProxKey's design system:
- Dark gradient background
- Glass morphism effects
- Corporate color palette
- Responsive design

### Configuration
Update `config.js` to customize:
- Supabase project settings
- Redirect URLs
- Email template paths
- Default behaviors

### Branding
To update branding:
1. Change the logo in the `.logo` section
2. Update colors in the CSS variables
3. Modify the footer information

## 📧 Email Integration

These pages work with the email templates in the `email-templates/` directory:

1. **Confirm Signup** → `confirm.html`
2. **Invite User** → `confirm.html`
3. **Magic Link** → `magic-link.html`
4. **Change Email** → `confirm.html`
5. **Reset Password** → `reset-password.html`
6. **Reauthentication** → `magic-link.html`

## 🚀 Deployment Examples

### Cloudflare Pages
```bash
# Deploy to Cloudflare Pages
wrangler pages publish auth/
```

### Vercel
```bash
# Deploy to Vercel
vercel --prod auth/
```

### Netlify
```bash
# Deploy to Netlify
netlify deploy --prod --dir auth/
```

## 🔒 Security

- **HTTPS Required**: These pages must be served over HTTPS
- **CORS Configuration**: Ensure proper CORS settings in Supabase
- **Token Validation**: All tokens are validated server-side by Supabase
- **Secure Redirects**: Only allowlisted redirect URLs are accepted

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid or expired link"**
   - Check Supabase project configuration
   - Verify redirect URLs are correct
   - Ensure HTTPS is enabled

2. **"Missing token"**
   - Check email template configuration
   - Verify URL parameters are being passed correctly

3. **Redirect not working**
   - Check `redirect_to` parameter
   - Verify redirect URLs are allowlisted in Supabase

### Debug Mode

Add this to the URL to enable debug logging:
```
?debug=true
```

## 📱 Mobile Support

All pages are fully responsive and work on:
- iOS Safari
- Android Chrome
- Mobile browsers
- PWA applications

## 🎯 Next Steps

1. **Deploy the pages** to your static hosting provider
2. **Configure Supabase** with the correct redirect URLs
3. **Update email templates** in Supabase dashboard
4. **Test the authentication flow** end-to-end
5. **Monitor for errors** and user feedback

## 🆘 Support

For issues or questions:
1. Check the browser console for errors
2. Verify Supabase configuration
3. Test with different browsers/devices
4. Check Supabase logs for server-side errors
