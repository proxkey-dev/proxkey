# Demo QR Flow Implementation

This document describes the demo QR flow implementation for ProxKey.

## Overview

The demo QR flow allows users to experience ProxKey's API key management without making any backend calls or counting usage. It consists of:

1. **Cloudflare Worker** - Handles QR redirects
2. **Demo QR Page** - Displays demo API key information
3. **QR Code Generation** - Creates QR codes with ProxKey logo overlay

## Architecture

```
QR Code → Cloudflare Worker → Demo Page
   ↓              ↓              ↓
https://     302 Redirect    Static Demo
proxkey-demo.workers.dev/    Page with QR
demo/echo?...               and Key Info
```

## Components

### 1. Cloudflare Worker (`workers-site/`)

**File**: `src/worker.ts`
- Handles `/demo/echo` endpoint
- Accepts query parameters for customization
- Redirects to demo page with parameters

**Deployment**:
```bash
cd workers-site
npm install
npm run deploy
```

### 2. Demo QR Page (`src/components/DemoQRPage.tsx`)

**Route**: `/demo/qr`
- Displays demo API key information
- Generates QR code with logo overlay
- No backend calls (pure frontend demo)

**Features**:
- Customizable issuer, subject, type
- TTL, max requests, geofence settings
- ProxKey logo centered in QR code
- Responsive design

### 3. QR Code Generation

Uses `qrcode` library to generate QR codes with:
- 512x512 pixel size
- 1px margin
- ProxKey logo overlay in center
- White background with shadow

## Usage

### Basic Demo URL
```
https://proxkey-demo.workers.dev/demo/echo
```

### Customized Demo URL
```
https://proxkey-demo.workers.dev/demo/echo?issuer=ProxKey&subject=Demo%20User&type=Person&ttl=30&max=500&geo=US,CA,UK&blockSameIp=true
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `issuer` | "ProxKey" | Who issued the key |
| `subject` | "Acme Inc." | Subject/company name |
| `type` | "Company" | Key type (Person/Company) |
| `ttl` | "60" | Time to live in minutes |
| `max` | "1000" | Maximum requests |
| `geo` | "US,CA" | Geofence allowlist |
| `blockSameIp` | "true" | Block same IP reuse |

## Testing

### 1. Test Worker Logic
```bash
cd workers-site
node test-worker.js
```

### 2. Test Demo Page
```bash
cd frontend
npm run dev
# Visit http://localhost:5173/demo/qr
```

### 3. Test Full Flow
1. Deploy worker to Cloudflare
2. Generate QR code pointing to worker URL
3. Scan QR code
4. Verify redirect to demo page
5. Check that demo page displays correctly

## Deployment

### Cloudflare Worker
```bash
cd workers-site
npm install
npm run deploy
```

### Website
```bash
cd frontend
npm run build
# Deploy dist/ to your hosting provider
```

## Security Notes

- No backend API calls are made
- No usage is counted or recorded
- All data is static/demo only
- Worker redirects are cached with `no-store`
- Demo keys are clearly marked as fake

## Future Enhancements

1. **Custom Domain**: Map worker to `qr.proxkey.dev`
2. **Real Demo Flow**: Add temporary display tokens
3. **Analytics**: Track demo page views (non-sensitive)
4. **Customization**: More visual customization options
5. **Mobile Optimization**: Better mobile QR scanning experience
