# Paramètres Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/dashboard/parametres` with a profile editor and alert configuration panel, backed by localStorage.

**Architecture:** A server page reads the session and passes initial data to a client-side `ParametresLayout` that owns the `useUserProfile` hook. Two forms (`ProfilForm`, `AlertesForm`) receive profile state and update functions as props. The weather page is updated to accept a string address instead of the old structured `UserAddress`.

**Tech Stack:** Next.js 14 App Router · shadcn/ui · react-hook-form · zod · Framer Motion · localStorage · custom `useToast`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `lib/mock-users.ts` | Remove `UserAddress`, add `UserProfile`, `AlertConfig`, `defaultAlertConfig` |
| Modify | `app/dashboard/meteo/page.tsx` | Pass `address: string \| null` instead of `UserAddress` |
| Modify | `components/dashboard/meteo/WeatherPageClient.tsx` | Geocode string address; listen to `growi:profile-updated` |
| Modify | `components/dashboard/DashboardNav.tsx` | Add "Paramètres" nav item |
| Modify | `components/auth/UserMenu.tsx` | Read `avatarColor` from `useUserProfile` |
| Create | `hooks/useUserProfile.ts` | localStorage read/write + event dispatch |
| Create | `lib/schemas/profil-schema.ts` | Zod schema for profile form |
| Create | `components/dashboard/parametres/AvatarEditor.tsx` | Initials circle + 5 colour swatches |
| Create | `components/dashboard/parametres/AlertToggleCard.tsx` | Reusable toggle card with animated expand |
| Create | `components/dashboard/parametres/ProfilForm.tsx` | Profile form + password dialog |
| Create | `components/dashboard/parametres/AlertesForm.tsx` | All alert sections |
| Create | `components/dashboard/parametres/ParametresLayout.tsx` | Tabs + hash sync, owns hook |
| Create | `app/dashboard/parametres/page.tsx` | Server page, reads session |

---

## Task 1 — Install missing shadcn components

**Files:**
- Run commands in: `growi-frontend/`

- [ ] **Step 1: Install components**

```bash
cd growi-frontend
npx shadcn@latest add switch slider radio-group dialog skeleton tooltip
```

Expected: each component added to `components/ui/`. Answer `y` to all prompts.

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/ui/
git commit -m "chore: install shadcn switch, slider, radio-group, dialog, skeleton, tooltip"
```

---

## Task 2 — Migrate MockUser.address to string + fix weather

**Files:**
- Modify: `growi-frontend/lib/mock-users.ts`
- Modify: `growi-frontend/app/dashboard/meteo/page.tsx`
- Modify: `growi-frontend/components/dashboard/meteo/WeatherPageClient.tsx`

- [ ] **Step 1: Update mock-users.ts — remove UserAddress, change address to string**

Replace the entire file content with:

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
  address?: string // Plain string address, e.g. "1 Rue de Rivoli, Paris 75001, France"
}

// In-memory store — resets on server restart (MVP only)
const users: MockUser[] = [
  {
    id: 'seed-user-1',
    firstName: 'Dan',
    email: 'dan0588@gmail.com',
    passwordHash: 'c723ad78fe681b3eaa3a790262f22711c1a0446b5e631348bb4c81faa571d7ef',
    address: '1 Rue de Rivoli, Paris 75001, France',
  },
]

/** Get a user by ID (sync). */
export function getUserById(id: string): MockUser | undefined {
  return users.find((u) => u.id === id)
}

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

- [ ] **Step 2: Update meteo page to pass address as string**

Replace `growi-frontend/app/dashboard/meteo/page.tsx`:

```typescript
// growi-frontend/app/dashboard/meteo/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserById } from '@/lib/mock-users'
import { WeatherPageClient } from '@/components/dashboard/meteo/WeatherPageClient'

export const metadata: Metadata = {
  title: 'Météo — Growi',
  description: "Consulte la météo locale pour optimiser l'entretien de ton jardin.",
  robots: { index: false },
}

export default async function MeteoPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = getUserById(session.user.id)

  return (
    <WeatherPageClient
      userAddress={user?.address ?? null}
      userId={session.user.id}
    />
  )
}
```

- [ ] **Step 3: Rewrite WeatherPageClient to geocode string address**

Replace `growi-frontend/components/dashboard/meteo/WeatherPageClient.tsx`:

```typescript
// growi-frontend/components/dashboard/meteo/WeatherPageClient.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertCircle, MapPin, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { LocationModeSwitcher } from './LocationModeSwitcher'
import { AddressSearchBar } from './AddressSearchBar'
import { GeolocationButton } from './GeolocationButton'
import { WeatherCurrentCard } from './WeatherCurrentCard'
import { WeatherForecastRow } from './WeatherForecastRow'
import { WeatherGardenContextCard } from './WeatherGardenContextCard'
import { WeatherGardenTips } from './WeatherGardenTips'
import { WeatherSkeleton } from './WeatherSkeleton'

import { fetchWeatherByCoordinates, geocodeAddress } from '@/lib/weather-api'
import { buildGardenContext } from '@/lib/garden-context'
import { getUserPlants } from '@/lib/mock-plants'
import { mockWeatherData } from '@/lib/mock-weather'

import type { LocationMode, WeatherData, GardenContext, GeocodingResult } from '@/types/weather'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_WEATHER === 'true'

interface WeatherPageClientProps {
  userAddress: string | null
  userId: string
}

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied'
type Coords = { lat: number; lon: number }

