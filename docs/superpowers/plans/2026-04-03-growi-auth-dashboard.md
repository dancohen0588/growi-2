# Authentication & Client Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete authentication system (login, register, protected dashboard) to the Growi Next.js 14 marketing site using Auth.js v5 with an in-memory user store.

**Architecture:** Auth.js v5 with Credentials provider + JWT strategy. Users stored in `lib/mock-users.ts` array (no DB). Route group `(auth)` isolates auth pages from the main marketing layout (no Header/Footer). `app/dashboard` is protected by middleware at the edge. Header.tsx adapts to session state.

**Tech Stack:** Next.js 14 App Router, Auth.js v5 (next-auth@beta), react-hook-form, zod, TypeScript strict, Tailwind + shadcn/ui tokens (forest/lime/sand/sun), Framer Motion, lucide-react.

---

## File Structure

### Files to create

```
growi-frontend/
├── auth.ts                                      # Auth.js config (NextAuth, Credentials provider)
├── middleware.ts                                # Edge middleware protecting /dashboard/*
├── lib/
│   ├── mock-users.ts                            # In-memory user store + helpers
│   └── auth-schemas.ts                          # Zod schemas: loginSchema, registerSchema
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                           # Minimal layout: no Header/Footer, bg-sand
│   │   ├── login/
│   │   │   └── page.tsx                         # Login page shell + metadata
│   │   └── register/
│   │       └── page.tsx                         # Register page shell + metadata
│   ├── dashboard/
│   │   ├── layout.tsx                           # Protected layout: session guard + DashboardHeader + DashboardNav
│   │   ├── page.tsx                             # Dashboard home: overview cards + FeatureCard grid + CTA banner
│   │   └── [feature]/
│   │       └── page.tsx                         # Dynamic placeholder page
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts                     # Auth.js route handler
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx                        # react-hook-form + zod + Eye toggle + loading/error states
│   │   ├── RegisterForm.tsx                     # react-hook-form + zod + password strength indicator
│   │   └── UserMenu.tsx                         # Avatar initials dropdown (signOut, Mon compte)
│   └── dashboard/
│       ├── DashboardHeader.tsx                  # Sticky header: logo + greeting + UserMenu
│       ├── DashboardNav.tsx                     # Sidebar desktop / bottom nav mobile
│       └── FeatureCard.tsx                      # Card linking to /dashboard/[feature]
```

### Files to modify

```
growi-frontend/
├── components/layout/Header.tsx                 # Add session-aware CTA: Connexion btn OR UserMenu
└── app/layout.tsx                               # Wrap with SessionProvider (Auth.js client wrapper)
```

---

## Task 1: Install Auth.js v5

**Files:**
- Modify: `growi-frontend/package.json`

- [ ] **Step 1: Install the package**

Run from `growi-frontend/`:
```bash
npm install next-auth@beta
```

Expected: `next-auth@5.x.x` added to `dependencies`.

- [ ] **Step 2: Verify no peer dep errors**

Run:
```bash
npm ls next-auth
```

Expected: single entry, no unmet peer warnings.

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/package.json growi-frontend/package-lock.json
git commit -m "chore: install next-auth@beta (Auth.js v5)"
```

---

## Task 2: Create Zod schemas and in-memory user store

**Files:**
- Create: `growi-frontend/lib/auth-schemas.ts`
- Create: `growi-frontend/lib/mock-users.ts`

- [ ] **Step 1: Create `lib/auth-schemas.ts`**

```typescript
// growi-frontend/lib/auth-schemas.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (6 caractères min.)'),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Prénom requis (2 caractères min.)'),
    email: z.string().email('Email invalide'),
    password: z
      .string()
      .min(8, 'Mot de passe trop court (8 caractères min.)')
      .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
```

- [ ] **Step 2: Create `lib/mock-users.ts`**

```typescript
// growi-frontend/lib/mock-users.ts
// TODO: Replace with Prisma + DB when ready.
// Each user stored as { id, firstName, email, passwordHash }.
// Passwords hashed with Web Crypto API (SHA-256) — NOT bcrypt, no Node runtime needed.

