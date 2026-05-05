# Hero Section Quick Start Guide

## 🚀 Getting Started in 60 Seconds

### 1. What You Get

A **premium, animated hero section** with:
- 🎬 Animated Access Core with motherboard traces
- 🔥 Fire gradient background with film grain
- ✨ Floating pixel particles and glitch effects
- 🎯 Cinematic CTA button with multiple glow layers
- 📱 Fully responsive mobile layout

---

## 🎯 Installation (Already Done!)

All components are ready to use:

```
src/components/
├── Hero.tsx                 ✅ Main component
├── AccessCore.tsx           ✅ Animated core node
├── ProxKeyLogo.tsx          ✅ Abstract logo
├── CinematicButton.tsx      ✅ Premium button
└── FloatingPixels.tsx       ✅ Particle system
```

---

## 🎨 Basic Usage

### In Your App

```tsx
import { Hero } from './components/Hero';

function App() {
  return (
    <Hero 
      onSignUp={() => {
        // Handle CTA click
        console.log('Sign up clicked!');
      }}
    />
  );
}
```

That's it! The hero is fully self-contained.

---

## ⚙️ Customization Options

### 1. Change the CTA Action

```tsx
<Hero 
  onSignUp={() => {
    window.location.href = '/signup';
  }}
/>
```

### 2. Use Components Independently

#### Access Core Only
```tsx
import { AccessCore } from './components/AccessCore';

<div className="w-full h-[500px]">
  <AccessCore isDark={true} showLogo={true} />
</div>
```

#### Cinematic Button Only
```tsx
import { CinematicButton } from './components/CinematicButton';

<CinematicButton 
  size="lg" 
  onClick={handleClick}
>
  Get Started
</CinematicButton>
```

#### ProxKey Logo Only
```tsx
import { ProxKeyLogo } from './components/ProxKeyLogo';

<ProxKeyLogo size={64} animated={true} />
```

#### Floating Pixels Only
```tsx
import { FloatingPixels } from './components/FloatingPixels';

<div className="relative">
  <FloatingPixels 
    count={10} 
    area="left" 
    color="rgba(251, 146, 60, 0.3)" 
  />
  <YourContent />
</div>
```

---

## 🎨 Quick Customizations

### Change Colors

**From orange to blue:**

```tsx
// In AccessCore.tsx (line ~88)
background: `
  radial-gradient(ellipse at 50% 50%, 
    rgba(59, 130, 246, 0.2) 0%,    // Blue instead of orange
    rgba(37, 99, 235, 0.15) 25%,
    rgba(29, 78, 216, 0.1) 50%,
    rgba(20, 14, 12, 0.05) 100%
  )
`
```

### Adjust Animation Speed

**Slower animations (more dramatic):**

```tsx
// In AccessCore.tsx (line ~50)
const interval = setInterval(() => {
  // ...
}, 3000);  // Change from 2000 to 3000 (slower)
```

### Change Headline Text

```tsx
// In Hero.tsx (line ~81-93)
<h1>
  Your custom<br />
  headline goes<br />
  here.
</h1>
```

### Change Subtext

```tsx
// In Hero.tsx (line ~96-100)
<p>
  Your custom subtext describing your product value.
</p>
```

---

## 📱 Responsive Behavior

The hero automatically adapts:

### Desktop (≥1024px)
- Two-column layout
- Full 8-trace animation
- All pixel effects active
- Mouse trail visible

### Mobile (<1024px)
- Vertical stack
- Square animation area
- Simplified 4-5 traces
- Touch-optimized

**No configuration needed** - it just works!

---

## 🎯 Common Use Cases

### 1. Landing Page Hero

```tsx
<Hero onSignUp={() => router.push('/signup')} />
```

### 2. Product Page

```tsx
<Hero onSignUp={() => {
  analytics.track('Hero CTA Clicked');
  openSignupModal();
}} />
```

### 3. Demo Page

```tsx
<Hero onSignUp={() => {
  scrollTo('#demo-section');
}} />
```

---

## 🔧 Props Reference

### Hero Component

```tsx
interface HeroProps {
  onGetStarted?: () => void;  // Legacy support
  onSignUp?: () => void;      // CTA click handler
}
```

### AccessCore Component

```tsx
interface AccessCoreProps {
  isDark?: boolean;    // Dark mode (default: true)
  showLogo?: boolean;  // Show logo vs text (default: true)
}
```

### CinematicButton Component

```tsx
interface CinematicButtonProps {
  children: React.ReactNode;  // Button text
  onClick?: () => void;       // Click handler
  size?: 'sm' | 'md' | 'lg';  // Size (default: 'lg')
  className?: string;         // Additional classes
  disabled?: boolean;         // Disabled state
  type?: 'button' | 'submit' | 'reset';
}
```

### ProxKeyLogo Component

```tsx
interface ProxKeyLogoProps {
  size?: number;       // Width/height in px (default: 64)
  animated?: boolean;  // Animate on mount (default: true)
  className?: string;  // Additional classes
}
```

### FloatingPixels Component

```tsx
interface FloatingPixelsProps {
  count?: number;              // Number of pixels (default: 12)
  area?: 'full' | 'left' | 'right';  // Distribution (default: 'left')
  color?: string;              // Pixel color (default: orange)
  minSize?: number;            // Min size px (default: 4)
  maxSize?: number;            // Max size px (default: 8)
}
```

