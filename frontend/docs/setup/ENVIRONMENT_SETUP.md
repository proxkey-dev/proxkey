# Environment Setup Guide

This guide explains how to configure ProxKey using environment variables for secure API key management.

## Quick Start

1. **Copy the template file:**
   ```bash
   cp env.template .env
   ```

2. **Fill in your Supabase credentials:**
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Navigate to Settings > API
   - Copy your Project URL and anon key
   - Update the `.env` file with your values

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Required Environment Variables

### Supabase Configuration
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### JWT Configuration (ES256 with Key Rotation)
```bash
# ES256 JWK format (recommended for security)
JWT_CURRENT_KEY={"x":"YA8agB1XRFPaX5XppqqfV3Z-MgDNyUsuhtliFb0rglc","y":"qakv9me512PAnf9KBBEVorwF2o_Bg4mqZdGrj2SgOhE","alg":"ES256","crv":"P-256","ext":true,"kid":"9824f45d-4ec0-4209-af5d-7f3b60c734fb","kty":"EC","key_ops":["verify"]}
JWT_STANDBY_KEY=your-standby-jwt-signing-key
JWT_ALGORITHM=ES256
JWT_EXPIRES_IN=1h
JWT_KEY_ROTATION_ENABLED=true
```

**Key Formats Supported:**
- **ES256**: JWK (JSON Web Key) format - most secure
- **RS256**: PEM format - widely supported
- **HS256**: Raw string - simple but less secure

### API Configuration
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
CLOUDFLARE_WORKER_URL=https://api.proxkey.dev
```

## JWT Key Rotation

ProxKey supports JWT key rotation for enhanced security:

### Key Rotation Setup
1. **Current Key**: Used for signing new tokens
2. **Standby Key**: Used for verifying tokens during rotation
3. **Automatic Fallback**: System tries current key first, then standby key

### Rotating Keys
```typescript
import { rotateKeys } from './lib/jwt';

// Check rotation status
const result = rotateKeys();
console.log(result.message);
```

### Key Rotation Process
1. Generate new standby key
2. Update `JWT_STANDBY_KEY` in environment
3. Deploy and verify new key works
4. Promote standby to current (`JWT_CURRENT_KEY`)
5. Generate new standby key
6. Repeat process

## Security Best Practices

### ✅ DO:
- Use environment variables for all sensitive data
- Keep your `.env` file in `.gitignore`
- Use different keys for development and production
- Rotate your JWT keys regularly (every 30-90 days)
- Use strong, unique secrets
- Enable JWT key rotation for production

### ❌ DON'T:
- Commit `.env` files to version control
- Hardcode API keys in your source code
- Share your service role keys or JWT keys
- Use production keys in development
- Skip key rotation in production

## Environment File Structure

The `env.template` file includes sections for:

- **Supabase Configuration**: Database and authentication
- **API Configuration**: Base URLs and endpoints
- **Authentication & Security**: JWT and session secrets
- **Email Configuration**: SMTP settings for notifications
- **Database Configuration**: Direct database access
- **Development Settings**: Debug and environment flags
- **Third-party Integrations**: Stripe, analytics, etc.
- **Storage Configuration**: File upload limits
- **Rate Limiting**: API request limits
- **Feature Flags**: Enable/disable features

## Development vs Production

### Development
- Use test/development keys
- Enable debug logging
- Use local URLs for testing

### Production
- Use production keys
- Disable debug logging
- Use secure HTTPS URLs
- Enable all security features

## Troubleshooting

### Common Issues

1. **"Supabase configuration missing" error:**
   - Check that your `.env` file exists
   - Verify the environment variable names match exactly
   - Ensure no trailing spaces in your values

2. **"Admin operations may not work" warning:**
   - Set the `SUPABASE_SERVICE_ROLE_KEY` variable
   - Get this from Supabase Dashboard > Settings > API

3. **Build failures:**
   - Make sure all required variables are set
   - Check that your keys are valid and not expired

### Getting Help

If you encounter issues:

1. Check the console for specific error messages
2. Verify your environment variables are set correctly
3. Ensure your Supabase project is properly configured
4. Check the [Supabase Documentation](https://supabase.com/docs)

## Example Configuration

Here's a minimal working `.env` file:

```bash
# Supabase
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CLOUDFLARE_WORKER_URL=https://api.proxkey.dev

# Development
NODE_ENV=development
DEBUG=true
```

## Next Steps

Once your environment is configured:

1. Run the development server: `npm run dev`
2. Test your Supabase connection
3. Configure additional services as needed
4. Deploy to production with production keys

For more detailed setup instructions, see the main [README.md](./README.md) file.
