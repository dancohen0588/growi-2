# Growi Frontend — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Growi frontend Phase 1 — design system, shared layout (Header/Footer), and homepage (8 sections) — as a Next.js 14 App Router project.

**Architecture:** Foundation-first: scaffold → design tokens → shared components → layout → homepage sections. All data is static/mocked. No API calls. The project lives at `growi-2/growi-frontend/`.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · Framer Motion · lucide-react · next/font · next/image

**Spec:** `docs/superpowers/specs/2026-04-02-growi-frontend-phase1-design.md`

---

## File Map

| File | Purpose |
|------|---------|
| `growi-frontend/app/globals.css` | Design tokens — HSL CSS variables for shadcn + Growi palette |
| `growi-frontend/tailwind.config.ts` | Colors, fonts, shadows, `animate-float` keyframe |
| `growi-frontend/next.config.ts` | `optimizeCss`, image formats |
| `growi-frontend/lib/utils.ts` | `cn()` utility |
| `growi-frontend/lib/animations.ts` | Framer Motion variants: fadeUp, fadeIn, staggerContainer, scaleIn |
| `growi-frontend/components/ui/button.tsx` | shadcn Button extended with Growi variants (primary, forest, outline, ghost) |
| `growi-frontend/components/ui/section-wrapper.tsx` | `'use client'` — Framer Motion wrapper, variant prop, fadeUp whileInView |
| `growi-frontend/components/ui/app-mockup.tsx` | Rich CSS smartphone dashboard (server component) |
| `growi-frontend/components/layout/Header.tsx` | `'use client'` — sticky nav, scroll blur, Sheet mobile menu |
| `growi-frontend/components/layout/Footer.tsx` | 4-col grid, social icons, Separator |
| `growi-frontend/app/layout.tsx` | Root layout: next/font, metadata, Header + Footer in `<body>` |
| `growi-frontend/app/page.tsx` | Assembles 8 homepage sections inside `<main>` |
| `growi-frontend/components/home/HeroSection.tsx` | 2-col grid, AppMockup, badges under CTAs |
| `growi-frontend/components/home/HowItWorks.tsx` | 3 steps, numbered circles, stagger |
| `growi-frontend/components/home/AppPreview.tsx` | `bg-forest`, mockup + 4 floating cards |
| `growi-frontend/components/home/FeaturesGrid.tsx` | 6-card grid, lucide icons |
| `growi-frontend/components/home/Testimonials.tsx` | `'use client'` — shadcn Carousel, 3 testimonials |
| `growi-frontend/components/home/ProSection.tsx` | 2-col, laptop mockup CSS, checkpoints |
| `growi-frontend/components/home/FinalCTA.tsx` | Gradient bg, 2 store buttons with inline SVG |

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `growi-frontend/` (via create-next-app)

- [ ] **Step 1: Run create-next-app from growi-2/**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
npx create-next-app@latest growi-frontend \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --no-git
```

When prompted, accept defaults. `--no-git` avoids a nested git repo.

Expected: `growi-frontend/` directory created with Next.js 14 boilerplate.

- [ ] **Step 2: Verify initial build**

```bash
cd growi-frontend
npm run build
```

Expected: Build succeeds with no TypeScript errors. You'll see route `/` compiled.

- [ ] **Step 3: Commit scaffold**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend
git commit -m "feat: scaffold Next.js 14 growi-frontend"
```

---

## Task 2: Install dependencies and initialize shadcn

**Files:**
- Modify: `growi-frontend/package.json`
- Modify: `growi-frontend/components/ui/` (shadcn generates components here)

- [ ] **Step 1: Install runtime dependencies**

```bash
cd growi-frontend
npm install framer-motion lucide-react react-hook-form zod @hookform/resolvers
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate
```

Expected: All packages installed with no peer dependency errors.

- [ ] **Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

Expected: `components/ui/` directory created, `globals.css` updated with shadcn CSS variables.

- [ ] **Step 3: Add shadcn components needed for Phase 1**

```bash
npx shadcn@latest add button card badge carousel sheet separator
```

Expected: Components appear in `components/ui/`. Embla Carousel dependency installed.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend
git commit -m "feat: install deps and initialize shadcn/ui"
```

---

## Task 3: Design tokens — globals.css and tailwind.config.ts

**Files:**
- Modify: `growi-frontend/app/globals.css`
- Modify: `growi-frontend/tailwind.config.ts`
- Modify: `growi-frontend/next.config.ts`

- [ ] **Step 1: Replace app/globals.css with Growi tokens**

Replace the entire content of `growi-frontend/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Growi palette (HSL space-separated for shadcn) */
    --color-lime:   179 83% 67%;
    --color-forest: 139 51% 23%;
    --color-sand:   52 50% 95%;
    --color-sun:    43 91% 62%;

    /* shadcn tokens mapped to Growi */
    --background:             52 50% 95%;
    --foreground:             139 51% 23%;
    --card:                   52 50% 97%;
    --card-foreground:        139 51% 23%;
    --popover:                52 50% 97%;
    --popover-foreground:     139 51% 23%;
    --primary:                179 83% 67%;
    --primary-foreground:     139 51% 23%;
    --secondary:              52 50% 90%;
    --secondary-foreground:   139 51% 23%;
    --muted:                  52 30% 88%;
    --muted-foreground:       139 20% 40%;
    --accent:                 43 91% 62%;
    --accent-foreground:      139 51% 23%;
    --destructive:            0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border:                 139 20% 80%;
    --input:                  139 20% 80%;
    --ring:                   179 83% 67%;
    --radius:                 0.75rem;

    --space-section:   5rem;
    --space-container: 2rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-raleway;
  }
  h1, h2, h3, h4, h5, h6 {
    @apply font-poppins;
  }
}