---

## 🎬 Animation Control

### Disable All Animations (Accessibility)

```tsx
// In your app root
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

{!prefersReducedMotion && <FloatingPixels />}
```

### Adjust Individual Animation Speeds

```tsx
// In AccessCore.tsx
// Trace interval: line ~50
setInterval(() => {}, 2000);  // ← Change this

// Particle duration: line ~170
transition={{ duration: 2 }}  // ← Change this

// Chip pulse: line ~247
transition={{ duration: 3 }}  // ← Change this
```

---

## 🐛 Troubleshooting

### Issue: Animations not playing

**Solution:** Check Framer Motion is installed
```bash
npm list motion
# Should show: motion@12.23.12
```

### Issue: Logo not appearing

**Solution:** Ensure ProxKeyLogo is imported
```tsx
// In AccessCore.tsx (line 3)
import { ProxKeyLogo } from './ProxKeyLogo';
```

### Issue: Button not glowing

**Solution:** Check Tailwind config includes orange colors
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        orange: { /* Tailwind default orange */ }
      }
    }
  }
}
```

### Issue: Mobile layout broken

**Solution:** Verify Tailwind breakpoints
```tsx
// Should have lg: prefix for desktop-only styles
className="hidden lg:grid"
```

---

## 📊 Performance Tips

### 1. Reduce Particle Count on Mobile

```tsx
const isMobile = window.innerWidth < 768;

<FloatingPixels count={isMobile ? 6 : 12} />
```

### 2. Lazy Load Heavy Components

```tsx
import { lazy, Suspense } from 'react';

const AccessCore = lazy(() => import('./AccessCore'));

<Suspense fallback={<LoadingSpinner />}>
  <AccessCore />
</Suspense>
```

### 3. Disable Expensive Effects on Low-End Devices

```tsx
const isLowEndDevice = navigator.hardwareConcurrency <= 4;

{!isLowEndDevice && <PixelGlitch />}
```

---

## 🎨 Design Tokens

### Colors (Copy-Paste Ready)

```css
/* Fire Gradient */
--orange-50:  #fff7ed;
--orange-400: #fb923c;
--orange-500: #f97316;
--orange-600: #ea580c;
--orange-700: #c2410c;
--orange-900: #9a3412;

/* Dark Backgrounds */
--dark-1: rgba(20, 14, 12, 0.95);
--dark-2: rgba(30, 20, 15, 0.95);

/* Glows */
--glow-soft:   0 0 20px rgba(251, 146, 60, 0.3);
--glow-medium: 0 0 40px rgba(251, 146, 60, 0.2);
--glow-strong: 0 0 60px rgba(251, 146, 60, 0.4);
```

### Typography

```css
/* Headline */
font-family: Helvetica, Arial, sans-serif;
font-weight: 900;
font-size: 6rem;      /* Desktop */
line-height: 1.05;
letter-spacing: -0.02em;

/* Subtext */
font-family: Helvetica, Arial, sans-serif;
font-weight: 400;
font-size: 1.25rem;   /* Desktop */
line-height: 1.75rem;
```

### Spacing

```css
/* Component gaps */
--gap-content:  4rem;   /* Between text and animation */
--gap-vertical: 2.5rem; /* Mobile vertical spacing */
--gap-elements: 2rem;   /* Between headline and subtext */

/* Animation sizes */
--core-desktop: 40rem;  /* 160px */
--core-mobile:  32rem;  /* 128px */
```

---

## ✅ Testing Checklist

Before deploying, verify:

- [ ] Hero loads on page mount
- [ ] CTA button triggers `onSignUp` callback
- [ ] Animations play smoothly (60fps)
- [ ] Mobile layout stacks vertically
- [ ] Button click produces sparkles
- [ ] Traces light up sequentially
- [ ] Particles travel along traces
- [ ] Glitch effect triggers occasionally
- [ ] Floating pixels drift naturally
- [ ] Dark mode works (if supported)
- [ ] Reduced motion respected (if implemented)
- [ ] No console errors
- [ ] No linter warnings

---

## 🚀 Going Live

### Build for Production

```bash
npm run build
```

### Verify Bundle Size

```bash
# Should see:
# AccessCore: ~8KB
# CinematicButton: ~5KB
# FloatingPixels: ~4KB
# ProxKeyLogo: ~3KB
```

### Deploy

```bash
npm run deploy
# or your deployment command
```

---

## 📚 Additional Resources

- **Full Documentation:** `HERO_IMPLEMENTATION.md`
- **Before/After Comparison:** `HERO_BEFORE_AFTER.md`
- **Component Source:** `src/components/`
- **Framer Motion Docs:** https://motion.dev
- **Tailwind Docs:** https://tailwindcss.com

---

## 🎉 You're Done!

Your hero section is now:

- ✅ Premium and animated
- ✅ On-brand with pixel aesthetics
- ✅ Mobile responsive
- ✅ Performance optimized
- ✅ Fully documented

**Enjoy your stunning new hero section!** 🔥

---

**Questions?** Check the full documentation in `HERO_IMPLEMENTATION.md`  
**Issues?** See troubleshooting section above  
**Customizations?** All components are modular and flexible  

**Made with ❤️ for ProxKey**