export function WeatherPageClient({ userAddress: initialAddress, userId }: WeatherPageClientProps) {
  const [mode, setMode] = useState<LocationMode>('account')
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [gardenContext, setGardenContext] = useState<GardenContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [accountAddress, setAccountAddress] = useState<string | null>(initialAddress)
  const [accountCoords, setAccountCoords] = useState<Coords | null>(null)

  const plants = useMemo(() => getUserPlants(userId), [userId])

  // ── Geocode account address whenever it changes ───────────────────────────
  useEffect(() => {
    if (!accountAddress) {
      setAccountCoords(null)
      return
    }
    geocodeAddress(accountAddress)
      .then((results) => {
        if (results.length > 0) {
          setAccountCoords({ lat: results[0].latitude, lon: results[0].longitude })
        } else {
          setAccountCoords(null)
        }
      })
      .catch(() => setAccountCoords(null))
  }, [accountAddress])

  // ── Listen for profile updates (address changed in /parametres) ───────────
  useEffect(() => {
    function handleProfileUpdate(e: Event) {
      const detail = (e as CustomEvent<{ address?: string }>).detail
      if (detail?.address !== undefined) {
        setAccountAddress(detail.address || null)
      }
    }
    window.addEventListener('growi:profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('growi:profile-updated', handleProfileUpdate)
  }, [])

  // ── Fetch weather and compute garden context ──────────────────────────────
  const loadWeather = useCallback(
    async (lat: number, lon: number, elevation?: number) => {
      setIsLoading(true)
      setError(null)
      setWeatherData(null)
      setGardenContext(null)

      try {
        let data: WeatherData
        if (USE_MOCK) {
          await new Promise((r) => setTimeout(r, 600))
          data = { ...mockWeatherData, fetchedAt: new Date().toISOString() }
        } else {
          data = await fetchWeatherByCoordinates(lat, lon)
        }
        setWeatherData(data)
        const ctx = buildGardenContext(lat, lon, elevation ?? data.elevation, data, plants)
        setGardenContext(ctx)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'La météo est temporairement indisponible. Réessaie dans quelques instants.',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [plants],
  )

  // ── Mode: account — load when coords are resolved ────────────────────────
  useEffect(() => {
    if (mode === 'account' && accountCoords) {
      void loadWeather(accountCoords.lat, accountCoords.lon)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, accountCoords])

  // ── Mode: search — load on address selection ──────────────────────────────
  function handleAddressSelect(result: GeocodingResult) {
    void loadWeather(result.latitude, result.longitude)
  }

  // ── Mode: geolocation ─────────────────────────────────────────────────────
  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('granted')
        void loadWeather(pos.coords.latitude, pos.coords.longitude)
      },
      () => { setGeoStatus('denied') },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── Mode switch ───────────────────────────────────────────────────────────
  function handleModeChange(next: LocationMode) {
    setMode(next)
    setWeatherData(null)
    setGardenContext(null)
    setError(null)
    if (next !== 'geolocation') setGeoStatus('idle')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">Météo jardin</h1>
        <p className="font-raleway text-sm text-forest/60 mt-0.5">
          Consultez la météo locale pour optimiser l&apos;entretien de votre jardin.
        </p>
      </div>

      <LocationModeSwitcher
        mode={mode}
        onChange={handleModeChange}
        hasAccountAddress={!!accountAddress}
      />

      {mode === 'account' && !accountAddress && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-forest/10 bg-white p-8 text-center">
          <MapPin size={32} aria-hidden className="text-forest/30" />
          <p className="font-poppins font-semibold text-forest">Aucune adresse configurée</p>
          <p className="font-raleway text-sm text-forest/60 max-w-xs leading-relaxed">
            Configure ton adresse dans tes paramètres pour obtenir la météo de ton jardin automatiquement.
          </p>
          <Link
            href="/dashboard/parametres"
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 font-raleway font-semibold text-sm text-forest transition-colors hover:bg-lime/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
          >
            Configurer mon adresse
          </Link>
        </div>
      )}

      {mode === 'search' && <AddressSearchBar onSelect={handleAddressSelect} />}

      {mode === 'geolocation' && geoStatus !== 'granted' && (
        <GeolocationButton status={geoStatus} onRequest={requestGeolocation} />
      )}

      {isLoading && <WeatherSkeleton />}

      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={32} aria-hidden className="text-red-400" />
          <p className="font-poppins font-semibold text-forest">{error}</p>
          <button
            onClick={() => {
              if (mode === 'account' && accountCoords) {
                void loadWeather(accountCoords.lat, accountCoords.lon)
              } else if (mode === 'geolocation') {
                requestGeolocation()
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white px-5 py-2.5 font-raleway text-sm text-forest transition-colors hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} aria-hidden />
            Réessayer
          </button>
        </div>
      )}

      {!isLoading && weatherData && (
        <>
          <WeatherCurrentCard data={weatherData} />
          {gardenContext && <WeatherGardenContextCard context={gardenContext} />}
          <WeatherForecastRow forecast={weatherData.forecast} />
          <WeatherGardenTips context={gardenContext} forecast={weatherData.forecast} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build check**

```bash
cd growi-frontend && npm run build
```

Expected: no TypeScript errors about `UserAddress`.

- [ ] **Step 5: Commit**

```bash
git add growi-frontend/lib/mock-users.ts growi-frontend/app/dashboard/meteo/page.tsx growi-frontend/components/dashboard/meteo/WeatherPageClient.tsx
git commit -m "refactor: migrate MockUser.address to string, update WeatherPageClient to geocode"
```

---

## Task 3 — Extend mock-users.ts with UserProfile types

**Files:**
- Modify: `growi-frontend/lib/mock-users.ts`

- [ ] **Step 1: Add types at the end of mock-users.ts (after the `verifyUser` function)**

Append this block to `growi-frontend/lib/mock-users.ts`:

```typescript
// ─── UserProfile — stored in localStorage key 'growi_user_profile' ───────────

export type NotificationChannel = 'push' | 'email' | 'both' | 'none'
export type AlertFrequency = 'immediate' | 'daily_digest' | 'weekly_digest'

export interface AlertConfig {
  // Alertes météo jardinage
  frostAlert: boolean
  frostThreshold: number           // seuil °C, défaut 2
  heatAlert: boolean
  rainAlert: boolean
  windAlert: boolean
  // Alertes plantes & entretien
  wateringReminder: boolean
  wateringFrequencyDays: number    // défaut 2
  repottingReminder: boolean
  pruningReminder: boolean
  // Alertes calendrier
  seedingAlerts: boolean
  harvestAlerts: boolean
  // Canaux & fréquence
  channel: NotificationChannel
  frequency: AlertFrequency
  quietHoursEnabled: boolean
  quietHoursStart: string          // "HH:MM"
  quietHoursEnd: string            // "HH:MM"
}

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  address?: string                 // plain string, same as MockUser.address
  city?: string                    // display city
  avatarColor?: string             // hex, e.g. '#B4DD7F'
  gardenType?: 'potager' | 'ornement' | 'mixte' | 'interieur' | 'balcon'
  timezone?: string
  alertConfig: AlertConfig
}

export const defaultAlertConfig: AlertConfig = {
  frostAlert: true,
  frostThreshold: 2,
  heatAlert: true,
  rainAlert: false,
  windAlert: false,
  wateringReminder: true,
  wateringFrequencyDays: 2,
  repottingReminder: true,
  pruningReminder: false,
  seedingAlerts: true,
  harvestAlerts: true,
  channel: 'push',
  frequency: 'immediate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/lib/mock-users.ts
git commit -m "feat(parametres): add UserProfile, AlertConfig, defaultAlertConfig types"
```

---

## Task 4 — Create useUserProfile hook

**Files:**
- Create: `growi-frontend/hooks/useUserProfile.ts`

- [ ] **Step 1: Create the hook**

```typescript
// growi-frontend/hooks/useUserProfile.ts
'use client'

import { useState, useEffect } from 'react'
import type { UserProfile, AlertConfig } from '@/lib/mock-users'
import { defaultAlertConfig } from '@/lib/mock-users'

const STORAGE_KEY = 'growi_user_profile'

interface InitialSession {
  firstName: string
  email: string
}

export function useUserProfile(initial?: InitialSession) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setProfile(JSON.parse(stored) as UserProfile)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    } else if (initial) {
      // First visit: seed from session data
      const seed: UserProfile = {
        firstName: initial.firstName,
        lastName: '',
        email: initial.email,
        alertConfig: defaultAlertConfig,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      setProfile(seed)
    }
    setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const base = prev ?? ({} as UserProfile)
      const updated: UserProfile = { ...base, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      // TODO: Replace with PATCH /api/user/profile
      window.dispatchEvent(
        new CustomEvent('growi:profile-updated', { detail: updated }),
      )
      return updated
    })
  }

  const updateAlerts = (updates: Partial<AlertConfig>) => {
    setProfile((prev) => {
      if (!prev) return prev
      const updated: UserProfile = {
        ...prev,
        alertConfig: { ...prev.alertConfig, ...updates },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const resetAlerts = () => {
    setProfile((prev) => {
      if (!prev) return prev
      const updated: UserProfile = { ...prev, alertConfig: defaultAlertConfig }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  return { profile, isLoading, updateProfile, updateAlerts, resetAlerts }
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/hooks/useUserProfile.ts
git commit -m "feat(parametres): add useUserProfile hook with localStorage persistence"
```

---

## Task 5 — Create profil-schema.ts

**Files:**
- Create: `growi-frontend/lib/schemas/profil-schema.ts`

- [ ] **Step 1: Create schema file**

```typescript
// growi-frontend/lib/schemas/profil-schema.ts
import { z } from 'zod'

export const profilSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court (2 caractères min.)'),
  lastName: z.string().min(2, 'Nom trop court (2 caractères min.)'),
  email: z.string().email('Email invalide — vérifie le format : prenom@domaine.fr'),
  address: z.string().optional(),
  gardenType: z
    .enum(['potager', 'ornement', 'mixte', 'interieur', 'balcon'])
    .optional(),
})

export type ProfilInput = z.infer<typeof profilSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z
      .string()
      .min(8, 'Mot de passe trop court (8 caractères min.)')
      .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/lib/schemas/profil-schema.ts
git commit -m "feat(parametres): add profil and changePassword zod schemas"
```

---

## Task 6 — Update DashboardNav

**Files:**
- Modify: `growi-frontend/components/dashboard/DashboardNav.tsx`

- [ ] **Step 1: Add Settings import and nav item**

Replace the entire file:

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
  Map,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',              label: 'Accueil',       icon: LayoutDashboard },
  { href: '/dashboard/jardin',       label: 'Mon Jardin',    icon: Map },
  { href: '/dashboard/plantes',      label: 'Mes plantes',   icon: Leaf },
  { href: '/dashboard/calendrier',   label: 'Calendrier',    icon: CalendarDays },
  { href: '/dashboard/diagnostic',   label: 'Diagnostic IA', icon: Stethoscope },
  { href: '/dashboard/meteo',        label: 'Météo',         icon: CloudSun },
  { href: '/dashboard/marketplace',  label: 'Marketplace',   icon: ShoppingBag },
  { href: '/dashboard/compte',       label: 'Mon compte',    icon: UserCircle },
  { href: '/dashboard/parametres',   label: 'Paramètres',    icon: Settings },
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

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/dashboard/DashboardNav.tsx
git commit -m "feat(parametres): add Paramètres entry to DashboardNav"
```

---

## Task 7 — Create AvatarEditor

**Files:**
- Create: `growi-frontend/components/dashboard/parametres/AvatarEditor.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/parametres/AvatarEditor.tsx
'use client'

import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  { hex: '#B4DD7F', label: 'Lime' },
  { hex: '#F6C445', label: 'Soleil' },
  { hex: '#1E5631', label: 'Forêt' },
  { hex: '#93C5FD', label: 'Ciel' },
  { hex: '#FCA5A5', label: 'Rose' },
] as const

interface AvatarEditorProps {
  initials: string
  color: string
  onChange: (color: string) => void
}

export function AvatarEditor({ initials, color, onChange }: AvatarEditorProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar circle */}
      <div
        aria-label={`Avatar avec les initiales ${initials}`}
        className="w-20 h-20 rounded-full flex items-center justify-center font-poppins font-bold text-2xl text-forest select-none"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Colour swatches */}
      <div className="flex gap-2" role="radiogroup" aria-label="Couleur de l'avatar">
        {AVATAR_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={color === hex}
            aria-label={label}
            onClick={() => onChange(hex)}
            className={cn(
              'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
              color === hex ? 'border-forest scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      {/* TODO: Ajouter upload photo avec next/image */}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/dashboard/parametres/AvatarEditor.tsx
git commit -m "feat(parametres): add AvatarEditor with initials and colour swatches"
```

---

## Task 8 — Create AlertToggleCard

**Files:**
- Create: `growi-frontend/components/dashboard/parametres/AlertToggleCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/parametres/AlertToggleCard.tsx
'use client'

import { useReducedMotion } from 'framer-motion'
import { AnimatePresence, motion } from 'framer-motion'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AlertToggleCardProps {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onToggle: (val: boolean) => void
  children?: React.ReactNode
  badge?: string
  badgeColor?: 'lime' | 'sun' | 'forest'
  switchAriaLabel: string
}

const badgeClass: Record<string, string> = {
  lime: 'bg-lime/20 text-forest border-0',
  sun: 'bg-sun/20 text-forest border-0',
  forest: 'bg-forest/10 text-forest border-0',
}

export function AlertToggleCard({
  icon,
  title,
  description,
  enabled,
  onToggle,
  children,
  badge,
  badgeColor = 'lime',
  switchAriaLabel,
}: AlertToggleCardProps) {
  const prefersReduced = useReducedMotion()

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card p-5 border-l-4 transition-colors duration-200',
        enabled ? 'border-l-lime' : 'border-l-muted',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 shrink-0 text-forest">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-poppins font-semibold text-sm text-forest">{title}</span>
              {badge && (
                <Badge className={cn('text-xs px-2 py-0.5', badgeClass[badgeColor])}>
                  {badge}
                </Badge>
              )}
            </div>
            <p className="font-raleway text-xs text-forest/60 mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={switchAriaLabel}
          aria-checked={enabled}
          className="shrink-0 mt-0.5"
        />
      </div>

      {/* Expandable sub-parameters */}
      <AnimatePresence initial={false}>
        {enabled && children && (
          <motion.div
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-forest/10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/dashboard/parametres/AlertToggleCard.tsx
git commit -m "feat(parametres): add AlertToggleCard with animated expand/collapse"
```

---

## Task 9 — Create ProfilForm

**Files:**
- Create: `growi-frontend/components/dashboard/parametres/ProfilForm.tsx`

- [ ] **Step 1: Create ProfilForm with avatar, fields, and password dialog**

```typescript
// growi-frontend/components/dashboard/parametres/ProfilForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Check, AlertTriangle, Loader2 } from 'lucide-react'

import { AvatarEditor } from './AvatarEditor'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'

import { profilSchema, changePasswordSchema } from '@/lib/schemas/profil-schema'
import type { ProfilInput, ChangePasswordInput } from '@/lib/schemas/profil-schema'
import type { UserProfile } from '@/lib/mock-users'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak'
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  if (hasUpper && hasDigit) return 'strong'
  if (hasUpper || hasDigit) return 'medium'
  return 'weak'
}

const strengthLabel = { weak: 'Faible', medium: 'Moyen', strong: 'Fort' }
const strengthColor = {
  weak: 'bg-red-400',
  medium: 'bg-sun',
  strong: 'bg-lime',
}

interface ProfilFormProps {
  profile: UserProfile
  isLoading: boolean
  updateProfile: (updates: Partial<UserProfile>) => void
}

export function ProfilForm({ profile, isLoading, updateProfile }: ProfilFormProps) {
  const { toast } = useToast()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor ?? '#B4DD7F')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwSaveState, setPwSaveState] = useState<SaveState>('idle')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfilInput>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      address: profile.address ?? '',
      gardenType: profile.gardenType,
    },
  })

  // Sync form when profile loads
  useEffect(() => {
    reset({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      address: profile.address ?? '',
      gardenType: profile.gardenType,
    })
    setAvatarColor(profile.avatarColor ?? '#B4DD7F')
  }, [profile, reset])

  const firstNameVal = watch('firstName') ?? ''
  const lastNameVal = watch('lastName') ?? ''
  const initials = (
    (firstNameVal[0] ?? '') + (lastNameVal[0] ?? '')
  ).toUpperCase() || profile.email.slice(0, 2).toUpperCase()

  async function onSubmit(data: ProfilInput) {
    setSaveState('saving')
    await new Promise((r) => setTimeout(r, 600)) // simulate async
    // TODO: Replace with PATCH /api/user/profile
    updateProfile({ ...data, avatarColor })
    setSaveState('saved')
    toast('Tes informations ont bien été enregistrées 🌱')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  const {
    register: regPw,
    handleSubmit: handlePwSubmit,
    watch: watchPw,
    formState: { errors: pwErrors },
    reset: resetPw,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const newPasswordVal = watchPw('newPassword') ?? ''
  const strength = getPasswordStrength(newPasswordVal)

  async function onPasswordSubmit(_data: ChangePasswordInput) {
    setPwSaveState('saving')
    await new Promise((r) => setTimeout(r, 600))
    // TODO: Connect to PATCH /api/user/password
    setPwSaveState('saved')
    toast('Mot de passe mis à jour 🔐')
    setTimeout(() => {
      setPwSaveState('idle')
      setPasswordOpen(false)
      resetPw()
    }, 1500)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex gap-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-2xl shadow-card p-6 md:p-8 space-y-6"
        aria-label="Formulaire informations personnelles"
      >
        {/* Avatar + fields */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <AvatarEditor
            initials={initials}
            color={avatarColor}
            onChange={setAvatarColor}
          />

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prénom */}
            <div className="space-y-1">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p id="firstName-error" role="alert" className="text-xs text-red-500">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            {/* Nom */}
            <div className="space-y-1">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p id="lastName-error" role="alert" className="text-xs text-red-500">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Adresse */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="address">Adresse / Ville</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Information sur l'adresse"
                      className="text-forest/40 hover:text-forest transition-colors"
                    >
                      <span className="text-xs leading-none">ⓘ</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Cette adresse est aussi utilisée pour ta météo personnalisée 🌤️</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="address"
                placeholder="Ex : 14 rue des Lilas, Lyon"
                autoComplete="street-address"
                {...register('address')}
              />
            </div>

            {/* Type de jardin */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="gardenType">Type de jardin</Label>
              <Select
                defaultValue={profile.gardenType}
                onValueChange={(val) =>
                  setValue('gardenType', val as ProfilInput['gardenType'])
                }
              >
                <SelectTrigger id="gardenType">
                  <SelectValue placeholder="Choisis ton type de jardin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="potager">🍅 Potager</SelectItem>
                  <SelectItem value="ornement">🌸 Ornemental</SelectItem>
                  <SelectItem value="mixte">🌿 Mixte</SelectItem>
                  <SelectItem value="interieur">🪴 Intérieur</SelectItem>
                  <SelectItem value="balcon">🌺 Balcon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={saveState === 'saving' || saveState === 'saved'}
            aria-busy={saveState === 'saving'}
            className={
              saveState === 'saved'
                ? 'bg-lime text-forest hover:bg-lime'
                : saveState === 'error'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : ''
            }
          >
            {saveState === 'saving' && <Loader2 size={15} className="mr-2 animate-spin" />}
            {saveState === 'saved' && <Check size={15} className="mr-2" />}
            {saveState === 'error' && <AlertTriangle size={15} className="mr-2" />}
            {saveState === 'idle' && 'Enregistrer mes infos'}
            {saveState === 'saving' && 'Enregistrement…'}
            {saveState === 'saved' && 'Enregistré !'}
            {saveState === 'error' && 'Erreur — réessaie'}
          </Button>
        </div>

        {/* Security section */}
        <Separator />
        <div className="space-y-3">
          <h2 className="font-poppins font-semibold text-forest">Sécurité</h2>
          <p className="font-raleway text-sm text-forest/60">
            Email de connexion :{' '}
            <span className="text-forest font-medium">{profile.email}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPasswordOpen(true)}
          >
            Changer mon mot de passe
          </Button>
        </div>
      </form>

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent aria-labelledby="pw-dialog-title">
          <DialogHeader>
            <DialogTitle id="pw-dialog-title">Changer mon mot de passe</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handlePwSubmit(onPasswordSubmit)}
            className="space-y-4 py-2"
          >
            {/* Current password */}
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  aria-describedby={pwErrors.currentPassword ? 'cur-pw-error' : undefined}
                  {...regPw('currentPassword')}
                />
                <button
                  type="button"
                  aria-label={showCurrent ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwErrors.currentPassword && (
                <p id="cur-pw-error" role="alert" className="text-xs text-red-500">
                  {pwErrors.currentPassword.message}
                </p>
              )}
            </div>

            {/* New password */}
            <div className="space-y-1">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  aria-describedby="new-pw-strength"
                  {...regPw('newPassword')}
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPasswordVal.length > 0 && (
                <div id="new-pw-strength" className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1 flex-1">
                    {(['weak', 'medium', 'strong'] as const).map((level, i) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          ['weak', 'medium', 'strong'].indexOf(strength) >= i
                            ? strengthColor[strength]
                            : 'bg-forest/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-forest/60">{strengthLabel[strength]}</span>
                </div>
              )}
              {pwErrors.newPassword && (
                <p role="alert" className="text-xs text-red-500">
                  {pwErrors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirm */}
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirmation</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  aria-describedby={pwErrors.confirm ? 'confirm-error' : undefined}
                  {...regPw('confirm')}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 hover:text-forest"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwErrors.confirm && (
                <p id="confirm-error" role="alert" className="text-xs text-red-500">
                  {pwErrors.confirm.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setPasswordOpen(false); resetPw() }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={pwSaveState === 'saving' || pwSaveState === 'saved'}
                aria-busy={pwSaveState === 'saving'}
              >
                {pwSaveState === 'saving' && (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                )}
                {pwSaveState === 'saving' ? 'Mise à jour…' : 'Mettre à jour'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

Expected: no errors. If `@hookform/resolvers` is missing, run `npm install @hookform/resolvers` then rebuild.

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/dashboard/parametres/ProfilForm.tsx
git commit -m "feat(parametres): add ProfilForm with react-hook-form, zod, avatar, password dialog"
```

---

## Task 10 — Create AlertesForm

**Files:**
- Create: `growi-frontend/components/dashboard/parametres/AlertesForm.tsx`

- [ ] **Step 1: Create AlertesForm**

```typescript
// growi-frontend/components/dashboard/parametres/AlertesForm.tsx
'use client'

import { useState } from 'react'
import {
  Thermometer, Sun, CloudRain, Wind,
  Droplets, Flower2, Scissors,
  Sprout, Apple,
  Loader2, Check, AlertTriangle,
} from 'lucide-react'

import { AlertToggleCard } from './AlertToggleCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

import type { UserProfile, AlertConfig, NotificationChannel, AlertFrequency } from '@/lib/mock-users'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface AlertesFormProps {
  profile: UserProfile
  isLoading: boolean
  updateAlerts: (updates: Partial<AlertConfig>) => void
  resetAlerts: () => void
}

export function AlertesForm({ profile, isLoading, updateAlerts, resetAlerts }: AlertesFormProps) {
  const { toast } = useToast()
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const ac = profile.alertConfig

  async function handleSave() {
    setSaveState('saving')
    await new Promise((r) => setTimeout(r, 600))
    // TODO: Replace with PATCH /api/user/alerts
    setSaveState('saved')
    toast('Tes préférences d'alertes ont été sauvegardées 🔔')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  function handleReset() {
    resetAlerts()
    toast('Alertes réinitialisées aux paramètres par défaut.')
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Alertes météo ─────────────────────────────────────────── */}
      <section aria-labelledby="section-meteo">
        <h2
          id="section-meteo"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Alertes météo
          <span className="text-xs font-raleway font-normal bg-lime/20 text-forest px-2 py-0.5 rounded-full">
            Météo
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Thermometer size={18} />}
            title="Risque de gel"
            description={`Je t'alerte quand le thermomètre risque de tomber sous ${ac.frostThreshold}°C.`}
            enabled={ac.frostAlert}
            onToggle={(v) => updateAlerts({ frostAlert: v })}
            switchAriaLabel="Activer les alertes de gel"
          >
            <div className="space-y-2">
              <Label htmlFor="frost-slider">Seuil de température</Label>
              <div className="flex items-center gap-3">
                <Slider
                  id="frost-slider"
                  min={-5}
                  max={5}
                  step={1}
                  value={[ac.frostThreshold]}
                  onValueChange={([v]) => updateAlerts({ frostThreshold: v })}
                  className="flex-1"
                  aria-label="Seuil de gel"
                  aria-valuemin={-5}
                  aria-valuemax={5}
                  aria-valuenow={ac.frostThreshold}
                  aria-valuetext={`${ac.frostThreshold}°C`}
                />
                <span className="w-14 text-center font-semibold text-forest font-poppins">
                  {ac.frostThreshold}°C
                </span>
              </div>
            </div>
          </AlertToggleCard>

          <AlertToggleCard
            icon={<Sun size={18} />}
            title="Alerte canicule"
            description="Je t'alerte quand les températures dépassent 35°C."
            enabled={ac.heatAlert}
            onToggle={(v) => updateAlerts({ heatAlert: v })}
            switchAriaLabel="Activer les alertes canicule"
          />

          <AlertToggleCard
            icon={<CloudRain size={18} />}
            title="Pluie forte"
            description="Je t'alerte en cas de précipitations supérieures à 20mm dans la journée."
            enabled={ac.rainAlert}
            onToggle={(v) => updateAlerts({ rainAlert: v })}
            switchAriaLabel="Activer les alertes pluie forte"
          />

          <AlertToggleCard
            icon={<Wind size={18} />}
            title="Vent violent"
            description="Je t'alerte si les vents dépassent 50 km/h."
            enabled={ac.windAlert}
            onToggle={(v) => updateAlerts({ windAlert: v })}
            switchAriaLabel="Activer les alertes vent violent"
          />
        </div>
      </section>

      {/* ── Entretien & plantes ───────────────────────────────────── */}
      <section aria-labelledby="section-plantes">
        <h2
          id="section-plantes"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Entretien &amp; plantes
          <span className="text-xs font-raleway font-normal bg-sun/20 text-forest px-2 py-0.5 rounded-full">
            Plantes
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Droplets size={18} />}
            title="Rappels d'arrosage"
            description="Je te rappelle d'arroser tes plantes selon leur besoin."
            enabled={ac.wateringReminder}
            onToggle={(v) => updateAlerts({ wateringReminder: v })}
            switchAriaLabel="Activer les rappels d'arrosage"
          >
            <div className="space-y-2">
              <Label>Fréquence des rappels</Label>
              <RadioGroup
                value={String(ac.wateringFrequencyDays)}
                onValueChange={(v) => updateAlerts({ wateringFrequencyDays: Number(v) })}
                className="space-y-1"
              >
                {[
                  { value: '1', label: 'Tous les jours' },
                  { value: '2', label: 'Tous les 2 jours' },
                  { value: '3', label: 'Tous les 3 jours' },
                  { value: '7', label: 'Une fois par semaine' },
                ].map(({ value, label }) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={value}
                      id={`watering-${value}`}
                      aria-label={label}
                    />
                    <Label htmlFor={`watering-${value}`} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </AlertToggleCard>

          <AlertToggleCard
            icon={<Flower2 size={18} />}
            title="Rempotage saisonnier"
            description="Je t'avertis quand c'est le bon moment pour rempoter."
            enabled={ac.repottingReminder}
            onToggle={(v) => updateAlerts({ repottingReminder: v })}
            switchAriaLabel="Activer les rappels de rempotage"
          />

          <AlertToggleCard
            icon={<Scissors size={18} />}
            title="Rappels de taille"
            description="Je te préviens des périodes de taille idéales pour tes plantes."
            enabled={ac.pruningReminder}
            onToggle={(v) => updateAlerts({ pruningReminder: v })}
            switchAriaLabel="Activer les rappels de taille"
          />
        </div>
      </section>

      {/* ── Calendrier jardin ─────────────────────────────────────── */}
      <section aria-labelledby="section-calendrier">
        <h2
          id="section-calendrier"
          className="font-poppins font-semibold text-forest mb-3 flex items-center gap-2"
        >
          Calendrier jardin
          <span className="text-xs font-raleway font-normal bg-forest/10 text-forest px-2 py-0.5 rounded-full">
            Calendrier
          </span>
        </h2>
        <div className="space-y-3">
          <AlertToggleCard
            icon={<Sprout size={18} />}
            title="Périodes de semis"
            description="Je t'alerte quand c'est le bon moment pour semer selon ta zone climatique."
            enabled={ac.seedingAlerts}
            onToggle={(v) => updateAlerts({ seedingAlerts: v })}
            switchAriaLabel="Activer les alertes de semis"
          />

          <AlertToggleCard
            icon={<Apple size={18} />}
            title="Récoltes imminentes"
            description="Je te préviens quand tes cultures approchent de la maturité."
            enabled={ac.harvestAlerts}
            onToggle={(v) => updateAlerts({ harvestAlerts: v })}
            switchAriaLabel="Activer les alertes de récolte"
          />
        </div>
      </section>

      {/* ── Comment te contacter ──────────────────────────────────── */}
      <section aria-labelledby="section-livraison">
        <h2
          id="section-livraison"
          className="font-poppins font-semibold text-forest mb-4"
        >
          Comment te contacter
        </h2>
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-5">
          {/* Canal */}
          <div className="space-y-2">
            <Label htmlFor="channel">Canal de notification</Label>
            <Select
              value={ac.channel}
              onValueChange={(v) => updateAlerts({ channel: v as NotificationChannel })}
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push">📱 Notifications push uniquement</SelectItem>
                <SelectItem value="email">📧 Email uniquement</SelectItem>
                <SelectItem value="both">📱📧 Push et email</SelectItem>
                <SelectItem value="none">🔕 Désactiver toutes les notifications</SelectItem>
              </SelectContent>
            </Select>
            {ac.channel === 'none' && (
              <div
                role="alert"
                className="bg-sun/20 rounded-xl p-3 font-raleway text-sm text-forest mt-2"
              >
                Tu ne recevras aucune alerte. Ton jardin risque de souffrir sans toi ! 🌵
              </div>
            )}
          </div>

          {/* Fréquence */}
          <div className="space-y-2">
            <Label>Fréquence d&apos;envoi</Label>
            <RadioGroup
              value={ac.frequency}
              onValueChange={(v) => updateAlerts({ frequency: v as AlertFrequency })}
              className="space-y-1"
            >
              {[
                { value: 'immediate', label: '⚡ Alertes immédiates' },
                { value: 'daily_digest', label: '☀️ Résumé quotidien (8h du matin)' },
                { value: 'weekly_digest', label: '📋 Résumé hebdomadaire (lundi matin)' },
              ].map(({ value, label }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`freq-${value}`} />
                  <Label htmlFor={`freq-${value}`} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Heures silencieuses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quiet-hours-switch">Heures silencieuses</Label>
              <Switch
                id="quiet-hours-switch"
                checked={ac.quietHoursEnabled}
                onCheckedChange={(v) => updateAlerts({ quietHoursEnabled: v })}
                aria-checked={ac.quietHoursEnabled}
                aria-label="Activer les heures silencieuses"
              />
            </div>
            {ac.quietHoursEnabled && (
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label htmlFor="quiet-start">De</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={ac.quietHoursStart}
                    onChange={(e) => updateAlerts({ quietHoursStart: e.target.value })}
                    className="w-32"
                  />
                </div>
                <span className="text-forest/50 mt-5">→</span>
                <div className="space-y-1">
                  <Label htmlFor="quiet-end">À</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={ac.quietHoursEnd}
                    onChange={(e) => updateAlerts({ quietHoursEnd: e.target.value })}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Action buttons ───────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost">Réinitialiser</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser les alertes ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes tes préférences reviendront aux paramètres par défaut.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-red-500 hover:bg-red-600">
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={handleSave}
          disabled={saveState === 'saving' || saveState === 'saved'}
          aria-busy={saveState === 'saving'}
          className={
            saveState === 'saved'
              ? 'bg-lime text-forest hover:bg-lime'
              : saveState === 'error'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : ''
          }
        >
          {saveState === 'saving' && <Loader2 size={15} className="mr-2 animate-spin" />}
          {saveState === 'saved' && <Check size={15} className="mr-2" />}
          {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré !' : 'Enregistrer mes alertes'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/dashboard/parametres/AlertesForm.tsx
git commit -m "feat(parametres): add AlertesForm with all 10 alert toggles and delivery settings"
```

---

## Task 11 — Create ParametresLayout + page.tsx

**Files:**
- Create: `growi-frontend/components/dashboard/parametres/ParametresLayout.tsx`
- Create: `growi-frontend/app/dashboard/parametres/page.tsx`

- [ ] **Step 1: Create ParametresLayout**

```typescript
// growi-frontend/components/dashboard/parametres/ParametresLayout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bell } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfilForm } from './ProfilForm'
import { AlertesForm } from './AlertesForm'
import { useUserProfile } from '@/hooks/useUserProfile'

interface ParametresLayoutProps {
  initialSession: { firstName: string; email: string }
}

type TabValue = 'profil' | 'alertes'

export function ParametresLayout({ initialSession }: ParametresLayoutProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabValue>('profil')
  const { profile, isLoading, updateProfile, updateAlerts, resetAlerts } =
    useUserProfile(initialSession)

  // Sync with URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'alertes') setActiveTab('alertes')
  }, [])

  function handleTabChange(value: string) {
    const tab = value as TabValue
    setActiveTab(tab)
    router.replace(`/dashboard/parametres#${tab}`, { scroll: false })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">Paramètres</h1>
        <p className="font-raleway text-forest/70 mt-1">
          Gère ton profil et tes préférences de notifications.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="border-b border-forest/10 bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1">
          <TabsTrigger
            value="profil"
            className="flex items-center gap-2 px-4 py-2.5 font-raleway text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-lime data-[state=active]:text-forest data-[state=active]:font-semibold text-forest/60 hover:text-forest transition-colors bg-transparent shadow-none"
          >
            <User size={15} aria-hidden />
            Mon profil
          </TabsTrigger>
          <TabsTrigger
            value="alertes"
            className="flex items-center gap-2 px-4 py-2.5 font-raleway text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-lime data-[state=active]:text-forest data-[state=active]:font-semibold text-forest/60 hover:text-forest transition-colors bg-transparent shadow-none"
          >
            <Bell size={15} aria-hidden />
            Mes alertes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6 animate-in fade-in-0 duration-200">
          {profile ? (
            <ProfilForm
              profile={profile}
              isLoading={isLoading}
              updateProfile={updateProfile}
            />
          ) : (
            !isLoading && (
              <div className="bg-white rounded-2xl shadow-card p-8 text-center space-y-4">
                <p className="font-raleway text-forest/70">
                  Ton profil n&apos;est pas encore configuré.
                </p>
                <button
                  onClick={() =>
                    updateProfile({
                      firstName: initialSession.firstName,
                      lastName: '',
                      email: initialSession.email,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 font-raleway font-semibold text-sm text-forest transition-colors hover:bg-lime/80"
                >
                  Créer mon profil
                </button>
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="alertes" className="mt-6 animate-in fade-in-0 duration-200">
          {profile ? (
            <AlertesForm
              profile={profile}
              isLoading={isLoading}
              updateAlerts={updateAlerts}
              resetAlerts={resetAlerts}
            />
          ) : (
            !isLoading && (
              <div className="bg-white rounded-2xl shadow-card p-8 text-center">
                <p className="font-raleway text-forest/70">
                  Configure d&apos;abord ton profil pour accéder aux alertes.
                </p>
              </div>
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Create page.tsx**

```typescript
// growi-frontend/app/dashboard/parametres/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ParametresLayout } from '@/components/dashboard/parametres/ParametresLayout'

export const metadata: Metadata = {
  title: 'Paramètres — Growi',
  description: 'Gère ton profil et tes préférences de notifications.',
  robots: { index: false },
}

export default async function ParametresPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <ParametresLayout
      initialSession={{
        firstName: session.user.firstName ?? session.user.name ?? 'Jardinier',
        email: session.user.email ?? '',
      }}
    />
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add growi-frontend/components/dashboard/parametres/ParametresLayout.tsx growi-frontend/app/dashboard/parametres/page.tsx
git commit -m "feat(parametres): add ParametresLayout with tab/hash sync and page route"
```

---

## Task 12 — Update UserMenu with avatarColor from profile

**Files:**
- Modify: `growi-frontend/components/auth/UserMenu.tsx`

- [ ] **Step 1: Update UserMenu to read avatarColor from localStorage**

Replace the entire file:

```typescript
// growi-frontend/components/auth/UserMenu.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, User, Settings } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

export function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { profile } = useUserProfile()

  const avatarColor = profile?.avatarColor ?? '#B4DD7F'

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

  const initials =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
      : profile?.firstName
      ? profile.firstName.slice(0, 2).toUpperCase()
      : session?.user?.firstName
      ? session.user.firstName.slice(0, 2).toUpperCase()
      : (session?.user?.email?.slice(0, 2).toUpperCase() ?? '?')

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu utilisateur"
        className="flex items-center justify-center h-9 w-9 rounded-full font-poppins font-bold text-sm text-forest hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
        style={{ backgroundColor: avatarColor }}
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
            href="/dashboard/compte"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
            onClick={() => setOpen(false)}
          >
            <User size={16} aria-hidden />
            Mon compte
          </Link>
          <Link
            href="/dashboard/parametres"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} aria-hidden />
            Paramètres
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
          >
            <LogOut size={16} aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd growi-frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add growi-frontend/components/auth/UserMenu.tsx
git commit -m "feat(parametres): sync UserMenu avatar color and initials with useUserProfile"
```

---

## Task 13 — Final build, lint, and verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
cd growi-frontend && npm run build
```

Expected: exits 0, no TypeScript errors, no `any` warnings.

- [ ] **Step 2: Lint**

```bash
cd growi-frontend && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server:

```bash
cd growi-frontend && npm run dev
```

Visit in browser:

1. `http://localhost:3000/dashboard/parametres` → page loads with two tabs
2. Tab "Mon profil" → form pre-filled from session, avatar shows initials
3. Click a colour swatch → avatar updates in real time
4. Edit fields, click "Enregistrer" → spinner → "Enregistré !" → toast appears
5. Click "Changer mon mot de passe" → dialog opens, password strength indicator works, Escape closes
6. Tab "Mes alertes" → 10 toggle cards visible
7. Enable frost alert → slider appears with animation
8. Enable watering reminder → radio group appears
9. Select canal "none" → warning banner appears
10. Enable quiet hours → time inputs appear
11. Click "Réinitialiser" → confirmation dialog, confirm → alerts reset to defaults
12. Click "Enregistrer mes alertes" → toast appears
13. Navigate to `/dashboard/meteo` → address mode shows correct location (if address was set in profil)
14. URL hash: visiting `/dashboard/parametres#alertes` → opens alertes tab
15. UserMenu in header → avatar colour matches selection from step 3

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(parametres): complete /dashboard/parametres with profil + alertes — closes feature"
```