/* Respect prefers-reduced-motion for Tailwind animation classes */
@media (prefers-reduced-motion: reduce) {
  .animate-float,
  .animate-pulse-soft {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Replace tailwind.config.ts**

Replace the entire content of `growi-frontend/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        lime:   { DEFAULT: '#B4DD7F', hover: '#a2cf6b' },
        forest: { DEFAULT: '#1E5631', light: '#2d7a47' },
        sand:   { DEFAULT: '#F9F7E8', dark: '#ede9cc' },
        sun:    { DEFAULT: '#F6C445', hover: '#e4b030' },
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      fontFamily: {
        poppins: ['var(--font-poppins)', 'sans-serif'],
        raleway: ['var(--font-raleway)', 'sans-serif'],
      },
      borderRadius: {
        lg:   'var(--radius)',
        xl:   'calc(var(--radius) + 4px)',
        '2xl':'calc(var(--radius) + 8px)',
        '3xl':'calc(var(--radius) + 16px)',
        full: '9999px',
      },
      boxShadow: {
        card:         '0 2px 12px rgba(30, 86, 49, 0.08)',
        'card-hover': '0 8px 24px rgba(30, 86, 49, 0.14)',
        cta:          '0 4px 20px rgba(180, 221, 127, 0.5)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        float:            'float 6s ease-in-out infinite',
        'pulse-soft':     'pulse 3s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

- [ ] **Step 3: Update next.config.ts**

Replace the content of `growi-frontend/next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
}

export default config
```

Note: `optimizeCss: true` requires the `critters` package and may cause build issues without it — omit for now.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend
git commit -m "feat: add Growi design tokens to globals.css and tailwind config"
```

---

## Task 4: Create lib/utils.ts and lib/animations.ts

**Files:**
- Modify: `growi-frontend/lib/utils.ts`
- Create: `growi-frontend/lib/animations.ts`

- [ ] **Step 1: Verify/update lib/utils.ts**

shadcn already generates this file. Confirm it contains `cn()`:

```typescript
// growi-frontend/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If shadcn generated a different version, replace with the above.

- [ ] **Step 2: Create lib/animations.ts**

```typescript
// growi-frontend/lib/animations.ts
import type { Variants } from 'framer-motion'

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}

export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/lib
git commit -m "feat: add cn() utility and Framer Motion animation variants"
```

---

## Task 5: Extend Button component with Growi variants

**Files:**
- Modify: `growi-frontend/components/ui/button.tsx`

shadcn generates a `button.tsx` with `buttonVariants` via CVA. We extend it with the four Growi variants.

- [ ] **Step 1: Replace components/ui/button.tsx**

```typescript
// growi-frontend/components/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base styles applied to all variants
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-poppins font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-lime text-forest shadow-cta hover:bg-lime-hover active:scale-[0.98]',
        forest:
          'bg-forest text-white hover:bg-forest-light',
        outline:
          'border-2 border-forest text-forest bg-transparent hover:bg-forest/10',
        ghost:
          'text-forest bg-transparent hover:bg-forest/5',
        // Keep shadcn defaults for internal shadcn component usage
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        link:
          'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2 text-base rounded-lg min-w-[44px] min-h-[44px]',
        sm:      'h-9 px-4 text-sm rounded-lg min-w-[44px] min-h-[44px]',
        lg:      'h-14 px-8 text-lg rounded-xl min-w-[44px] min-h-[44px]',
        icon:    'h-11 w-11 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/ui/button.tsx
git commit -m "feat: extend shadcn Button with Growi variants (primary, forest, outline, ghost)"
```

---

## Task 6: Create SectionWrapper component

**Files:**
- Create: `growi-frontend/components/ui/section-wrapper.tsx`

- [ ] **Step 1: Create the file**

```typescript
// growi-frontend/components/ui/section-wrapper.tsx
'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { fadeUp, staggerContainer } from '@/lib/animations'

const variantStyles: Record<string, string> = {
  sand:     'bg-sand',
  white:    'bg-white',
  forest:   'bg-forest text-white',
  gradient: 'bg-gradient-to-r from-lime to-forest text-white',
}

interface SectionWrapperProps {
  id?: string
  className?: string
  children: React.ReactNode
  variant?: 'sand' | 'white' | 'forest' | 'gradient'
  'aria-label'?: string
}

