# ProxKey Demo Implementation

This document describes the demo endpoint and QR code with logo implementation for ProxKey.

## 🚀 What's Implemented

### 1. Cloudflare Worker Demo Endpoint

**File**: `src/worker.ts`  
**Endpoint**: `/demo/echo`  
**Features**:
- Safe JSON echo of headers (Authorization + X-ProxKey-Policy)
- No database calls, edge-only
- CORS enabled for browser demos
- Base64url policy decoding for better demo experience
- Request ID and timestamp for tracking

**Configuration**: `wrangler.toml`
```toml
name = "proxkey-demo"
main = "src/worker.ts"
compatibility_date = "2024-10-01"
```

### 2. QR Code with Logo Component

**File**: `src/components/QRWithLogo.tsx`  
**Features**:
- High error correction (Level H) for logo overlay
- Centered logo with white backplate for contrast
- Configurable logo scale and backplate radius
- Canvas-based rendering for crisp output

**Usage**:
```tsx
<QRWithLogo 
  value={payloadText} 
  size={260} 
  logoSrc="/logo.png" 
  logoScale={0.22} 
/>
```

### 3. Updated Demo Components

**Files**: 
- `src/components/DemoKeyGenerator.tsx`
- `src/components/Features.tsx`

**Changes**:
- Integrated QRWithLogo component
- Updated curl commands to use demo endpoint
- Added policy generation and base64url encoding
- Enhanced QR payload with structured JSON

## 🎯 Demo Flow

### 1. Generate Demo Key
```javascript
// Creates demo key with policy
const demoKey = `pk_demo_${Math.random().toString(36).substring(2, 15)}`;
const policy = {
  kid: "demo-1234",
  ttlMinutes: 15,
  maxRequests: 10,
  scope: ["read"],
  geofence: ["US", "GB"],
  issuedAt: 1727460000
};
```

### 2. Create QR Code
```javascript
// QR payload for mobile apps
const qrPayload = {
  k: demoKey,
  p: policyB64,
  e: "https://proxkey-demo.workers.dev/demo/echo"
};
```

### 3. Test with cURL
```bash
curl -s "https://proxkey-demo.workers.dev/demo/echo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-ProxKey-Policy: $POLICY_B64URL" | jq .
```

## 🛠️ Deployment

### Deploy Demo Worker
```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy worker
./deploy-demo.sh
```

### Test Demo Endpoint
```bash
# Run test script
./test-demo.sh
```

## 📱 Mobile Integration

The QR code contains structured JSON that mobile apps can parse:

```json
{
  "k": "pk_demo_abc123...",
  "p": "eyJraWQiOiJkZW1vLTEyMzQi...",
  "e": "https://proxkey-demo.workers.dev/demo/echo"
}
```

- `k`: Demo API key
- `p`: Base64url encoded policy
- `e`: Demo endpoint URL

## 🎨 Logo Integration

**Logo File**: `public/logo.png`  
**Features**:
- ProxKey keyhole + hourglass design
- Gradient colors matching brand
- Optimized for QR code overlay
- High contrast for scanning

## 🔧 Configuration

### Worker Configuration
- **Name**: `proxkey-demo`
- **Main**: `src/worker.ts`
- **Compatibility**: `2024-10-01`

### QR Code Settings
- **Error Correction**: Level H (30% recovery)
- **Logo Scale**: 22% of QR size
- **Backplate**: White rounded rectangle
- **Size**: 200-260px (configurable)

## 🚀 Benefits

1. **No Backend Hits**: Demo endpoint is edge-only
2. **Realistic Experience**: Full header simulation
3. **Mobile Ready**: QR codes work on all devices
4. **Branded**: Logo integration maintains brand presence
5. **Safe**: No database or billing integration

## 📊 Demo Response Example

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "receivedAt": "2024-01-15T10:30:00.000Z",
  "message": "ProxKey demo echo — no backend calls performed.",
  "ok": true,
  "echo": {
    "authorization": "Bearer pk_demo_abc123...",
    "policy": {
      "kid": "demo-1234",
      "ttlMinutes": 15,
      "maxRequests": 10,
      "scope": ["read"],
      "geofence": ["US", "GB"],
      "issuedAt": 1727460000
    }
  },
  "tips": [
    "Use this endpoint for live demos without touching your DB.",
    "Headers: Authorization: Bearer <token>, X-ProxKey-Policy: <base64url(JSON)>"
  ]
}
```

## 🔄 Next Steps

1. **Deploy Worker**: Run `./deploy-demo.sh`
2. **Test Endpoint**: Run `./test-demo.sh`
3. **Update URLs**: Replace `proxkey-demo.workers.dev` with your domain
4. **Customize Logo**: Update `/logo.png` with your branding
5. **Integrate**: Use in your demo flows and presentations

This implementation provides a complete, production-ready demo system that showcases ProxKey's capabilities without any backend dependencies.
