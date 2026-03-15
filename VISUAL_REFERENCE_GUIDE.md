# Visual Reference & Component Guide

## Color Palette Reference

### Dark Theme (Primary)
```
Background:        #121212 (Deep Matte Black)
Card:              #242424 (Card Grey)
Card Hover:        #2D2D2D (Elevated)
Border:            #3F3F3F (Subtle)
Text Primary:      #FFFFFF (White)
Text Secondary:    #B3B3B3 (Light Grey)
Text Muted:        #808080 (Muted Grey)

Accents:
  Lime (Primary):  #CCFF00 (Electric Lime)
  Lime (Hover):    #A8D700 (Darker Lime)
  Debit/Loss:      #FF4757 (Red)
  Credit/Gain:     #2ED573 (Green)
  Alert/Warning:   #FFA502 (Orange)
  Info/Highlight:  #1E90FF (Blue)
```

### Tailwind CSS Usage
```tsx
// Backgrounds
className="bg-dark-bg"           // #121212
className="bg-dark-card"         // #242424
className="bg-dark-card-hover"   // #2D2D2D

// Text
className="text-dark-text-primary"     // White
className="text-dark-text-secondary"   // Light Grey
className="text-dark-text-muted"       // Muted

// Accents
className="bg-accent-lime"       // #CCFF00
className="bg-accent-red"        // #FF4757
className="bg-accent-green"      // #2ED573
className="bg-accent-yellow"     // #FFA502
className="bg-accent-blue"       // #1E90FF
```

---

## Typography System

### Font Stack
```
"Inter, Circular, Roboto, system-ui, sans-serif"
```

### Text Sizes
| Use Case | Size | Weight | Example |
|----------|------|--------|---------|
| Headings (H1) | 32px | Bold (700) | "Dashboard" |
| Headings (H2) | 24px | Bold (700) | "Recent Transactions" |
| Headings (H3) | 20px | Semibold (600) | Card titles |
| Body Text | 16px | Regular (400) | Descriptions |
| Small Text | 14px | Regular (400) | Labels |
| Tiny Text | 12px | Medium (500) | Captions |
| Currency | 28px+ | Bold (700) | "₹ 52,358" |

---

## Component Specifications

### Cards
```tsx
// Base Card
className="rounded-card border-1 border-dark-border p-4 sm:p-6"

// Interactive Card
className="rounded-card bg-dark-card hover:bg-dark-card-hover transition-colors cursor-pointer"

// Card Shadow
className="shadow-lg hover:shadow-xl transition-shadow"
```

### Buttons
```tsx
// Primary Button
className="px-4 py-2 bg-accent-lime text-dark-bg rounded-button font-medium hover:bg-accent-lime-dark transition-colors"

// Secondary Button
className="px-4 py-2 bg-dark-card text-text-primary border border-dark-border rounded-button font-medium hover:bg-dark-card-hover transition-colors"

// Destructive Button
className="px-4 py-2 bg-accent-red text-white rounded-button font-medium hover:opacity-90"
```

### Input Fields
```tsx
// Standard Input
className="px-3 py-2 bg-dark-bg border border-dark-border rounded-input text-text-primary focus:border-accent-lime focus:outline-none"

// With Label
<div>
  <label className="text-sm text-text-secondary mb-2 block">Label</label>
  <input className="w-full px-3 py-2 ..." />
</div>
```

### Badge/Tag
```tsx
// Status Badge
className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-lime/10 text-accent-lime border border-accent-lime/30"

// Category Badge
className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-dark-card text-text-secondary"
```

---

## Dashboard Layout Structure

### Page Layout
```
┌─────────────────────────────────────────────┐
│           Top Bar (Fixed)                   │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │      Main Content Area           │
│ (Desktop)│      (Scrollable)                │
│          │                                  │
│          │  ┌──────────────────────────┐   │
│          │  │ Month Selector + Sync    │   │
│          │  ├──────────────────────────┤   │
│          │  │ Total Balance / Expense  │   │
│          │  ├──────────────────────────┤   │
│          │  │ Accounts (Horiz Scroll) │   │
│          │  ├──────────────────────────┤   │
│          │  │ Credit Cards (Scroll)    │   │
│          │  ├──────────────────────────┤   │
│          │  │ Recent Transactions      │   │
│          │  │ (Horizontal Cards)       │   │
│          │  └──────────────────────────┘   │
│          │                                  │
├──────────┴──────────────────────────────────┤
│     Bottom Navigation (Mobile Only)         │
└─────────────────────────────────────────────┘
```

### Recent Transactions Card
```
┌─────────────────┐
│   💳 (Icon)     │
│ Starbucks       │
│ Coffee          │ (Category)
├─────────────────┤
│ Jan 15    -₹47  │
└─────────────────┘
← → (Horizontally scrollable)
```

### Credit Card
```
┌────────────────────────┐
│ HDFC Bank              │
│ •••• 5678              │
│                        │
│ Outstanding: ₹15,000   │
└────────────────────────┘
← → (Horizontally scrollable)
```

---

## Spacing System

### Padding/Margin Scale
```
xs: 4px    (p-1, m-1)
sm: 8px    (p-2, m-2)
md: 12px   (p-3, m-3)
lg: 16px   (p-4, m-4)
xl: 24px   (p-6, m-6)
2xl: 32px  (p-8, m-8)
3xl: 48px  (p-12, m-12)
```

### Common Spacing Patterns
```tsx
// Page padding
className="p-4 sm:p-6 lg:p-8"

// Section gap
className="gap-4 sm:gap-6 lg:gap-8"

// Card padding
className="p-4 sm:p-6"

// Grid gap
className="gap-4 md:gap-6"
```