export interface MockUser {
  id: string
  firstName: string
  email: string
  passwordHash: string
}

// In-memory store — resets on server restart (MVP only)
const users: MockUser[] = []

/** Hash a plain password with SHA-256 (hex). */
async function hashPassword(plain: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(plain),
  )
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Create a new user. Throws if email already exists. */
export async function createUser(
  firstName: string,
  email: string,
  password: string,
): Promise<MockUser> {
  const existing = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (existing) throw new Error('EMAIL_TAKEN')

  const user: MockUser = {
    id: crypto.randomUUID(),
    firstName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
  }
  users.push(user)
  return user
}

/** Verify credentials. Returns user or null. */
export async function verifyUser(
  email: string,
  password: string,
): Promise<MockUser | null> {
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  )
  if (!user) return null
  const hash = await hashPassword(password)
  return hash === user.passwordHash ? user : null
}
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/lib/auth-schemas.ts growi-frontend/lib/mock-users.ts
git commit -m "feat(auth): add Zod schemas and in-memory user store"
```

---

## Task 3: Configure Auth.js (auth.ts + API route)

**Files:**
- Create: `growi-frontend/auth.ts`
- Create: `growi-frontend/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `auth.ts` at project root (inside `growi-frontend/`)**

```typescript
// growi-frontend/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { loginSchema } from '@/lib/auth-schemas'
import { verifyUser } from '@/lib/mock-users'

// TODO: Add Google / GitHub OAuth providers here when ready.

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',          type: 'email' },
        password: { label: 'Mot de passe',   type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await verifyUser(parsed.data.email, parsed.data.password)
        if (!user) return null

        return { id: user.id, name: user.firstName, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.firstName = user.name
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      session.user.firstName = token.firstName as string
      session.user.id = token.id as string
      return session
    },
  },
})
```

- [ ] **Step 2: Extend NextAuth types**

Add this block at the bottom of `growi-frontend/auth.ts` (same file, after the export):

```typescript
// Augment session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      firstName: string
      email: string
      name?: string | null
      image?: string | null
    }
  }
}
```

- [ ] **Step 3: Create the API route handler**

```typescript
// growi-frontend/app/api/auth/[...nextauth]/route.ts
export { handlers as GET, handlers as POST } from '@/auth'
```

- [ ] **Step 4: Commit**

```bash
git add growi-frontend/auth.ts growi-frontend/app/api/auth/[...nextauth]/route.ts
git commit -m "feat(auth): configure Auth.js v5 — Credentials provider + JWT"
```

---

## Task 4: Add edge middleware for route protection

