# Open Graph Meta Tags Setup

This document explains the Open Graph meta tags implementation for rich link previews in iMessage, Facebook, Twitter, and other social platforms.

## What's Implemented

### 1. Next.js App Router (Primary)
- **File**: `src/app/layout.tsx`
- **Features**: Server-side rendered meta tags using Next.js 13+ Metadata API
- **Benefits**: Automatic optimization, type safety, and better SEO

### 2. Vite/React Fallback
- **File**: `index.html`
- **Features**: Static meta tags in HTML head
- **Benefits**: Works with client-side rendering

### 3. Open Graph Image
- **SVG Source**: `public/og/cover-1200x630.svg`
- **Generated JPG**: `public/og/cover-1200x630.jpg` (via script)
- **Dimensions**: 1200×630 pixels (optimal for social media)

## Meta Tags Included

### Primary Meta Tags
- `title`: Page title
- `description`: Page description
- `keywords`: SEO keywords
- `author`: Content author
- `robots`: Search engine directives

### Open Graph (Facebook/iMessage)
- `og:type`: Content type (website)
- `og:url`: Canonical URL
- `og:title`: Social media title
- `og:description`: Social media description
- `og:image`: Social media image
- `og:image:width` & `og:image:height`: Image dimensions
- `og:image:alt`: Image alt text
- `og:image:type`: Image MIME type
- `og:site_name`: Site name
- `og:locale`: Content locale

### Twitter Cards
- `twitter:card`: Card type (summary_large_image)
- `twitter:title`: Twitter title
- `twitter:description`: Twitter description
- `twitter:image`: Twitter image
- `twitter:image:alt`: Image alt text
- `twitter:creator`: Content creator handle
- `twitter:site`: Site handle

### Additional SEO
- `canonical`: Canonical URL
- `format-detection`: Disable auto-detection
- `robots`: Search engine directives
- `googlebot`: Google-specific directives

## Usage

### Generate Open Graph Image
```bash
npm run generate:og
```

This script:
1. Converts the SVG to JPG for better compatibility
2. Updates meta tags to use the JPG version
3. Ensures optimal file size and format

### Development
```bash
# Next.js (recommended)
npm run dev

# Vite (fallback)
npm run dev:vite
```

### Production Build
```bash
# Next.js
npm run build
npm run start

# Vite
npm run build:vite
npm run preview:vite
```

## Testing

### 1. Basic Validation
```bash
# Check if page loads correctly
curl -I https://yourdomain.com/

# Should return:
# HTTP/1.1 200 OK
# Content-Type: text/html; charset=utf-8
```

### 2. Meta Tag Validation
```bash
# Extract meta tags
curl -s https://yourdomain.com/ | grep -E '<meta|og:|twitter:'
```

### 3. Social Media Validators
- **Facebook**: https://developers.facebook.com/tools/debug/
- **Twitter**: https://cards-dev.twitter.com/validator
- **LinkedIn**: https://www.linkedin.com/post-inspector/

### 4. iMessage Testing
1. Send the URL to yourself in iMessage
2. Check if rich preview appears
3. Verify image loads correctly

## Customization

### Update Domain
Replace `https://proxkey.com` with your actual domain in:
- `src/app/layout.tsx` (metadataBase)
- `index.html` (og:url, twitter:url, canonical)

### Update Social Handles
Replace `@proxkey` with your actual handles in:
- `src/app/layout.tsx` (twitter.creator, twitter.site)
- `index.html` (twitter:creator, twitter:site)

### Customize Image
1. Edit `public/og/cover-1200x630.svg`
2. Run `npm run generate:og`
3. Or replace with your own 1200×630 image

### Add Page-Specific Meta Tags
For Next.js pages, add metadata export:

```typescript
// app/specific-page/page.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Specific Page Title',
  description: 'Specific page description',
  openGraph: {
    title: 'Specific Page Title',
    description: 'Specific page description',
    url: 'https://proxkey.com/specific-page',
  },
}

export default function SpecificPage() {
  return <div>Page content</div>
}
```

## Troubleshooting

### Common Issues

1. **No Preview in iMessage**
   - Ensure page is publicly accessible (no auth required)
   - Check that image URL is absolute and accessible
   - Verify meta tags are in HTML (not added by JavaScript)

2. **Image Not Loading**
   - Check image file exists and is accessible
   - Verify image dimensions are exactly 1200×630
   - Ensure image file size is under 5MB

3. **Wrong Domain in Preview**
   - Update `og:url` to match the actual URL being shared
   - Ensure canonical URL is correct

4. **Meta Tags Not Appearing**
   - For Next.js: Check if metadata is properly exported
   - For Vite: Ensure meta tags are in the HTML head
   - Verify no JavaScript errors are preventing rendering

### Debug Commands

```bash
# Check if page is accessible
curl -I https://yourdomain.com/

# View page source
curl -s https://yourdomain.com/ | head -50

# Check specific meta tags
curl -s https://yourdomain.com/ | grep -A1 -B1 "og:title"

# Test image accessibility
curl -I https://yourdomain.com/og/cover-1200x630.jpg
```

## Best Practices

1. **Always use absolute URLs** for `og:url` and `og:image`
2. **Keep images under 5MB** for fast loading
3. **Use HTTPS** for all URLs
4. **Test with multiple platforms** (Facebook, Twitter, LinkedIn, iMessage)
5. **Update meta tags** when content changes
6. **Use descriptive alt text** for images
7. **Keep titles under 60 characters** for optimal display
8. **Keep descriptions under 160 characters** for optimal display

## File Structure

```
frontend/
├── public/
│   └── og/
│       ├── cover-1200x630.svg    # Source SVG
│       └── cover-1200x630.jpg    # Generated JPG
├── scripts/
│   └── generate-og-image.js      # Image generation script
├── src/
│   └── app/
│       └── layout.tsx            # Next.js meta tags
├── index.html                    # Vite meta tags
└── package.json                  # Scripts and dependencies
```