---

## Responsive Breakpoints

```
Mobile:   < 640px   (sm)
Tablet:   640px+    (md)
Desktop:  1024px+   (lg)
Large:    1280px+   (xl)
```

### Usage
```tsx
// Mobile first approach
className="text-sm sm:text-base lg:text-lg"
className="flex flex-col md:flex-row"
className="p-4 md:p-6 lg:p-8"
```

---

## Horizontal Scroll Implementation

### For Recent Transactions
```tsx
<div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
  {/* Cards */}
</div>
```

**Key points:**
- `overflow-x-auto` - Enables scrolling
- `pb-4` - Bottom padding for scrollbar
- `-mx-4 px-4` - Negative margin hack for full width on mobile
- `snap-x snap-mandatory` - Snap points for smooth scroll

### For Credit Cards
```tsx
<div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
  {/* Card components */}
</div>
```

---

## Month Selector Component

```tsx
<div className="flex items-center gap-3 mt-3">
  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
    <ChevronRight size={18} className="rotate-180" />
  </button>
  <div className="px-4 py-1.5 bg-gray-100 rounded-lg min-w-[150px] text-center font-medium">
    January 2024
  </div>
  <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
    <ChevronRight size={18} />
  </button>
</div>
```

---

## Icon Usage

### Icons from Lucide React
```tsx
import { TrendingUp, TrendingDown, ChevronRight, RefreshCw } from 'lucide-react';

// Sizing
<TrendingUp size={16} />   // Small
<TrendingUp size={20} />   // Medium
<TrendingUp size={24} />   // Large
<TrendingUp size={32} />   // XLarge

// Colors
<TrendingUp className="text-accent-green" />
<TrendingDown className="text-accent-red" />
```

---

## Dark Theme Implementation

### Application
```tsx
// In AppLayout.tsx
const isDark = theme === 'dark';

<div className={`${isDark ? 'bg-dark-bg text-dark-text-primary' : 'bg-gray-50 text-gray-900'}`}>
  {/* Content */}
</div>
```

### CSS Approach
```css
/* In index.css */
.dark .bg-white { background-color: #121212 !important; }
.dark .text-gray-900 { color: #e6eef8 !important; }
/* etc */
```

---

## Animation & Transitions

```tsx
// Smooth color transition
className="transition-colors"

// Smooth shadow transition
className="transition-shadow"

// All transitions
className="transition-all"

// Spinning animation (for loading)
className="animate-spin"

// Pulsing animation
className="animate-pulse"
```

---

## Accessibility

### Focus States
```tsx
className="focus:outline-none focus:ring-2 focus:ring-accent-lime"
```

### Disabled State
```tsx
className="disabled:opacity-50 disabled:cursor-not-allowed"
```

### ARIA Labels
```tsx
<button aria-label="Sync account balances">
  <RefreshCw size={18} />
</button>
```

---

## Performance Tips

### Lazy Loading
```tsx
import { lazy, Suspense } from 'react';
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<LoadingSpinner />}>
  <Dashboard />
</Suspense>
```

### Image Optimization
```tsx
<img src="..." loading="lazy" alt="Description" />
```

### Memoization
```tsx
import { memo } from 'react';
export const Card = memo(({ children }) => <div>{children}</div>);
```

---

## Common Patterns

### Loading State
```tsx
<div className="w-12 h-12 border-4 border-accent-lime border-t-transparent rounded-full animate-spin" />
```

### Error Message
```tsx
<div className="p-4 bg-accent-red/10 border border-accent-red rounded-lg">
  <p className="text-accent-red text-sm">Error message here</p>
</div>
```

### Success Message
```tsx
<div className="p-4 bg-accent-green/10 border border-accent-green rounded-lg">
  <p className="text-accent-green text-sm">Success message here</p>
</div>
```

### Empty State
```tsx
<div className="text-center py-8 text-text-muted">
  <p className="text-sm">No transactions found</p>
</div>
```

---

## Utility Classes Quick Reference

```tsx
// Display
className="block / inline-block / inline / flex / grid"

// Flex Direction
className="flex-col / flex-row"

// Alignment
className="items-center / items-start / items-end"
className="justify-center / justify-between / justify-start"

// Sizing
className="w-full / w-1/2 / w-1/4"
className="h-full / h-screen"

// Background
className="bg-dark-bg / bg-dark-card"
className="bg-opacity-50"

// Border
className="border border-dark-border"
className="rounded-card / rounded-button / rounded-input"

// Shadow
className="shadow-sm / shadow-lg / shadow-xl"

// Opacity
className="opacity-50 / opacity-75 / opacity-100"

// Transform
className="scale-100 / scale-105 / scale-110"
className="rotate-45 / rotate-180"
className="translate-x-2 / translate-y-2"
```

---

## Component Library Structure

```
frontend/src/
├── components/
│   ├── AppLayout.tsx         (Main layout wrapper)
│   ├── TopBar.tsx            (Header)
│   ├── Sidebar.tsx           (Navigation)
│   ├── BottomNav.tsx         (Mobile nav)
│   └── [...other components]
├── pages/
│   ├── Dashboard.tsx         (Main page)
│   └── [...other pages]
├── services/
│   └── api.ts                (API calls)
├── store/
│   └── index.ts              (State management)
├── types/
│   └── index.ts              (Type definitions)
├── utils/
│   └── formatters.ts         (Utilities)
└── index.css                 (Global styles)
```

---

This visual reference guide covers all styling, components, and patterns used in the Money Manager application. Refer back when building new features!