**Files:**
- Create: `growi-frontend/middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
// growi-frontend/middleware.ts
export { auth as middleware } from '@/auth'

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

Note: Auth.js v5 `auth` export used directly as middleware. If the user is not authenticated and hits `/dashboard/*`, Auth.js automatically redirects to the `signIn` page defined in `auth.ts` (`/login`).

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/middleware.ts
git commit -m "feat(auth): add edge middleware protecting /dashboard/*"
```

---

## Task 5: Add register Server Action

**Files:**
- Create: `growi-frontend/app/(auth)/register/actions.ts`

- [ ] **Step 1: Create the Server Action**

```typescript
// growi-frontend/app/(auth)/register/actions.ts
'use server'
import { registerSchema } from '@/lib/auth-schemas'
import { createUser } from '@/lib/mock-users'
import { signIn } from '@/auth'

export async function registerAction(formData: {
  firstName: string
  email: string
  password: string
  confirm: string
}): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  try {
    await createUser(parsed.data.firstName, parsed.data.email, parsed.data.password)
  } catch (err) {
    if ((err as Error).message === 'EMAIL_TAKEN') {
      return { error: 'Un compte existe déjà avec cet email.' }
    }
    return { error: 'Erreur lors de la création du compte.' }
  }

  // Auto sign-in after registration
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: '/dashboard',
  })

  return {}
}
```

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/app/\(auth\)/register/actions.ts
git commit -m "feat(auth): add registerAction server action with auto sign-in"
```

---

## Task 6: Build the (auth) route group layout

**Files:**
- Create: `growi-frontend/app/(auth)/layout.tsx`

- [ ] **Step 1: Create minimal auth layout (no Header/Footer)**

```typescript
// growi-frontend/app/(auth)/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-sand px-4 py-12">
      {children}
    </main>
  )
}
```

Note: This layout does NOT import `<Header>` or `<Footer>`, isolating auth pages from the marketing layout. The root `app/layout.tsx` already wraps everything in `<Header><Footer>` — we need the `(auth)` route group to opt out. Therefore in Task 11 we will move `<Header>` and `<Footer>` out of the root layout and into a separate marketing layout group.

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/app/\(auth\)/layout.tsx
git commit -m "feat(auth): create (auth) route group layout — no header/footer"
```

---

## Task 7: Restructure root layout to use a marketing route group

**Files:**
- Create: `growi-frontend/app/(marketing)/layout.tsx`
- Modify: `growi-frontend/app/layout.tsx`
- Move: `growi-frontend/app/page.tsx` → `growi-frontend/app/(marketing)/page.tsx`
- Move: `growi-frontend/app/fonctionnalites/` → `growi-frontend/app/(marketing)/fonctionnalites/`

This task resolves the Header/Footer conflict: auth pages must NOT show the site header.

- [ ] **Step 1: Create `app/(marketing)/layout.tsx`**

```typescript
// growi-frontend/app/(marketing)/layout.tsx
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Update root `app/layout.tsx` — remove Header/Footer**

Remove the `<Header />` and `<Footer />` imports and JSX. Keep fonts, metadata, `<html>`, `<body>`:

```typescript
// growi-frontend/app/layout.tsx
import type { Metadata } from 'next'
import { Poppins, Raleway } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

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
  keywords: ['application jardinage', 'entretien plantes', 'diagnostic plante', 'calendrier jardin'],
  openGraph: { type: 'website', locale: 'fr_FR', siteName: 'Growi' },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${raleway.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Move existing pages into the marketing group**

From the `growi-frontend/` directory:

```bash
mkdir -p app/\(marketing\)
# Move homepage
mv app/page.tsx app/\(marketing\)/page.tsx
# Move fonctionnalites
mv app/fonctionnalites app/\(marketing\)/fonctionnalites
```

- [ ] **Step 4: Verify dev server still starts**

```bash
npm run dev
```

Open `http://localhost:3000` — homepage and `/fonctionnalites` should still render with header/footer.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(layout): introduce (marketing) route group — isolate Header/Footer from auth/dashboard"
```

---

## Task 8: Build LoginForm component

**Files:**
- Create: `growi-frontend/components/auth/LoginForm.tsx`

- [ ] **Step 1: Create `LoginForm.tsx`**

```typescript
// growi-frontend/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { loginSchema, type LoginInput } from '@/lib/auth-schemas'

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    setServerError(null)
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setServerError('Email ou mot de passe incorrect.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-raleway text-sm font-medium text-forest"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="julie@exemple.com"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-red-500"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="font-raleway text-sm font-medium text-forest"
        >
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="••••••••"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition-colors"
          >
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            aria-live="polite"
            className="text-xs text-red-500"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* TODO: Ajouter "Mot de passe oublié" quand l'email reset est disponible */}

      {/* Server error */}
      {serverError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600"
        >
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="default"
        loading={isSubmitting}
        className="w-full mt-1"
      >
        Se connecter
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/components/auth/LoginForm.tsx
git commit -m "feat(auth): build LoginForm — react-hook-form + zod + Eye toggle + error states"
```

---

## Task 9: Build RegisterForm component

**Files:**
- Create: `growi-frontend/components/auth/RegisterForm.tsx`

- [ ] **Step 1: Create `RegisterForm.tsx`**

```typescript
// growi-frontend/components/auth/RegisterForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { registerSchema, type RegisterInput } from '@/lib/auth-schemas'
import { registerAction } from '@/app/(auth)/register/actions'

// Password strength: 0=empty, 1=weak, 2=medium, 3=strong
function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  return score as 0 | 1 | 2 | 3
}