export function SectionWrapper({
  id,
  className,
  children,
  variant = 'sand',
  'aria-label': ariaLabel,
}: SectionWrapperProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn('py-20 md:py-28', variantStyles[variant], className)}
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        viewport={{ once: true, margin: '-100px' }}
      >
        <motion.div
          variants={shouldReduceMotion ? undefined : fadeUp}
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/ui/section-wrapper.tsx
git commit -m "feat: add SectionWrapper with Framer Motion fadeUp and stagger"
```

---

## Task 7: Create AppMockup component

**Files:**
- Create: `growi-frontend/components/ui/app-mockup.tsx`

This is a server component (pure CSS, no JS interactivity). The `animate-float` CSS animation is applied as a class; `globals.css` disables it via `prefers-reduced-motion` media query.

- [ ] **Step 1: Create the file**

```typescript
// growi-frontend/components/ui/app-mockup.tsx

export function AppMockup() {
  return (
    <div className="flex items-center justify-center w-full">
      {/* Phone frame */}
      <div
        className="relative animate-float"
        style={{ width: '220px', height: '440px' }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 rounded-[2.5rem] border-4 shadow-2xl overflow-hidden flex flex-col"
          style={{ borderColor: 'rgba(30,86,49,0.2)', background: '#F9F7E8' }}
        >
          {/* Status bar */}
          <div className="h-6 bg-forest flex items-center justify-end px-4">
            <span className="text-white text-[9px]">9:41</span>
          </div>

          {/* App header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #1E5631, #2d7a47)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <span className="text-white font-poppins font-bold text-sm">Mes plantes</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-lime flex items-center justify-center text-forest font-bold text-sm">
              +
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">

            {/* Plant card */}
            <div className="bg-white rounded-xl p-3 shadow-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-lime/20 flex items-center justify-center text-xl">
                  🌿
                </div>
                <div>
                  <div className="font-poppins font-bold text-forest text-xs">Ficus Lyrata</div>
                  <div className="text-forest/50 text-[10px]">Salon · Exposition indirecte</div>
                </div>
              </div>
              {/* Hydration bar */}
              <div className="h-1.5 bg-sand-dark rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-lime rounded-full"
                  style={{ width: '65%' }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-forest/50">Hydratation</span>
                <span className="text-[10px] text-forest font-semibold">65%</span>
              </div>
            </div>

            {/* Weather + alert row */}
            <div className="flex gap-2">
              <div className="flex-none w-20 bg-sun/20 rounded-xl p-2 text-center">
                <div className="text-lg">☀️</div>
                <div className="font-poppins font-bold text-forest text-xs">22°C</div>
                <div className="text-[9px] text-forest/50">Aujourd'hui</div>
              </div>
              <div className="flex-1 bg-lime/15 rounded-xl p-2 flex items-center gap-2">
                <span className="text-sm">🔔</span>
                <div>
                  <div className="font-poppins font-bold text-forest text-[10px]">Arroser dans 2h</div>
                  <div className="text-[9px] text-forest/50">Ficus · 200ml</div>
                </div>
              </div>
            </div>

            {/* IA diagnostic card */}
            <div className="bg-white rounded-xl p-3 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📷</span>
                <span className="font-poppins font-bold text-forest text-xs">Diagnostic IA</span>
                <div className="ml-auto bg-lime rounded px-1.5 py-0.5 text-[9px] text-forest font-bold">
                  NEW
                </div>
              </div>
              <div className="text-[10px] text-forest/50">Pointe l'appareil vers ta plante</div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="bg-white border-t border-sand-dark h-12 flex items-center justify-around px-4">
            <span className="text-xl">🏠</span>
            <span className="text-xl opacity-40">🔍</span>
            <span className="text-xl opacity-40">🛒</span>
            <span className="text-xl opacity-40">👤</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/ui/app-mockup.tsx
git commit -m "feat: add rich CSS AppMockup smartphone component"
```

---

## Task 8: Create Header component

**Files:**
- Create: `growi-frontend/components/layout/Header.tsx`

- [ ] **Step 1: Create components/layout/ directory and Header.tsx**

```typescript
// growi-frontend/components/layout/Header.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'

const navLinks = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/tarifs',          label: 'Premium' },
  { href: '/blog',            label: 'Blog' },
  { href: '/pro',             label: 'Pro' },
  { href: '/contact',         label: 'Contact' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-md bg-sand/80 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="font-poppins font-bold text-xl text-forest hover:text-forest-light transition-colors"
          >
            Growi 🌱
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Navigation principale">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-raleway text-forest/70 hover:text-forest transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Button variant="primary" size="sm">
              Télécharger l'app
            </Button>
          </div>

          {/* Mobile burger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <button
                className="p-2 text-forest hover:bg-forest/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-sand">
              <nav
                className="flex flex-col gap-6 mt-8"
                aria-label="Navigation mobile"
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-raleway text-forest text-lg hover:text-forest-light transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button variant="primary" size="default" className="mt-4 w-full">
                  Télécharger l'app
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/layout/Header.tsx
git commit -m "feat: add sticky Header with scroll blur and mobile Sheet menu"
```

---

## Task 9: Create Footer component

**Files:**
- Create: `growi-frontend/components/layout/Footer.tsx`

- [ ] **Step 1: Create Footer.tsx**

```typescript
// growi-frontend/components/layout/Footer.tsx
import Link from 'next/link'
import { Instagram, Linkedin, Youtube } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const productLinks = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/tarifs',          label: 'Premium' },
  { href: '/',                label: 'App' },
  { href: '/tarifs',          label: 'Tarifs' },
]

const companyLinks = [
  { href: '/a-propos', label: 'À propos' },
  { href: '/blog',     label: 'Blog' },
  { href: '/pro',      label: 'Pro' },
  { href: '/contact',  label: 'Contact' },
]

const legalLinks = [
  { href: '/', label: 'Mentions légales' },
  { href: '/', label: 'RGPD' },
  { href: '/', label: 'CGU' },
]

export function Footer() {
  return (
    <footer className="bg-forest text-white" aria-label="Pied de page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Col 1: Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="font-poppins font-bold text-xl">
              Growi 🌱
            </Link>
            <p className="font-raleway text-white/70 text-sm leading-relaxed">
              Ton compagnon de croissance intelligent.
            </p>
            <div className="flex gap-4 mt-2">
              <a
                href="/"
                aria-label="Instagram"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -ml-3"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="/"
                aria-label="LinkedIn"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="/"
                aria-label="YouTube"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Youtube className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Produit
            </h3>
            <ul className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Company */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Entreprise
            </h3>
            <ul className="flex flex-col gap-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Legal */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Légal
            </h3>
            <ul className="flex flex-col gap-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50 font-raleway">
          <Badge className="bg-forest-light text-white border-white/20">
            Greentech France 🌿
          </Badge>
          <span>Made with 💚 in France</span>
          <span>© 2026 Growi</span>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/layout/Footer.tsx
git commit -m "feat: add Footer with 4-col grid, social icons, and legal links"
```

---

## Task 10: Create app/layout.tsx

**Files:**
- Modify: `growi-frontend/app/layout.tsx`

- [ ] **Step 1: Replace app/layout.tsx**

```typescript
// growi-frontend/app/layout.tsx
import type { Metadata } from 'next'
import { Poppins, Raleway } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-raleway',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://growi.app'),
  title: {
    default: 'Growi — Ton assistant jardin intelligent',
    template: '%s | Growi',
  },
  description:
    "L'application qui t'aide à entretenir ton jardin, guidée par la météo et l'IA.",
  keywords: [
    'application jardinage',
    'entretien plantes',
    'diagnostic plante',
    'calendrier jardin',
  ],
  openGraph: {
    type:     'website',
    locale:   'fr_FR',
    siteName: 'Growi',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${poppins.variable} ${raleway.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Smoke test in dev**

```bash
npm run dev
```

Open http://localhost:3000. Expected: page loads with Header (Growi 🌱 logo + nav) and Footer (dark green). No console errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/app/layout.tsx
git commit -m "feat: configure root layout with next/font, Header, Footer"
```

---

## Task 11: HeroSection

**Files:**
- Create: `growi-frontend/components/home/HeroSection.tsx`

- [ ] **Step 1: Create HeroSection.tsx**

```typescript
// growi-frontend/components/home/HeroSection.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppMockup } from '@/components/ui/app-mockup'

const featureBadges = [
  { icon: '🌧️', label: 'Météo connectée', className: 'bg-white shadow-card' },
  { icon: '✅', label: 'Rappel arrosage',   className: 'bg-lime/20' },
  { icon: '📷', label: 'Diagnostic IA',      className: 'bg-sun/20' },
]

export function HeroSection() {
  return (
    <section
      className="bg-gradient-to-br from-sand via-sand to-lime/30 py-20 md:py-28"
      aria-label="Hero"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left column: text */}
          <div className="flex flex-col gap-6">
            <h1 className="font-poppins font-bold text-forest text-4xl md:text-[3.5rem] leading-tight">
              Ton jardin,<br />ta croissance.
            </h1>
            <p className="font-raleway text-forest/70 text-xl max-w-lg leading-relaxed">
              L'assistant intelligent qui t'aide à entretenir ton jardin
              jour après jour, selon la météo et tes plantes.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="lg" asChild>
                <Link href="/tarifs">Essayer gratuitement</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/fonctionnalites">Voir les fonctionnalités</Link>
              </Button>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3">
              {featureBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-raleway font-semibold text-forest ${badge.className}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>

            {/* Social proof */}
            <p className="text-sm text-forest/60 font-raleway" aria-label="Avis utilisateurs">
              <span aria-hidden="true">⭐⭐⭐⭐⭐</span>
              {' '}+12 000 jardiniers nous font confiance
            </p>
          </div>

          {/* Right column: mockup */}
          <div className="flex items-center justify-center">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to app/page.tsx and test in dev**

Replace `growi-frontend/app/page.tsx`:

```typescript
// growi-frontend/app/page.tsx
import { HeroSection } from '@/components/home/HeroSection'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
    </main>
  )
}
```

Run `npm run dev` and open http://localhost:3000. Expected: Hero section visible with H1, 2 CTAs, 3 badges, social proof, and floating smartphone mockup.

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/HeroSection.tsx growi-frontend/app/page.tsx
git commit -m "feat: add HeroSection with AppMockup and feature badges"
```

---

## Task 12: HowItWorks section

**Files:**
- Create: `growi-frontend/components/home/HowItWorks.tsx`

- [ ] **Step 1: Create HowItWorks.tsx**

```typescript
// growi-frontend/components/home/HowItWorks.tsx
'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { Sprout, Bell, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { staggerContainer, scaleIn } from '@/lib/animations'

const steps = [
  {
    number: '01',
    icon: Sprout,
    title: 'Identifie tes plantes',
    description: 'Prends une photo ou choisis dans la base de données.',
  },
  {
    number: '02',
    icon: Bell,
    title: 'Reçois les bons rappels',
    description: 'Arrosage, rempotage, taille, selon ton climat.',
  },
  {
    number: '03',
    icon: Sun,
    title: 'Fais-les prospérer',
    description: "Des conseils adaptés à la météo et au moment de l'année.",
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="bg-white py-20 md:py-28" aria-label="Comment ça marche">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Comment ça marche ?
          </h2>
          <p className="font-raleway text-forest/60 text-lg max-w-xl mx-auto">
            En 3 étapes, ton jardin devient plus simple à gérer.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                variants={shouldReduceMotion ? undefined : scaleIn}
                className="flex flex-col items-center text-center gap-4"
              >
                {/* Number circle */}
                <div className="w-12 h-12 rounded-full bg-lime text-forest font-poppins font-bold text-lg flex items-center justify-center">
                  {step.number}
                </div>
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-lime/10 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-forest" aria-hidden="true" />
                </div>
                <h3 className="font-poppins font-semibold text-forest text-xl">
                  {step.title}
                </h3>
                <p className="font-raleway text-forest/60 text-base leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="flex justify-center mt-12">
          <Button variant="outline" asChild>
            <Link href="/fonctionnalites">Découvrir toutes les fonctionnalités</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to page.tsx**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection } from '@/components/home/HeroSection'
import { HowItWorks } from '@/components/home/HowItWorks'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/HowItWorks.tsx growi-frontend/app/page.tsx
git commit -m "feat: add HowItWorks 3-step section with stagger animation"
```

---

## Task 13: AppPreview section

**Files:**
- Create: `growi-frontend/components/home/AppPreview.tsx`

- [ ] **Step 1: Create AppPreview.tsx**

```typescript
// growi-frontend/components/home/AppPreview.tsx
import { AppMockup } from '@/components/ui/app-mockup'

const featureCards = [
  {
    icon: '🌡️',
    title: 'Santé de tes plantes',
    detail: (
      <div className="mt-2 h-1.5 bg-sand rounded-full overflow-hidden">
        <div className="h-full bg-lime rounded-full" style={{ width: '72%' }} />
      </div>
    ),
  },
  {
    icon: '☀️',
    title: 'Météo du jour',
    detail: <p className="text-xs text-forest/60 mt-1">22°C · Ensoleillé</p>,
  },
  {
    icon: '🔔',
    title: 'Alertes intelligentes',
    detail: (
      <span className="inline-flex mt-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 items-center justify-center">
        3
      </span>
    ),
  },
  {
    icon: '📅',
    title: 'Calendrier jardin',
    detail: (
      <div className="grid grid-cols-7 gap-0.5 mt-2">
        {['L','M','M','J','V','S','D'].map((d) => (
          <div key={d} className="text-[9px] text-center text-forest/40">{d}</div>
        ))}
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`text-[10px] text-center rounded py-0.5 ${i === 2 ? 'bg-lime text-forest font-bold' : 'text-forest/60'}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    ),
  },
]

export function AppPreview() {
  return (
    <section className="bg-forest py-20 md:py-28" aria-label="Aperçu de l'application">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-poppins font-bold text-white text-3xl md:text-4xl mb-4">
            Tout ce dont tes plantes ont besoin
          </h2>
          <p className="font-raleway text-white/70 text-lg max-w-xl mx-auto">
            Suivez la santé de vos plantes et recevez des alertes personnalisées.
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          {/* Feature cards: left column */}
          <div className="hidden lg:flex flex-col gap-4 mr-12 w-52">
            {featureCards.slice(0, 2).map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
                <div className="text-2xl mb-1">{card.icon}</div>
                <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
                {card.detail}
              </div>
            ))}
          </div>

          {/* Mockup */}
          <div className="flex-shrink-0">
            <AppMockup />
          </div>

          {/* Feature cards: right column */}
          <div className="hidden lg:flex flex-col gap-4 ml-12 w-52">
            {featureCards.slice(2, 4).map((card) => (
              <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
                <div className="text-2xl mb-1">{card.icon}</div>
                <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
                {card.detail}
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: cards below mockup */}
        <div className="lg:hidden grid grid-cols-2 gap-4 mt-8">
          {featureCards.map((card) => (
            <div key={card.title} className="bg-white rounded-2xl p-4 shadow-card">
              <div className="text-2xl mb-1">{card.icon}</div>
              <h3 className="font-poppins font-semibold text-forest text-sm">{card.title}</h3>
              {card.detail}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to page.tsx**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection }  from '@/components/home/HeroSection'
import { HowItWorks }   from '@/components/home/HowItWorks'
import { AppPreview }   from '@/components/home/AppPreview'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/AppPreview.tsx growi-frontend/app/page.tsx
git commit -m "feat: add AppPreview section with dark bg and 4 feature cards"
```

---

## Task 14: FeaturesGrid section

**Files:**
- Create: `growi-frontend/components/home/FeaturesGrid.tsx`

- [ ] **Step 1: Create FeaturesGrid.tsx**

```typescript
// growi-frontend/components/home/FeaturesGrid.tsx
'use client'

import { Brain, Camera, CalendarDays, ShoppingBag, Users, Star } from 'lucide-react'
import { useReducedMotion, motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { staggerContainer, scaleIn } from '@/lib/animations'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  { icon: Brain,       title: 'Assistant intelligent',  description: "L'app adapte les conseils à ta météo locale." },
  { icon: Camera,      title: 'Diagnostic photo IA',    description: 'Identifie maladies et carences instantanément.' },
  { icon: CalendarDays,title: 'Calendrier du jardin',   description: 'Planifie semis, tailles et floraisons.' },
  { icon: ShoppingBag, title: 'Store contextuel',       description: 'Trouve ce qu\'il te faut au bon moment.' },
  { icon: Users,       title: 'Communauté locale',      description: 'Partage tes réussites et tes plantes.' },
  { icon: Star,        title: 'Version Premium',        description: 'Diagnostic illimité + météo pro + multi-jardins.' },
]

export function FeaturesGrid() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="bg-sand py-20 md:py-28" aria-label="Fonctionnalités phares">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Tout pour bien jardiner
          </h2>
          <p className="font-raleway text-forest/60 text-lg max-w-xl mx-auto">
            Des fonctionnalités pensées pour chaque jardinier, du débutant au passionné.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-80px' }}
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={shouldReduceMotion ? undefined : scaleIn}
              >
                <Card className="rounded-2xl border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300 bg-white h-full">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-lime/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-forest" aria-hidden="true" />
                    </div>
                    <h3 className="font-poppins font-semibold text-forest text-lg">
                      {feature.title}
                    </h3>
                    <p className="font-raleway text-forest/70 text-base leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="flex justify-center mt-12">
          <Button variant="forest" asChild>
            <Link href="/fonctionnalites">Explorer toutes les fonctionnalités</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to page.tsx**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection }   from '@/components/home/HeroSection'
import { HowItWorks }    from '@/components/home/HowItWorks'
import { AppPreview }    from '@/components/home/AppPreview'
import { FeaturesGrid }  from '@/components/home/FeaturesGrid'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
      <FeaturesGrid />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/FeaturesGrid.tsx growi-frontend/app/page.tsx
git commit -m "feat: add FeaturesGrid 6-card section with stagger animation"
```

---

## Task 15: Testimonials section

**Files:**
- Create: `growi-frontend/components/home/Testimonials.tsx`

- [ ] **Step 1: Create Testimonials.tsx**

```typescript
// growi-frontend/components/home/Testimonials.tsx
'use client'

import { Star } from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

interface Testimonial {
  initials: string
  quote: string
  name: string
  city: string
  gardenType: string
}

const testimonials: Testimonial[] = [
  {
    initials: 'JB',
    quote: "Grâce à Growi, mes plantes d'intérieur sont enfin épanouies !",
    name: 'Julie B.',
    city: 'Lyon',
    gardenType: 'Plantes intérieur 🌿',
  },
  {
    initials: 'MD',
    quote: 'Plus besoin de me demander quand tailler mes rosiers.',
    name: 'Marc D.',
    city: 'Bordeaux',
    gardenType: 'Jardin potager 🌹',
  },
  {
    initials: 'PL',
    quote: 'Le rappel météo m'a sauvé mon potager.',
    name: 'Pierre L.',
    city: 'Nantes',
    gardenType: 'Potager 🍅',
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5" aria-label="5 étoiles sur 5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="fill-sun text-sun w-4 h-4" aria-hidden="true" />
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section className="bg-sand-dark py-20 md:py-28" aria-label="Témoignages">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Ils adorent Growi
          </h2>
          <p className="font-raleway text-forest/60 text-lg">
            +12 000 jardiniers nous font déjà confiance.
          </p>
        </div>

        <Carousel
          opts={{ align: 'start', loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {testimonials.map((t) => (
              <CarouselItem key={t.name} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <div className="bg-white rounded-2xl p-6 shadow-card h-full flex flex-col gap-4">
                  <StarRating />
                  <blockquote className="font-raleway italic text-forest/80 text-base leading-relaxed flex-1">
                    "{t.quote}"
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full bg-lime flex items-center justify-center font-poppins font-bold text-forest text-sm shrink-0"
                      aria-hidden="true"
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-poppins font-semibold text-forest text-sm">{t.name}</div>
                      <div className="font-raleway text-forest/50 text-xs">
                        {t.city} · {t.gardenType}
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12 border-forest/20 text-forest hover:bg-forest/10" />
          <CarouselNext className="hidden md:flex -right-12 border-forest/20 text-forest hover:bg-forest/10" />
        </Carousel>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to page.tsx**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection }   from '@/components/home/HeroSection'
import { HowItWorks }    from '@/components/home/HowItWorks'
import { AppPreview }    from '@/components/home/AppPreview'
import { FeaturesGrid }  from '@/components/home/FeaturesGrid'
import { Testimonials }  from '@/components/home/Testimonials'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
      <FeaturesGrid />
      <Testimonials />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/Testimonials.tsx growi-frontend/app/page.tsx
git commit -m "feat: add Testimonials section with shadcn Carousel"
```

---

## Task 16: ProSection

**Files:**
- Create: `growi-frontend/components/home/ProSection.tsx`

- [ ] **Step 1: Create ProSection.tsx**

```typescript
// growi-frontend/components/home/ProSection.tsx
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const checkpoints = [
  'Planning d'entretien intelligent',
  'Rapports photo & conformité',
  'Suivi arrosage & biodiversité',
]

function LaptopMockup() {
  return (
    <div className="w-full max-w-sm mx-auto" aria-hidden="true">
      {/* Lid */}
      <div className="bg-forest/20 rounded-t-xl border-2 border-forest/20 overflow-hidden" style={{ paddingBottom: '62.5%', position: 'relative' }}>
        <div className="absolute inset-1 bg-forest rounded-lg flex flex-col overflow-hidden">
          {/* Screen header */}
          <div className="bg-forest-light px-3 py-2 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-forest/40 rounded h-3" />
          </div>
          {/* KPI tiles */}
          <div className="flex-1 p-3 grid grid-cols-2 gap-2">
            {[
              { label: 'Sites actifs', value: '24' },
              { label: 'OTs clôturés', value: '98%' },
              { label: 'Eau économisée', value: '−18%' },
              { label: 'NPS client',    value: '72' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-forest-light rounded-lg p-2 flex flex-col">
                <span className="text-white/50 text-[9px]">{kpi.label}</span>
                <span className="text-lime font-poppins font-bold text-base">{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Base */}
      <div className="h-3 bg-forest/20 border-x-2 border-b-2 border-forest/20 rounded-b-sm mx-4" />
      <div className="h-1.5 bg-forest/10 rounded-b-full mx-2" />
    </div>
  )
}

export function ProSection() {
  return (
    <section className="bg-white py-20 md:py-28" aria-label="Growi Pro">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-6">
            <Badge className="w-fit bg-forest text-white font-poppins text-xs px-3 py-1">
              Pour les professionnels
            </Badge>
            <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl">
              Pilotez vos espaces verts, simplement.
            </h2>
            <p className="font-raleway text-forest/70 text-lg leading-relaxed">
              Growi Pro est conçu pour les syndics, collectivités et prestataires
              qui gèrent des dizaines de sites.
            </p>

            <ul className="flex flex-col gap-4">
              {checkpoints.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-l-4 border-lime pl-4"
                >
                  <Check className="w-5 h-5 text-lime mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="font-raleway text-forest text-base">{item}</span>
                </li>
              ))}
            </ul>

            <Button variant="forest" size="lg" className="w-fit" asChild>
              <Link href="/pro">Découvrir Growi Pro</Link>
            </Button>
          </div>

          {/* Right: laptop mockup */}
          <div>
            <LaptopMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add to page.tsx**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection }   from '@/components/home/HeroSection'
import { HowItWorks }    from '@/components/home/HowItWorks'
import { AppPreview }    from '@/components/home/AppPreview'
import { FeaturesGrid }  from '@/components/home/FeaturesGrid'
import { Testimonials }  from '@/components/home/Testimonials'
import { ProSection }    from '@/components/home/ProSection'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
      <FeaturesGrid />
      <Testimonials />
      <ProSection />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/ProSection.tsx growi-frontend/app/page.tsx
git commit -m "feat: add ProSection with CSS laptop mockup and KPI tiles"
```

---

## Task 17: FinalCTA section

**Files:**
- Create: `growi-frontend/components/home/FinalCTA.tsx`

- [ ] **Step 1: Create FinalCTA.tsx**

```typescript
// growi-frontend/components/home/FinalCTA.tsx

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.18 23.76A2 2 0 0 1 1 21.9V2.1A2 2 0 0 1 3.18.24l19.1 9.9a2 2 0 0 1 0 3.52l-19.1 9.9a2.01 2.01 0 0 1-.9.2z"/>
    </svg>
  )
}

export function FinalCTA() {
  return (
    <section
      className="bg-gradient-to-r from-lime to-forest py-20 md:py-28"
      aria-label="Télécharger l'application"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-poppins font-bold text-white text-3xl md:text-[2.5rem] leading-tight mb-4">
          Rejoignez la communauté des jardiniers connectés.
        </h2>
        <p className="font-raleway text-white/80 text-lg mb-10">
          Gratuit pour commencer. Disponible sur iOS et Android.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* App Store button */}
          <a
            href="/"
            className="inline-flex items-center gap-3 border-2 border-white text-white rounded-xl px-6 py-3.5 font-raleway font-semibold hover:bg-white/20 transition-colors min-h-[44px]"
          >
            <AppleIcon />
            <div className="text-left">
              <div className="text-[10px] text-white/70 leading-none">Disponible sur</div>
              <div className="text-base font-poppins font-semibold leading-tight">App Store</div>
            </div>
          </a>

          {/* Google Play button */}
          <a
            href="/"
            className="inline-flex items-center gap-3 border-2 border-white text-white rounded-xl px-6 py-3.5 font-raleway font-semibold hover:bg-white/20 transition-colors min-h-[44px]"
          >
            <PlayIcon />
            <div className="text-left">
              <div className="text-[10px] text-white/70 leading-none">Disponible sur</div>
              <div className="text-base font-poppins font-semibold leading-tight">Google Play</div>
            </div>
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Assemble final app/page.tsx with all 8 sections**

```typescript
// growi-frontend/app/page.tsx
import { HeroSection }  from '@/components/home/HeroSection'
import { HowItWorks }   from '@/components/home/HowItWorks'
import { AppPreview }   from '@/components/home/AppPreview'
import { FeaturesGrid } from '@/components/home/FeaturesGrid'
import { Testimonials } from '@/components/home/Testimonials'
import { ProSection }   from '@/components/home/ProSection'
import { FinalCTA }     from '@/components/home/FinalCTA'

export const metadata = {
  title: 'Growi — Ton assistant jardin intelligent',
  description:
    "L'application qui t'aide à entretenir ton jardin, guidée par la météo et l'IA.",
}

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
      <FeaturesGrid />
      <Testimonials />
      <ProSection />
      <FinalCTA />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend/components/home/FinalCTA.tsx growi-frontend/app/page.tsx
git commit -m "feat: add FinalCTA section and assemble all 8 homepage sections"
```

---

## Task 18: Final build verification

**Files:** No new files — verification only.

- [ ] **Step 1: TypeScript strict check**

```bash
cd growi-frontend
npx tsc --noEmit
```

Expected: Zero errors. If errors appear, fix types before proceeding.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected output (approximate):
```
Route (app)                              Size
┌ ○ /                                   ...
└ ○ /_not-found                         ...
✓ Compiled successfully
```

No TypeScript errors, no "Module not found" errors.

- [ ] **Step 3: Visual verification checklist**

Run `npm run dev` and open http://localhost:3000. Verify each item:

- [ ] Palette Growi visible (fond sand #F9F7E8, textes forest #1E5631, CTAs lime)
- [ ] Poppins sur les titres, Raleway sur le corps
- [ ] Header sticky visible avec logo "Growi 🌱" et nav 5 liens
- [ ] Hero : H1 "Ton jardin, ta croissance.", 2 CTAs, 3 badges, AppMockup avec animation float
- [ ] Réduire la fenêtre à 320px : layout lisible, pas de débordement horizontal
- [ ] Réduire à 768px : grilles passent en colonnes adaptées
- [ ] Cliquer le burger sur mobile : Sheet s'ouvre avec nav verticale
- [ ] Carousel témoignages : swipeable sur mobile (touch ou drag)
- [ ] Footer visible avec 4 colonnes desktop, badge Greentech, © 2026 Growi
- [ ] Aucun `console.error` dans les DevTools
- [ ] Activer "prefers-reduced-motion" dans les DevTools (Rendering panel) : animation float arrêtée

- [ ] **Step 4: Final commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2
git add growi-frontend
git commit -m "feat: Phase 1 complete — design system, layout, homepage 8 sections"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Scaffold + deps (Task 1-2)
- ✅ Design tokens CSS + Tailwind (Task 3)
- ✅ lib/animations.ts (Task 4)
- ✅ Button variants primary/forest/outline/ghost (Task 5)
- ✅ SectionWrapper with Framer Motion + useReducedMotion (Task 6)
- ✅ AppMockup rich fidelity (Task 7)
- ✅ Header sticky + scroll + Sheet mobile (Task 8)
- ✅ Footer 4-col (Task 9)
- ✅ layout.tsx with next/font + metadata (Task 10)
- ✅ Hero: H1, CTAs, badges under CTAs (layout C), social proof, AppMockup solo (Task 11)
- ✅ HowItWorks: 3 steps, numbered circles, stagger (Task 12)
- ✅ AppPreview: forest bg, 4 feature cards (Task 13)
- ✅ FeaturesGrid: 6 cards, lucide icons (Task 14)
- ✅ Testimonials: Carousel, initials avatars, star ratings (Task 15)
- ✅ ProSection: checkpoints, laptop mockup, badge (Task 16)
- ✅ FinalCTA: gradient, store buttons with inline SVG (Task 17)
- ✅ Build + visual verification (Task 18)
- ✅ `prefers-reduced-motion` respected (globals.css + useReducedMotion in animated components)
- ✅ `'use client'` on Header, HowItWorks, FeaturesGrid, Testimonials, SectionWrapper
- ✅ WCAG: one `<h1>`, landmarks, focus ring via Tailwind base, alt/aria-hidden on icons

**Out of scope (Phase 2):** Forms, secondary pages, Stripe, IoT, tests.
