# Splash Screen Responsive Images Implementation Guide

## Current State
Splash Screen currently uses same image for all screen sizes, making desktop view look poor.

## Solution: Responsive Image Strategy

### Implementation Approach

We need to serve different splash screen images based on device type and viewport size:

- **Mobile (< 768px):** Portrait splash image
- **Tablet (768px - 1024px):** Landscape splash image  
- **Desktop (> 1024px):** Wide/full-screen splash image

### Step 1: Check Current Splash Screen Component

Location: `frontend/src/components/SplashScreen.tsx`

Check how it currently loads the image.

### Step 2: Update Splash Screen Component

Modify to use responsive image loading:

```tsx
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  isLoading: boolean;
  isDark: boolean;
}

export const SplashScreen = ({ isLoading, isDark }: SplashScreenProps) => {
  const [splashImage, setSplashImage] = useState<string>('');

  useEffect(() => {
    // Determine screen size and select appropriate splash image
    const updateSplashImage = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let imagePath = '';
      
      if (width < 768) {
        // Mobile portrait
        imagePath = isDark 
          ? '/splash/mobile-dark.png'
          : '/splash/mobile-light.png';
      } else if (width < 1024) {
        // Tablet
        imagePath = isDark
          ? '/splash/tablet-dark.png'
          : '/splash/tablet-light.png';
      } else {
        // Desktop
        imagePath = isDark
          ? '/splash/desktop-dark.png'
          : '/splash/desktop-light.png';
      }
      
      setSplashImage(imagePath);
    };

    updateSplashImage();
    window.addEventListener('resize', updateSplashImage);
    return () => window.removeEventListener('resize', updateSplashImage);
  }, [isDark]);

  if (!isLoading) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      isDark ? 'bg-dark-bg' : 'bg-gray-50'
    }`}>
      {splashImage && (
        <img
          src={splashImage}
          alt="Loading..."
          className="w-full h-full object-cover"
          loading="eager"
        />
      )}
      
      {/* Fallback loading indicator if image fails */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`flex flex-col items-center gap-4 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Loading...</p>
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Prepare Splash Images

Create splash screen images in `public/splash/`:

**Required images (6 total):**
1. `mobile-dark.png` (500x900px) - Portrait for mobile dark theme
2. `mobile-light.png` (500x900px) - Portrait for mobile light theme
3. `tablet-dark.png` (800x1024px) - Landscape for tablet dark theme
4. `tablet-light.png` (800x1024px) - Landscape for tablet light theme
5. `desktop-dark.png` (1920x1080px) - Wide for desktop dark theme
6. `desktop-light.png` (1920x1080px) - Wide for desktop light theme

### Step 4: Image Specifications

**Mobile Splash (500x900px):**
- Portrait orientation
- Company logo centered
- Neumorphic design elements
- Dark theme: Deep black background with accent lime highlights
- Light theme: Light grey with blue accents
- Optional: Loading animation

**Tablet Splash (800x1024px):**
- Landscape orientation
- Larger logo
- More breathing room
- Design elements positioned for landscape
- Same color scheme as mobile

**Desktop Splash (1920x1080px):**
- Full-width landscape
- Professional, spacious layout
- Could feature dashboard preview/mockup
- Hero image quality
- Premium feel

### Step 5: Alternative - SVG-Based Splash (Lighter)

If you prefer lighter file sizes, create SVG splash screens:

```tsx
const MobileSplash = () => (
  <svg viewBox="0 0 500 900" className="w-full h-full">
    {/* SVG content */}
  </svg>
);

const TabletSplash = () => (
  <svg viewBox="0 0 800 1024" className="w-full h-full">
    {/* SVG content */}
  </svg>
);

const DesktopSplash = () => (
  <svg viewBox="0 0 1920 1080" className="w-full h-full">
    {/* SVG content */}
  </svg>
);
```

### Step 6: Optimize Images

Use tools to optimize splash images:
- ImageOptim or TinyPNG for PNG compression
- Use WebP format with fallback PNG
- Minimize bundle impact

### Implementation Priority

1. **High:** Mobile splash - most users
2. **Medium:** Tablet splash - better iPad experience
3. **Low:** Desktop splash - can start with mobile image

### Additional Enhancements

**Add preload hint:**
```html
<link rel="preload" as="image" href="/splash/mobile-light.png" />
<link rel="preload" as="image" href="/splash/mobile-dark.png" />
```

**Lazy load non-critical sizes:**
```tsx
const image = new Image();
image.src = splashImage;
// Preload for smoother transition
```

**Animated gradient splash (CSS-based alternative):**
```tsx
<div className="w-full h-full bg-gradient-to-br from-dark-bg via-dark-card to-accent-lime animate-pulse" />
```

---

## Implementation Steps Summary

1. ✅ **Analyze** current SplashScreen component
2. ✅ **Update** component with responsive logic
3. ✅ **Create** 6 splash images (or 3 if SVG-based)
4. ✅ **Optimize** image file sizes
5. ✅ **Test** on mobile, tablet, desktop
6. ✅ **Add** preload hints for better performance

## Files to Update

- `frontend/src/components/SplashScreen.tsx` - Update with responsive logic
- `public/splash/` - Add splash images (new directory)
- `frontend/index.html` - Add preload hints

## Testing

```
Mobile (< 768px):      Loads mobile splash (portrait)
Tablet (768-1024px):   Loads tablet splash (landscape)
Desktop (> 1024px):    Loads desktop splash (wide)
Resize window:         Splash updates appropriately
Dark mode:             Uses dark theme splash
Light mode:            Uses light theme splash
```

This ensures the splash screen looks great on all devices while being responsive to theme changes!