const strengthLabel: Record<number, string> = {
  0: '',
  1: 'Faible',
  2: 'Moyen',
  3: 'Fort',
}
const strengthColor: Record<number, string> = {
  0: 'bg-transparent',
  1: 'bg-red-400',
  2: 'bg-sun',
  3: 'bg-lime',
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const passwordValue = watch('password', '')
  const strength = getPasswordStrength(passwordValue)

  async function onSubmit(data: RegisterInput) {
    setServerError(null)
    const result = await registerAction(data)
    if (result?.error) {
      setServerError(result.error)
    }
    // On success, registerAction calls signIn() which redirects — no explicit push needed.
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* First Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="firstName" className="font-raleway text-sm font-medium text-forest">
          Prénom
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          aria-invalid={!!errors.firstName}
          aria-describedby={errors.firstName ? 'firstName-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="Julie"
          {...register('firstName')}
        />
        {errors.firstName && (
          <p id="firstName-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.firstName.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-email" className="font-raleway text-sm font-medium text-forest">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'reg-email-error' : undefined}
          className="h-11 rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
          placeholder="julie@exemple.com"
          {...register('email')}
        />
        {errors.email && (
          <p id="reg-email-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password + strength meter */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reg-password" className="font-raleway text-sm font-medium text-forest">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="reg-password-strength reg-password-error"
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition-colors"
          >
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {/* Strength bar */}
        {passwordValue && (
          <div id="reg-password-strength" aria-live="polite" className="flex items-center gap-2 mt-1">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    strength >= level ? strengthColor[strength] : 'bg-forest/10'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-raleway text-forest/60 w-12">
              {strengthLabel[strength]}
            </span>
          </div>
        )}
        {errors.password && (
          <p id="reg-password-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="font-raleway text-sm font-medium text-forest">
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
            className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 pr-12 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-1 aria-[invalid=true]:border-red-500"
            placeholder="••••••••"
            {...register('confirm')}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition-colors"
          >
            {showConfirm ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {errors.confirm && (
          <p id="confirm-error" role="alert" aria-live="polite" className="text-xs text-red-500">
            {errors.confirm.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" variant="primary" size="default" loading={isSubmitting} className="w-full mt-1">
        Créer mon compte
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/components/auth/RegisterForm.tsx
git commit -m "feat(auth): build RegisterForm — strength meter, Eye toggle, server action"
```

---

## Task 10: Build login and register pages

**Files:**
- Create: `growi-frontend/app/(auth)/login/page.tsx`
- Create: `growi-frontend/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create `login/page.tsx`**

```typescript
// growi-frontend/app/(auth)/login/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Connexion',
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 flex flex-col gap-8">
      {/* Logo */}
      <div className="text-center">
        <Link
          href="/"
          className="font-poppins font-bold text-2xl text-forest hover:text-forest-light transition-colors"
          aria-label="Retour à l'accueil Growi"
        >
          Growi 🌱
        </Link>
      </div>

      {/* Heading */}
      <div className="text-center flex flex-col gap-2">
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Bon retour dans ton jardin.
        </h1>
      </div>

      <LoginForm />

      {/* Register link */}
      <p className="text-center font-raleway text-sm text-forest/60">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="text-forest font-medium underline underline-offset-2 hover:text-forest-light transition-colors"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create `register/page.tsx`**

```typescript
// growi-frontend/app/(auth)/register/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Créer un compte',
}

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 flex flex-col gap-8">
      {/* Logo */}
      <div className="text-center">
        <Link
          href="/"
          className="font-poppins font-bold text-2xl text-forest hover:text-forest-light transition-colors"
          aria-label="Retour à l'accueil Growi"
        >
          Growi 🌱
        </Link>
      </div>

      {/* Heading */}
      <div className="text-center flex flex-col gap-2">
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Crée ton compte Growi.
        </h1>
        <p className="font-raleway text-sm text-forest/60">
          Gratuit pour commencer. Aucune carte requise.
        </p>
      </div>

      <RegisterForm />

      {/* Login link */}
      <p className="text-center font-raleway text-sm text-forest/60">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="text-forest font-medium underline underline-offset-2 hover:text-forest-light transition-colors"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/app/\(auth\)/login/page.tsx growi-frontend/app/\(auth\)/register/page.tsx
git commit -m "feat(auth): add /login and /register pages"
```

---

## Task 11: Build UserMenu component

**Files:**
- Create: `growi-frontend/components/auth/UserMenu.tsx`

- [ ] **Step 1: Create `UserMenu.tsx`**

```typescript
// growi-frontend/components/auth/UserMenu.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, User } from 'lucide-react'

export function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const initials = session?.user?.firstName
    ? session.user.firstName.slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu utilisateur"
        className="flex items-center justify-center h-9 w-9 rounded-full bg-lime text-forest font-poppins font-bold text-sm hover:bg-lime-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-card-hover border border-forest/10 py-1 z-50"
        >
          <p className="px-4 py-2 text-xs font-raleway text-forest/50 truncate">
            {session?.user?.email}
          </p>
          <hr className="border-forest/10 my-1" />
          <Link
            href="/dashboard"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
            onClick={() => setOpen(false)}
          >
            <User size={16} aria-hidden />
            Mon espace
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
          >
            <LogOut size={16} aria-hidden />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/components/auth/UserMenu.tsx
git commit -m "feat(auth): build UserMenu — avatar initials + accessible dropdown"
```

---

## Task 12: Update Header.tsx for session-aware state

**Files:**
- Modify: `growi-frontend/components/layout/Header.tsx`

- [ ] **Step 1: Add session import and conditional CTA**

The Header is a Client Component (`'use client'`). Add `useSession` from `next-auth/react` and replace the static `<Button>Télécharger l'app</Button>` with:
- If `status === 'authenticated'`: render `<UserMenu />`
- If `status === 'loading'`: render a skeleton `<div className="h-9 w-9 rounded-full bg-forest/10 animate-pulse" />`
- If `status === 'unauthenticated'`: render `<Button variant="outline" size="sm" asChild><Link href="/login">Connexion</Link></Button>` (keep "Télécharger l'app" only in mobile nav)

Replace the Desktop CTA block in `Header.tsx`:

```typescript
// Add at top of file (imports)
import { useSession } from 'next-auth/react'
import { UserMenu } from '@/components/auth/UserMenu'

// Inside Header() function body, before return:
const { status } = useSession()

// Replace the Desktop CTA div:
<div className="hidden md:flex items-center gap-3">
  {status === 'loading' && (
    <div className="h-9 w-9 rounded-full bg-forest/10 animate-pulse" aria-hidden />
  )}
  {status === 'unauthenticated' && (
    <Button variant="outline" size="sm" asChild>
      <Link href="/login">Connexion</Link>
    </Button>
  )}
  {status === 'authenticated' && <UserMenu />}
</div>
```

Also add a "Connexion" link in the mobile Sheet nav (above the CTA button), conditionally:
```typescript
{status === 'unauthenticated' && (
  <Link
    href="/login"
    className="font-raleway text-forest text-lg hover:text-forest-light transition-colors"
    onClick={() => setOpen(false)}
  >
    Connexion
  </Link>
)}
{status === 'authenticated' && (
  <div className="flex items-center gap-3">
    <UserMenu />
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add growi-frontend/components/layout/Header.tsx
git commit -m "feat(auth): update Header — session-aware Connexion/UserMenu CTA"
```

---

## Task 13: Build dashboard layout components

**Files:**
- Create: `growi-frontend/components/dashboard/DashboardHeader.tsx`
- Create: `growi-frontend/components/dashboard/DashboardNav.tsx`
- Create: `growi-frontend/components/dashboard/FeatureCard.tsx`

- [ ] **Step 1: Create `DashboardHeader.tsx`**

```typescript
// growi-frontend/components/dashboard/DashboardHeader.tsx
import Link from 'next/link'
import { auth } from '@/auth'
import { UserMenu } from '@/components/auth/UserMenu'

export async function DashboardHeader() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'Jardinier'

  return (
    <header className="sticky top-0 z-40 bg-sand/80 backdrop-blur-md border-b border-forest/10">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-poppins font-bold text-lg text-forest hover:text-forest-light transition-colors"
        >
          Growi 🌱
        </Link>
        <p className="font-raleway text-sm text-forest/70 hidden sm:block">
          Bonjour, <span className="font-semibold text-forest">{firstName}</span> 👋
        </p>
        <UserMenu />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create `DashboardNav.tsx`**

```typescript
// growi-frontend/components/dashboard/DashboardNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',           label: 'Accueil',        icon: LayoutDashboard },
  { href: '/dashboard/plantes',   label: 'Mes plantes',    icon: Leaf },
  { href: '/dashboard/calendrier',label: 'Calendrier',     icon: CalendarDays },
  { href: '/dashboard/diagnostic',label: 'Diagnostic IA',  icon: Stethoscope },
  { href: '/dashboard/meteo',     label: 'Météo',          icon: CloudSun },
  { href: '/dashboard/marketplace',label: 'Marketplace',   icon: ShoppingBag },
  { href: '/dashboard/compte',    label: 'Mon compte',     icon: UserCircle },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Sidebar — desktop */}
      <nav
        aria-label="Navigation tableau de bord"
        className="hidden md:flex flex-col w-56 shrink-0 py-6 gap-1 border-r border-forest/10 bg-white"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 font-raleway text-sm transition-colors',
                active
                  ? 'bg-lime/20 text-forest font-semibold'
                  : 'text-forest/60 hover:bg-sand hover:text-forest',
              )}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav — mobile (5 items max) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-forest/10 flex items-center justify-around px-2 pb-safe"
      >
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-3 font-raleway text-[10px] transition-colors',
                active ? 'text-forest' : 'text-forest/50',
              )}
            >
              <Icon
                size={22}
                aria-hidden
                className={cn(active && 'stroke-[2.5]')}
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
```

- [ ] **Step 3: Create `FeatureCard.tsx`**

```typescript
// growi-frontend/components/dashboard/FeatureCard.tsx
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
  badge?: string
  className?: string
}

export function FeatureCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
  className,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5',
        className,
      )}
    >
      {badge && (
        <span className="absolute top-4 right-4 rounded-full bg-lime/20 px-2 py-0.5 font-poppins text-[10px] font-semibold text-forest uppercase tracking-wide">
          {badge}
        </span>
      )}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/15 text-forest group-hover:bg-lime/30 transition-colors">
        <Icon size={22} aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-poppins font-semibold text-sm text-forest">{title}</h3>
        <p className="font-raleway text-xs text-forest/60 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add growi-frontend/components/dashboard/
git commit -m "feat(dashboard): build DashboardHeader, DashboardNav, FeatureCard components"
```

---

## Task 14: Build dashboard layout and pages

**Files:**
- Create: `growi-frontend/app/dashboard/layout.tsx`
- Create: `growi-frontend/app/dashboard/page.tsx`
- Create: `growi-frontend/app/dashboard/[feature]/page.tsx`

- [ ] **Step 1: Create `dashboard/layout.tsx`**

```typescript
// growi-frontend/app/dashboard/layout.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardNav } from '@/components/dashboard/DashboardNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen bg-sand">
      <DashboardHeader />
      <div className="flex flex-1 max-w-screen-xl mx-auto w-full">
        <DashboardNav />
        <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `dashboard/page.tsx`**

```typescript
// growi-frontend/app/dashboard/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import {
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
  TrendingUp,
} from 'lucide-react'
import { FeatureCard } from '@/components/dashboard/FeatureCard'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

const featureCards = [
  {
    href: '/dashboard/plantes',
    title: 'Mes plantes',
    description: 'Gérez vos plantes et suivez leur entretien.',
    icon: Leaf,
  },
  {
    href: '/dashboard/calendrier',
    title: 'Calendrier',
    description: 'Planning personnalisé calé sur la météo.',
    icon: CalendarDays,
  },
  {
    href: '/dashboard/diagnostic',
    title: 'Diagnostic IA',
    description: 'Identifiez maladies et nuisibles en photo.',
    icon: Stethoscope,
    badge: 'Bientôt',
  },
  {
    href: '/dashboard/meteo',
    title: 'Météo locale',
    description: 'Alertes gel, canicule et arrosage optimal.',
    icon: CloudSun,
  },
  {
    href: '/dashboard/marketplace',
    title: 'Marketplace',
    description: 'Trouvez des pros et échangez avec voisins.',
    icon: ShoppingBag,
    badge: 'Bientôt',
  },
  {
    href: '/dashboard/compte',
    title: 'Mon compte',
    description: 'Gérez votre profil et votre abonnement.',
    icon: UserCircle,
  },
]

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'Jardinier'

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Bonjour, {firstName} 👋
        </h1>
        <p className="font-raleway text-sm text-forest/60 mt-1">
          Voici un aperçu de ton jardin connecté.
        </p>
      </div>

      {/* Overview stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Plantes', value: '0', sub: 'ajoutées' },
          { label: 'Tâches', value: '0', sub: 'cette semaine' },
          { label: 'Alertes', value: '0', sub: 'en cours' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-1"
          >
            <span className="font-raleway text-xs text-forest/50">{label}</span>
            <span className="font-poppins font-bold text-3xl text-forest">{value}</span>
            <span className="font-raleway text-xs text-forest/40">{sub}</span>
          </div>
        ))}
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureCards.map((card) => (
          <FeatureCard key={card.href} {...card} />
        ))}
      </div>

      {/* Premium CTA banner */}
      <div className="rounded-2xl bg-forest text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} aria-hidden />
          <div>
            <p className="font-poppins font-semibold text-sm">Passer à Premium</p>
            <p className="font-raleway text-xs text-white/70">
              Diagnostics illimités, météo pro, multi-jardins.
            </p>
          </div>
        </div>
        <a
          href="/tarifs"
          className="shrink-0 rounded-lg bg-lime text-forest font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-lime-hover transition-colors"
        >
          Voir les offres
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `dashboard/[feature]/page.tsx`**

```typescript
// growi-frontend/app/dashboard/[feature]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const validFeatures = [
  'plantes',
  'calendrier',
  'diagnostic',
  'meteo',
  'marketplace',
  'compte',
] as const

type Feature = (typeof validFeatures)[number]

const featureLabels: Record<Feature, string> = {
  plantes:      'Mes plantes',
  calendrier:   'Calendrier',
  diagnostic:   'Diagnostic IA',
  meteo:        'Météo locale',
  marketplace:  'Marketplace',
  compte:       'Mon compte',
}

export async function generateMetadata({
  params,
}: {
  params: { feature: string }
}): Promise<Metadata> {
  if (!validFeatures.includes(params.feature as Feature)) return {}
  return { title: featureLabels[params.feature as Feature] }
}

export default function FeaturePage({
  params,
}: {
  params: { feature: string }
}) {
  if (!validFeatures.includes(params.feature as Feature)) notFound()

  const label = featureLabels[params.feature as Feature]

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="text-5xl">🌱</div>
      <h1 className="font-poppins font-bold text-xl text-forest">{label}</h1>
      <p className="font-raleway text-sm text-forest/60 max-w-xs">
        Cette section arrive bientôt. Reste connecté pour ne pas rater le lancement !
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add growi-frontend/app/dashboard/
git commit -m "feat(dashboard): build protected layout + home page + [feature] placeholders"
```

---

## Task 15: Set AUTH_SECRET env variable

**Files:**
- Create: `growi-frontend/.env.local`

- [ ] **Step 1: Generate secret and create `.env.local`**

Run:
```bash
openssl rand -base64 32
```

Create `growi-frontend/.env.local` (never commit this file):
```
AUTH_SECRET=<paste-generated-secret-here>
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 2: Verify `.env.local` is in `.gitignore`**

Check `growi-frontend/.gitignore` contains:
```
.env*.local
```

If not, add it:
```bash
echo ".env*.local" >> growi-frontend/.gitignore
git add growi-frontend/.gitignore
git commit -m "chore: ensure .env.local is gitignored"
```

- [ ] **Step 3: Commit reminder (DO NOT commit the secret)**

```bash
# Only commit .gitignore changes if needed — never .env.local
git status  # Verify .env.local is not staged
```

---

## Task 16: End-to-end smoke test

No automated tests exist (no test runner configured). Manual verification only.

- [ ] **Step 1: Start dev server**

```bash
cd growi-frontend && npm run dev
```

Expected: No TypeScript or module errors in terminal.

- [ ] **Step 2: Test registration flow**

1. Open `http://localhost:3000/register`
2. Fill form: Prénom=Julie, Email=julie@test.com, Password=Test1234, Confirm=Test1234
3. Expected: redirect to `/dashboard` with greeting "Bonjour, Julie"

- [ ] **Step 3: Test logout**

1. Click UserMenu avatar in dashboard header
2. Click "Déconnexion"
3. Expected: redirect to `/`

- [ ] **Step 4: Test login flow**

1. Open `http://localhost:3000/login`
2. Enter same credentials
3. Expected: redirect to `/dashboard`

- [ ] **Step 5: Test middleware protection**

1. Clear cookies / open incognito
2. Navigate directly to `http://localhost:3000/dashboard`
3. Expected: redirect to `/login`

- [ ] **Step 6: Test auth pages have no Header/Footer**

1. Open `/login` and `/register`
2. Expected: no Growi nav header, no footer — only the card on sand background

- [ ] **Step 7: Test Header CTA state**

1. While logged in, visit `/` (marketing homepage)
2. Expected: Header shows avatar initials instead of "Connexion" button

- [ ] **Step 8: Build check**

```bash
npm run build
```

Expected: exits 0, no type errors.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(auth): complete authentication & dashboard — login, register, protected dashboard, UserMenu"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| `/login` page — layout, logo, H1, LoginForm | Tasks 8, 10 |
| `/register` page — layout, password strength, RegisterForm | Tasks 9, 10 |
| Auth.js v5 Credentials provider | Task 3 |
| JWT session strategy | Task 3 |
| In-memory user store | Task 2 |
| Edge middleware protecting `/dashboard/*` | Task 4 |
| `loginSchema` + `registerSchema` with exact rules | Task 2 |
| `/dashboard` protected layout with session guard | Task 14 |
| DashboardHeader sticky (sand/80 backdrop-blur) | Task 13 |
| Greeting "Bonjour, {firstName}" | Tasks 13, 14 |
| DashboardNav sidebar desktop + bottom nav mobile | Task 13 |
| navItems: Accueil, Mes plantes, Calendrier, Diagnostic IA, Météo, Marketplace, Mon compte | Task 13 |
| Dashboard home: overview cards + FeatureCard grid + CTA Premium banner | Task 14 |
| `/dashboard/[feature]` placeholders | Task 14 |
| Header.tsx session-aware CTA | Task 12 |
| UserMenu with avatar initials + dropdown | Task 11 |
| Accessibility: aria-invalid, aria-describedby, aria-live | Tasks 8, 9 |
| autocomplete attributes | Tasks 8, 9 |
| No OAuth / social login (TODO commented) | Task 3 |
| No "mot de passe oublié" (TODO commented) | Task 8 |
| SessionProvider in root layout | Task 7 |
| Route group isolation (auth pages no Header/Footer) | Tasks 6, 7 |
| Register Server Action + auto sign-in | Task 5 |
| AUTH_SECRET env var | Task 15 |

### Type consistency check

- `MockUser.id` (string), `MockUser.firstName` (string) — used consistently in `auth.ts` callbacks and `DashboardHeader`
- `session.user.firstName` augmented in `auth.ts` — consumed in `DashboardHeader.tsx` and `dashboard/page.tsx`
- `FeatureCard` props use `LucideIcon` type — icons passed as `icon: Leaf` etc., consistent
- `validFeatures` tuple in `[feature]/page.tsx` — `notFound()` called for unknown slugs

No placeholder text detected. All code blocks are complete.
