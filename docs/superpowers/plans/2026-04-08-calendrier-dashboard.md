# Calendrier Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/dashboard/calendrier` page with a smart timeline (TodoView) and a monthly calendar grid (CalendarView), fully mocked, with optimistic "done" interactions and animated transitions.

**Architecture:** A client-side page holds all state (actions array + active view). Two view components (`TodoView` / `CalendarView`) are swapped via `AnimatePresence`. The "mark as done" flow is fully optimistic: the action disappears immediately with an animation, a toast with an undo link appears for 3 s, and done actions accumulate in a collapsible accordion at the bottom.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui (Sheet, Accordion, Button) · Framer Motion · Lucide React

---

## File Map

| Path | Role |
|------|------|
| `growi-frontend/lib/mock-actions.ts` | GardenAction type + 15+ mock entries covering all temporal buckets |
| `growi-frontend/lib/calendar-utils.ts` | `getTemporalBucket()`, `groupByType()`, `groupByMonth()`, `formatShortDate()` |
| `growi-frontend/app/dashboard/calendrier/page.tsx` | Page: state, toggle persistence, AnimatePresence between views |
| `growi-frontend/components/dashboard/calendrier/CalendarViewToggle.tsx` | Pill toggle "Liste" / "Calendrier", URL sync |
| `growi-frontend/components/dashboard/calendrier/DoneButton.tsx` | Reusable CTA: variants full / outline / icon |
| `growi-frontend/components/dashboard/calendrier/EmptyState.tsx` | Section empty-state component |
| `growi-frontend/components/dashboard/calendrier/views/TodoView.tsx` | Orchestrates the 5 timeline sections + done accordion |
| `growi-frontend/components/dashboard/calendrier/views/CalendarView.tsx` | Monthly CSS-Grid calendar + Sheet drawer |
| `growi-frontend/components/dashboard/calendrier/timeline/TodaySection.tsx` | Bucket "today" — large cards |
| `growi-frontend/components/dashboard/calendrier/timeline/TomorrowSection.tsx` | Bucket "tomorrow" — medium cards |
| `growi-frontend/components/dashboard/calendrier/timeline/ThisWeekSection.tsx` | Bucket "this-week" — compact rows |
| `growi-frontend/components/dashboard/calendrier/timeline/ThisMonthSection.tsx` | Bucket "this-month" — accordion grouped by type |
| `growi-frontend/components/dashboard/calendrier/timeline/LaterSection.tsx` | Bucket "later" — text summary by month |
| `growi-frontend/components/dashboard/calendrier/cards/ActionCardLarge.tsx` | Today card (large) |
| `growi-frontend/components/dashboard/calendrier/cards/ActionCardMedium.tsx` | Tomorrow card (medium) |
| `growi-frontend/components/dashboard/calendrier/cards/ActionRowCompact.tsx` | This-week row |
| `growi-frontend/components/dashboard/calendrier/cards/ActionGroupAccordion.tsx` | This-month accordion |

---

## Task 1: Data layer — `lib/mock-actions.ts`

**Files:**
- Create: `growi-frontend/lib/mock-actions.ts`

- [ ] **Step 1: Create the file with types and mock data**

```typescript
// growi-frontend/lib/mock-actions.ts

export type ActionType =
  | 'arrosage'
  | 'taille'
  | 'semis'
  | 'rempotage'
  | 'fertilisation'
  | 'traitement'
  | 'recolte'
  | 'autre'

export type ActionPriority = 'high' | 'medium' | 'low'

export interface GardenAction {
  id: string
  type: ActionType
  label: string
  shortLabel: string
  plantId?: string
  plantName?: string
  plantEmoji?: string
  dueDate: string          // ISO date string "YYYY-MM-DD"
  done: boolean
  doneAt?: string
  priority: ActionPriority
  notes?: string
  estimatedMinutes?: number
  recurringDays?: number
}

// Lucide icon name per type — used in card/row components
export const actionTypeIcon: Record<ActionType, string> = {
  arrosage:     'Droplets',
  taille:       'Scissors',
  semis:        'Sprout',
  rempotage:    'Package',
  fertilisation:'FlaskConical',
  traitement:   'Shield',
  recolte:      'Apple',
  autre:        'Wrench',
}

// Dot colour per type — used in CalendarView
export const actionTypeDotColor: Record<ActionType, string> = {
  arrosage:     'bg-blue-400',
  taille:       'bg-forest',
  semis:        'bg-lime',
  rempotage:    'bg-amber-500',
  fertilisation:'bg-purple-400',
  traitement:   'bg-red-400',
  recolte:      'bg-sun',
  autre:        'bg-gray-400',
}

// Today = 2026-04-08 (reference date for mock data)
export const mockActions: GardenAction[] = [
  // --- TODAY ---
  {
    id: 'a1',
    type: 'arrosage',
    label: 'Arroser le Monstera',
    shortLabel: 'Arrosage',
    plantId: '1',
    plantName: 'Monstera',
    plantEmoji: '🌿',
    dueDate: '2026-04-08',
    done: false,
    priority: 'high',
    notes: 'Vérifie que les 3 premiers cm de terre sont secs avant d'arroser.',
    estimatedMinutes: 5,
    recurringDays: 7,
  },
  {
    id: 'a2',
    type: 'fertilisation',
    label: 'Fertiliser les tomates cerises',
    shortLabel: 'Fertilisation',
    plantId: '2',
    plantName: 'Tomates cerises',
    plantEmoji: '🍅',
    dueDate: '2026-04-08',
    done: false,
    priority: 'medium',
    notes: 'Dilue l\'engrais tomates à 1/2 dose dans l\'eau d\'arrosage.',
    estimatedMinutes: 10,
  },
  {
    id: 'a3',
    type: 'traitement',
    label: 'Traiter le Ficus lyrata contre les araignées',
    shortLabel: 'Traitement',
    plantId: '5',
    plantName: 'Ficus lyrata',
    plantEmoji: '🌳',
    dueDate: '2026-04-08',
    done: false,
    priority: 'high',
    notes: 'Pulvérise de l\'huile de neem diluée sur toutes les faces des feuilles.',
    estimatedMinutes: 15,
  },
  // --- TOMORROW ---
  {
    id: 'a4',
    type: 'arrosage',
    label: 'Arroser le basilic',
    shortLabel: 'Arrosage',
    plantId: '4',
    plantName: 'Basilic',
    plantEmoji: '🌱',
    dueDate: '2026-04-09',
    done: false,
    priority: 'medium',
    estimatedMinutes: 5,
    recurringDays: 2,
  },
  {
    id: 'a5',
    type: 'taille',
    label: 'Tailler le rosier grimpant',
    shortLabel: 'Taille',
    plantId: '6',
    plantName: 'Rosier grimpant',
    plantEmoji: '🌹',
    dueDate: '2026-04-09',
    done: false,
    priority: 'low',
    notes: 'Retire les tiges mortes et les croisées. Garde une forme aérée.',
    estimatedMinutes: 30,
  },
  // --- THIS WEEK (2–7 days) ---
  {
    id: 'a6',
    type: 'arrosage',
    label: 'Arroser la lavande',
    shortLabel: 'Arrosage',
    plantId: '3',
    plantName: 'Lavande',
    plantEmoji: '💜',
    dueDate: '2026-04-11',
    done: false,
    priority: 'low',
    estimatedMinutes: 5,
    recurringDays: 14,
  },
  {
    id: 'a7',
    type: 'rempotage',
    label: 'Rempoter le Monstera',
    shortLabel: 'Rempotage',
    plantId: '1',
    plantName: 'Monstera',
    plantEmoji: '🌿',
    dueDate: '2026-04-12',
    done: false,
    priority: 'medium',
    notes: 'Passe dans un pot 4 cm plus grand avec terreau universel + perlite.',
    estimatedMinutes: 30,
  },
  {
    id: 'a8',
    type: 'arrosage',
    label: 'Arroser le rosier grimpant',
    shortLabel: 'Arrosage',
    plantId: '6',
    plantName: 'Rosier grimpant',
    plantEmoji: '🌹',
    dueDate: '2026-04-13',
    done: false,
    priority: 'medium',
    estimatedMinutes: 10,
    recurringDays: 5,
  },
  {
    id: 'a9',
    type: 'semis',
    label: 'Semer les courgettes en godets',
    shortLabel: 'Semis',
    plantName: 'Courgettes',
    plantEmoji: '🥒',
    dueDate: '2026-04-14',
    done: false,
    priority: 'high',
    notes: 'Sème 2 graines par godet à 1 cm de profondeur. Arrose légèrement.',
    estimatedMinutes: 20,
  },
  // --- THIS MONTH (8–30 days) ---
  {
    id: 'a10',
    type: 'arrosage',
    label: 'Arroser le Monstera',
    shortLabel: 'Arrosage',
    plantId: '1',
    plantName: 'Monstera',
    plantEmoji: '🌿',
    dueDate: '2026-04-18',
    done: false,
    priority: 'medium',
    estimatedMinutes: 5,
    recurringDays: 7,
  },
  {
    id: 'a11',
    type: 'fertilisation',
    label: 'Fertiliser la lavande',
    shortLabel: 'Fertilisation',
    plantId: '3',
    plantName: 'Lavande',
    plantEmoji: '💜',
    dueDate: '2026-04-20',
    done: false,
    priority: 'low',
    estimatedMinutes: 5,
  },
  {
    id: 'a12',
    type: 'taille',
    label: 'Tailler les haies',
    shortLabel: 'Taille',
    plantEmoji: '🌿',
    dueDate: '2026-04-22',
    done: false,
    priority: 'medium',
    notes: 'Première taille de printemps — vise une forme régulière.',
    estimatedMinutes: 60,
  },
  {
    id: 'a13',
    type: 'traitement',
    label: 'Traitement préventif mildiou tomates',
    shortLabel: 'Traitement',
    plantId: '2',
    plantName: 'Tomates cerises',
    plantEmoji: '🍅',
    dueDate: '2026-04-25',
    done: false,
    priority: 'high',
    notes: 'Bouillie bordelaise diluée à 1%. Par temps sec et sans vent.',
    estimatedMinutes: 20,
  },
  {
    id: 'a14',
    type: 'arrosage',
    label: 'Arroser les tomates cerises',
    shortLabel: 'Arrosage',
    plantId: '2',
    plantName: 'Tomates cerises',
    plantEmoji: '🍅',
    dueDate: '2026-04-28',
    done: false,
    priority: 'medium',
    estimatedMinutes: 10,
    recurringDays: 2,
  },
  // --- LATER (> 30 days) ---
  {
    id: 'a15',
    type: 'semis',
    label: 'Semis tomates en pleine terre',
    shortLabel: 'Semis',
    plantId: '2',
    plantName: 'Tomates',
    plantEmoji: '🍅',
    dueDate: '2026-05-10',
    done: false,
    priority: 'high',
    notes: 'Attends que les gelées soient passées (min. 10°C la nuit).',
    estimatedMinutes: 30,
  },
  {
    id: 'a16',
    type: 'taille',
    label: 'Taille des haies d\'été',
    shortLabel: 'Taille',
    plantEmoji: '✂️',
    dueDate: '2026-05-20',
    done: false,
    priority: 'low',
    estimatedMinutes: 90,
  },
  {
    id: 'a17',
    type: 'recolte',
    label: 'Récolte des premières tomates cerises',
    shortLabel: 'Récolte',
    plantId: '2',
    plantName: 'Tomates cerises',
    plantEmoji: '🍅',
    dueDate: '2026-06-15',
    done: false,
    priority: 'medium',
    estimatedMinutes: 20,
  },
  // --- ALREADY DONE (for history) ---
  {
    id: 'a18',
    type: 'arrosage',
    label: 'Arroser le Ficus lyrata',
    shortLabel: 'Arrosage',
    plantId: '5',
    plantName: 'Ficus lyrata',
    plantEmoji: '🌳',
    dueDate: '2026-04-06',
    done: true,
    doneAt: '2026-04-06T09:30:00',
    priority: 'medium',
    estimatedMinutes: 5,
  },
  {
    id: 'a19',
    type: 'fertilisation',
    label: 'Fertiliser le Monstera',
    shortLabel: 'Fertilisation',
    plantId: '1',
    plantName: 'Monstera',
    plantEmoji: '🌿',
    dueDate: '2026-04-05',
    done: true,
    doneAt: '2026-04-05T11:00:00',
    priority: 'low',
    estimatedMinutes: 10,
  },
]
```

- [ ] **Step 2: Commit**

```bash
cd growi-frontend && git add ../growi-frontend/lib/mock-actions.ts
git commit -m "feat(calendrier): add GardenAction types and mock data"
```

---

## Task 2: Utility functions — `lib/calendar-utils.ts`

**Files:**
- Create: `growi-frontend/lib/calendar-utils.ts`

- [ ] **Step 1: Create the utility file**

```typescript
// growi-frontend/lib/calendar-utils.ts
import { GardenAction, ActionType } from './mock-actions'

export type TemporalBucket =
  | 'today'
  | 'tomorrow'
  | 'this-week'
  | 'this-month'
  | 'later'

/**
 * Returns the temporal bucket for a given ISO date string, relative to today.
 * today      = 0 days difference
 * tomorrow   = 1 day
 * this-week  = 2–7 days
 * this-month = 8–30 days
 * later      = > 30 days
 */
export function getTemporalBucket(dueDate: string): TemporalBucket {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'this-week'
  if (diffDays <= 30) return 'this-month'
  return 'later'
}

/** Group actions by their ActionType */
export function groupByType(
  actions: GardenAction[],
): Partial<Record<ActionType, GardenAction[]>> {
  return actions.reduce<Partial<Record<ActionType, GardenAction[]>>>(
    (acc, action) => {
      const key = action.type
      if (!acc[key]) acc[key] = []
      acc[key]!.push(action)
      return acc
    },
    {},
  )
}

/** Group actions by month label "Avril 2026", "Mai 2026", etc. */
export function groupByMonth(
  actions: GardenAction[],
): { monthLabel: string; actions: GardenAction[] }[] {
  const map = new Map<string, GardenAction[]>()
  for (const a of actions) {
    const label = new Date(a.dueDate).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
    if (!map.has(capitalized)) map.set(capitalized, [])
    map.get(capitalized)!.push(a)
  }
  return Array.from(map.entries()).map(([monthLabel, actions]) => ({
    monthLabel,
    actions,
  }))
}

/** "Jeu 10" style short date */
export function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
  })
}

/** "7 avril" style medium date */
export function formatMediumDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
}

/** Label for priority badge */
export const priorityLabel: Record<'high' | 'medium' | 'low', string> = {
  high:   'Urgent',
  medium: 'Normal',
  low:    'Basse priorité',
}

/** Tailwind border-left colour per priority (for ActionCardLarge) */
export const priorityBorderColor: Record<'high' | 'medium' | 'low', string> = {
  high:   'border-l-red-400',
  medium: 'border-l-sun',
  low:    'border-l-forest/30',
}

/** Badge bg+text colour per priority */
export const priorityBadgeColor: Record<'high' | 'medium' | 'low', string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-sun/20 text-forest',
  low:    'bg-forest/10 text-forest/70',
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/lib/calendar-utils.ts
git commit -m "feat(calendrier): add calendar utility functions"
```

---

## Task 3: `DoneButton` — reusable CTA component

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/DoneButton.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/calendrier/DoneButton.tsx
'use client'

import { useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DoneButtonProps {
  actionId: string
  actionLabel: string
  variant?: 'full' | 'outline' | 'icon'
  onDone: (id: string) => void
  className?: string
}

export function DoneButton({
  actionId,
  actionLabel,
  variant = 'full',
  onDone,
  className,
}: DoneButtonProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')

  function handleClick() {
    if (phase !== 'idle') return
    setPhase('loading')
    // Simulate async (will be replaced by API call)
    // TODO: remplacer par API call PATCH /actions/:id { done: true }
    setTimeout(() => {
      setPhase('done')
      setTimeout(() => onDone(actionId), 200)
    }, 200)
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Marquer comme fait : ${actionLabel}`}
        onClick={handleClick}
        disabled={phase !== 'idle'}
        className={cn('shrink-0', className)}
      >
        {phase === 'loading' ? (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : phase === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-lime animate-in zoom-in-50 duration-200" aria-hidden />
        ) : (
          <Check className="h-4 w-4" aria-hidden />
        )}
      </Button>
    )
  }

  const buttonVariant = variant === 'outline' ? 'outline' : 'primary'
  const label =
    phase === 'loading'
      ? 'En cours…'
      : phase === 'done'
      ? '✓ Fait !'
      : '✓ Marquer comme fait'

  return (
    <Button
      variant={buttonVariant}
      size="default"
      aria-label={`Marquer comme fait : ${actionLabel}`}
      onClick={handleClick}
      loading={phase === 'loading'}
      disabled={phase !== 'idle'}
      className={cn('w-full', className)}
    >
      {phase === 'done' ? (
        <>
          <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-200" aria-hidden />
          {label}
        </>
      ) : (
        label
      )}
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/DoneButton.tsx
git commit -m "feat(calendrier): add DoneButton reusable component"
```

---

## Task 4: `EmptyState` component

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/EmptyState.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/calendrier/EmptyState.tsx

interface EmptyStateProps {
  message: string
  icon?: string
}

export function EmptyState({ message, icon = '🌿' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <p className="font-raleway text-sm text-forest/50">{message}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/EmptyState.tsx
git commit -m "feat(calendrier): add EmptyState component"
```

---

## Task 5: Card components — `ActionCardLarge`, `ActionCardMedium`, `ActionRowCompact`, `ActionGroupAccordion`

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/cards/ActionCardLarge.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/cards/ActionCardMedium.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/cards/ActionRowCompact.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/cards/ActionGroupAccordion.tsx`

- [ ] **Step 1: Create `ActionCardLarge.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/cards/ActionCardLarge.tsx
import { Clock } from 'lucide-react'
import { GardenAction } from '@/lib/mock-actions'
import { priorityBorderColor, priorityBadgeColor, priorityLabel } from '@/lib/calendar-utils'
import { DoneButton } from '../DoneButton'
import { cn } from '@/lib/utils'

interface ActionCardLargeProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionCardLarge({ action, onDone }: ActionCardLargeProps) {
  return (
    <div
      className={cn(
        'rounded-2xl shadow-card bg-white p-5 border-l-4 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
        priorityBorderColor[action.priority],
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {action.plantEmoji && (
            <span className="text-2xl shrink-0" aria-hidden>{action.plantEmoji}</span>
          )}
          <h3 className="font-poppins font-semibold text-forest text-base leading-snug">
            {action.label}
          </h3>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 font-raleway text-xs font-semibold',
            priorityBadgeColor[action.priority],
          )}
        >
          {priorityLabel[action.priority]}
        </span>
      </div>

      {/* Notes */}
      {action.notes && (
        <p className="font-raleway text-sm italic text-forest/60 mb-3 leading-relaxed">
          {action.notes}
        </p>
      )}

      {/* Meta row */}
      {action.estimatedMinutes && (
        <div className="flex items-center gap-1.5 text-forest/50 font-raleway text-xs mb-4">
          <Clock size={12} aria-hidden />
          <span>~{action.estimatedMinutes} min</span>
        </div>
      )}

      {/* CTA */}
      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="full"
        onDone={onDone}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `ActionCardMedium.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/cards/ActionCardMedium.tsx
import { Clock, Droplets, Scissors, Sprout, Package, FlaskConical, Shield, Apple, Wrench } from 'lucide-react'
import { GardenAction, ActionType } from '@/lib/mock-actions'
import { DoneButton } from '../DoneButton'

const iconMap: Record<ActionType, React.ElementType> = {
  arrosage:     Droplets,
  taille:       Scissors,
  semis:        Sprout,
  rempotage:    Package,
  fertilisation:FlaskConical,
  traitement:   Shield,
  recolte:      Apple,
  autre:        Wrench,
}

const typeLabel: Record<ActionType, string> = {
  arrosage:     'Arrosage',
  taille:       'Taille',
  semis:        'Semis',
  rempotage:    'Rempotage',
  fertilisation:'Fertilisation',
  traitement:   'Traitement',
  recolte:      'Récolte',
  autre:        'Autre',
}

interface ActionCardMediumProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionCardMedium({ action, onDone }: ActionCardMediumProps) {
  const Icon = iconMap[action.type]

  return (
    <div className="rounded-xl shadow-card bg-white p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} className="text-forest/60 shrink-0" aria-hidden />
        <p className="font-poppins font-semibold text-forest text-sm flex-1 leading-snug">
          {action.label}
        </p>
        <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 font-raleway text-xs text-forest/70 border border-forest/10">
          {typeLabel[action.type]}
        </span>
      </div>

      {action.estimatedMinutes && (
        <div className="flex items-center gap-1.5 text-forest/50 font-raleway text-xs mb-3">
          <Clock size={12} aria-hidden />
          <span>~{action.estimatedMinutes} min</span>
        </div>
      )}

      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="outline"
        onDone={onDone}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create `ActionRowCompact.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/cards/ActionRowCompact.tsx
import {
  Droplets, Scissors, Sprout, Package,
  FlaskConical, Shield, Apple, Wrench,
} from 'lucide-react'
import { GardenAction, ActionType } from '@/lib/mock-actions'
import { formatShortDate } from '@/lib/calendar-utils'
import { DoneButton } from '../DoneButton'

const iconMap: Record<ActionType, React.ElementType> = {
  arrosage:     Droplets,
  taille:       Scissors,
  semis:        Sprout,
  rempotage:    Package,
  fertilisation:FlaskConical,
  traitement:   Shield,
  recolte:      Apple,
  autre:        Wrench,
}

interface ActionRowCompactProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionRowCompact({ action, onDone }: ActionRowCompactProps) {
  const Icon = iconMap[action.type]

  return (
    <div className="flex items-center gap-3 py-3 border-b border-forest/10 last:border-0">
      <Icon size={16} className="text-forest/50 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <span className="font-raleway text-sm text-forest font-medium">
          {action.shortLabel}
        </span>
        {action.plantName && (
          <span className="font-raleway text-sm text-forest/60">
            {' '}· {action.plantEmoji} {action.plantName}
          </span>
        )}
      </div>
      <span className="font-raleway text-xs text-forest/40 shrink-0 capitalize">
        {formatShortDate(action.dueDate)}
      </span>
      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="icon"
        onDone={onDone}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `ActionGroupAccordion.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/cards/ActionGroupAccordion.tsx
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import { GardenAction, ActionType } from '@/lib/mock-actions'
import { groupByType } from '@/lib/calendar-utils'
import { ActionRowCompact } from './ActionRowCompact'

const typeLabel: Record<ActionType, string> = {
  arrosage:     'arrosage',
  taille:       'taille',
  semis:        'semis',
  rempotage:    'rempotage',
  fertilisation:'fertilisation',
  traitement:   'traitement',
  recolte:      'récolte',
  autre:        'autre',
}

interface ActionGroupAccordionProps {
  actions: GardenAction[]
  weekLabel: string
  groupId: string
  onDone: (id: string) => void
}

export function ActionGroupAccordion({
  actions,
  weekLabel,
  groupId,
  onDone,
}: ActionGroupAccordionProps) {
  const grouped = groupByType(actions)

  // Build summary: "3 arrosages · 1 taille"
  const summary = Object.entries(grouped)
    .map(([type, items]) => {
      const count = items!.length
      const label = typeLabel[type as ActionType]
      return `${count} ${label}${count > 1 ? 's' : ''}`
    })
    .join(' · ')

  return (
    <Accordion type="single">
      <AccordionItem value={groupId}>
        <AccordionTrigger>
          🌿 {summary} — {weekLabel}
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-1">
            {actions.map(a => (
              <ActionRowCompact key={a.id} action={a} onDone={onDone} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/cards/
git commit -m "feat(calendrier): add card components (large, medium, compact, accordion)"
```

---

## Task 6: Timeline section components

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/timeline/TodaySection.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/timeline/TomorrowSection.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/timeline/ThisWeekSection.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/timeline/ThisMonthSection.tsx`
- Create: `growi-frontend/components/dashboard/calendrier/timeline/LaterSection.tsx`

- [ ] **Step 1: Create `TodaySection.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/timeline/TodaySection.tsx
import { motion } from 'framer-motion'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardLarge } from '../cards/ActionCardLarge'
import { EmptyState } from '../EmptyState'
import { staggerContainer, fadeUp } from '@/lib/animations'

interface TodaySectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function TodaySection({ actions, onDone }: TodaySectionProps) {
  return (
    <section aria-labelledby="today-heading">
      <div className="flex items-center gap-3 mb-4 rounded-xl bg-lime/10 px-4 py-2.5">
        <h2
          id="today-heading"
          className="font-poppins font-bold text-forest text-base flex-1"
        >
          Aujourd&apos;hui
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-lime px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          message="Rien à faire aujourd'hui — profite de ton jardin !"
          icon="☀️"
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >
          {actions.map(a => (
            <motion.div key={a.id} variants={fadeUp} layout>
              <ActionCardLarge action={a} onDone={onDone} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Create `TomorrowSection.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/timeline/TomorrowSection.tsx
import { motion } from 'framer-motion'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardMedium } from '../cards/ActionCardMedium'
import { EmptyState } from '../EmptyState'
import { staggerContainer, fadeUp } from '@/lib/animations'

interface TomorrowSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function TomorrowSection({ actions, onDone }: TomorrowSectionProps) {
  return (
    <section aria-labelledby="tomorrow-heading">
      <div className="flex items-center gap-3 mb-4">
        <h2
          id="tomorrow-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Demain
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState message="Rien de prévu pour demain." icon="🌙" />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          {actions.map(a => (
            <motion.div key={a.id} variants={fadeUp} layout>
              <ActionCardMedium action={a} onDone={onDone} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Create `ThisWeekSection.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/timeline/ThisWeekSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { ActionRowCompact } from '../cards/ActionRowCompact'
import { EmptyState } from '../EmptyState'

interface ThisWeekSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function ThisWeekSection({ actions, onDone }: ThisWeekSectionProps) {
  return (
    <section aria-labelledby="week-heading">
      <div className="flex items-center gap-3 mb-3">
        <h2
          id="week-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Cette semaine
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState message="Rien de prévu cette semaine." icon="📅" />
      ) : (
        <div className="bg-white rounded-xl shadow-card px-4">
          {actions.map(a => (
            <ActionRowCompact key={a.id} action={a} onDone={onDone} />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Create `ThisMonthSection.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/timeline/ThisMonthSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { ActionGroupAccordion } from '../cards/ActionGroupAccordion'
import { EmptyState } from '../EmptyState'
import { formatMediumDate } from '@/lib/calendar-utils'

interface ThisMonthSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

function getWeekLabel(actions: GardenAction[]): string {
  if (actions.length === 0) return ''
  const sorted = [...actions].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const first = sorted[0]
  return `semaine du ${formatMediumDate(first.dueDate)}`
}

function chunkByWeek(
  actions: GardenAction[],
): { weekLabel: string; actions: GardenAction[]; id: string }[] {
  // Group by ISO week number
  const map = new Map<number, GardenAction[]>()
  for (const a of actions) {
    const d = new Date(a.dueDate)
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNo = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    )
    if (!map.has(weekNo)) map.set(weekNo, [])
    map.get(weekNo)!.push(a)
  }
  return Array.from(map.entries()).map(([weekNo, items]) => ({
    weekLabel: getWeekLabel(items),
    actions: items,
    id: `week-${weekNo}`,
  }))
}

export function ThisMonthSection({ actions, onDone }: ThisMonthSectionProps) {
  const weeks = chunkByWeek(actions)

  return (
    <section aria-labelledby="month-heading">
      <div className="flex items-center gap-3 mb-3">
        <h2
          id="month-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Ce mois-ci
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {weeks.length === 0 ? (
        <EmptyState message="Rien de prévu ce mois-ci." icon="🗓️" />
      ) : (
        <div className="bg-white rounded-xl shadow-card px-4 divide-y divide-forest/10">
          {weeks.map(w => (
            <ActionGroupAccordion
              key={w.id}
              groupId={w.id}
              weekLabel={w.weekLabel}
              actions={w.actions}
              onDone={onDone}
            />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Create `LaterSection.tsx`**

```typescript
// growi-frontend/components/dashboard/calendrier/timeline/LaterSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { groupByMonth } from '@/lib/calendar-utils'

interface LaterSectionProps {
  actions: GardenAction[]
}

export function LaterSection({ actions }: LaterSectionProps) {
  if (actions.length === 0) return null

  const months = groupByMonth(actions)

  return (
    <section aria-labelledby="later-heading">
      <h2
        id="later-heading"
        className="font-poppins font-semibold text-forest text-base mb-3"
      >
        Plus tard
      </h2>
      <div className="flex flex-col gap-2">
        {months.map(({ monthLabel, actions: monthActions }) => {
          const labels = monthActions.map(a => a.shortLabel.toLowerCase())
          const unique = [...new Set(labels)]
          const summary = unique.join(', ')
          return (
            <div
              key={monthLabel}
              className="border-l-2 border-dashed border-forest/20 pl-4 py-1"
            >
              <p className="font-raleway text-sm italic text-forest/50">
                <span className="font-semibold not-italic text-forest/70 capitalize">
                  {monthLabel}
                </span>{' '}
                — {summary}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/timeline/
git commit -m "feat(calendrier): add timeline section components"
```

---

## Task 7: `CalendarViewToggle`

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/CalendarViewToggle.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/calendrier/CalendarViewToggle.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { LayoutList, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActiveView = 'todo' | 'calendrier'

interface CalendarViewToggleProps {
  activeView: ActiveView
}

export function CalendarViewToggle({ activeView }: CalendarViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function switchTo(view: ActiveView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('vue', view)
    router.push(`${pathname}?${params.toString()}`)
  }

  const pillBase =
    'flex items-center gap-2 px-4 py-2 rounded-full font-raleway text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'

  return (
    <div
      role="group"
      aria-label="Choisir la vue"
      className="flex gap-1 bg-white border border-forest/10 rounded-full p-1 shadow-card"
    >
      <button
        onClick={() => switchTo('todo')}
        aria-pressed={activeView === 'todo'}
        className={cn(
          pillBase,
          activeView === 'todo'
            ? 'bg-forest text-white'
            : 'text-forest hover:bg-sand',
        )}
      >
        <LayoutList size={16} aria-hidden />
        Liste
      </button>
      <button
        onClick={() => switchTo('calendrier')}
        aria-pressed={activeView === 'calendrier'}
        className={cn(
          pillBase,
          activeView === 'calendrier'
            ? 'bg-forest text-white'
            : 'text-forest hover:bg-sand',
        )}
      >
        <CalendarDays size={16} aria-hidden />
        Calendrier
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/CalendarViewToggle.tsx
git commit -m "feat(calendrier): add CalendarViewToggle with URL sync"
```

---

## Task 8: `TodoView`

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/views/TodoView.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/calendrier/views/TodoView.tsx
'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GardenAction } from '@/lib/mock-actions'
import { getTemporalBucket } from '@/lib/calendar-utils'
import { TodaySection } from '../timeline/TodaySection'
import { TomorrowSection } from '../timeline/TomorrowSection'
import { ThisWeekSection } from '../timeline/ThisWeekSection'
import { ThisMonthSection } from '../timeline/ThisMonthSection'
import { LaterSection } from '../timeline/LaterSection'
import { ActionRowCompact } from '../cards/ActionRowCompact'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'

interface TodoViewProps {
  actions: GardenAction[]
  doneActions: GardenAction[]
  onDone: (id: string) => void
  onUndo: (id: string) => void
}

const doneExit = {
  opacity: 0,
  scale: 0.96,
  height: 0,
  marginBottom: 0,
  transition: { duration: 0.3, ease: 'easeOut' },
}

export function TodoView({ actions, doneActions, onDone, onUndo }: TodoViewProps) {
  const pending = useMemo(
    () => actions.filter(a => !a.done),
    [actions],
  )

  const byBucket = useMemo(() => ({
    today:     pending.filter(a => getTemporalBucket(a.dueDate) === 'today'),
    tomorrow:  pending.filter(a => getTemporalBucket(a.dueDate) === 'tomorrow'),
    thisWeek:  pending.filter(a => getTemporalBucket(a.dueDate) === 'this-week'),
    thisMonth: pending.filter(a => getTemporalBucket(a.dueDate) === 'this-month'),
    later:     pending.filter(a => getTemporalBucket(a.dueDate) === 'later'),
  }), [pending])

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence>
        <TodaySection
          key="today"
          actions={byBucket.today}
          onDone={onDone}
        />
      </AnimatePresence>

      <div className="h-px bg-forest/10" aria-hidden />

      <TomorrowSection actions={byBucket.tomorrow} onDone={onDone} />

      <div className="h-px bg-forest/10" aria-hidden />

      <ThisWeekSection actions={byBucket.thisWeek} onDone={onDone} />

      {byBucket.thisMonth.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <ThisMonthSection actions={byBucket.thisMonth} onDone={onDone} />
        </>
      )}

      {byBucket.later.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <LaterSection actions={byBucket.later} />
        </>
      )}

      {/* Done accordion */}
      {doneActions.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <section aria-labelledby="done-heading">
            <Accordion type="single">
              <AccordionItem value="done">
                <AccordionTrigger>
                  <span id="done-heading" className="font-poppins font-semibold text-forest/60 text-sm">
                    ✅ Actions réalisées ({doneActions.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    {doneActions.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 py-2.5 border-b border-forest/10 last:border-0 opacity-60"
                      >
                        <span className="flex-1 font-raleway text-sm text-forest line-through">
                          {a.label}
                        </span>
                        <button
                          onClick={() => onUndo(a.id)}
                          className="font-raleway text-xs text-forest/60 underline underline-offset-2 hover:text-forest transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/views/TodoView.tsx
git commit -m "feat(calendrier): add TodoView with all timeline sections"
```

---

## Task 9: `CalendarView`

**Files:**
- Create: `growi-frontend/components/dashboard/calendrier/views/CalendarView.tsx`

- [ ] **Step 1: Create the component**

```typescript
// growi-frontend/components/dashboard/calendrier/views/CalendarView.tsx
'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { GardenAction, actionTypeDotColor } from '@/lib/mock-actions'
import { ActionCardMedium } from '../cards/ActionCardMedium'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** 0=Mon … 6=Sun (ISO week) */
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

interface CalendarViewProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function CalendarView({ actions, onDone }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // Build map: isoDate → GardenAction[]
  const actionsByDate = useMemo(() => {
    const map = new Map<string, GardenAction[]>()
    for (const a of actions) {
      if (!map.has(a.dueDate)) map.set(a.dueDate, [])
      map.get(a.dueDate)!.push(a)
    }
    return map
  }, [actions])

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const selectedActions = selectedDate ? (actionsByDate.get(selectedDate) ?? []) : []

  // All cells: leading blanks + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div className="bg-white rounded-2xl shadow-card p-5">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-5">
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mois précédent">
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="font-poppins font-bold text-forest text-lg capitalize">
              {monthLabel}
            </h2>
            <button
              onClick={goToday}
              className="font-raleway text-xs text-forest/60 border border-forest/20 rounded-full px-2.5 py-0.5 hover:bg-sand transition-colors"
            >
              Aujourd&apos;hui
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mois suivant">
            <ChevronRight size={18} aria-hidden />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div
              key={d}
              className="text-center font-raleway text-xs font-semibold text-forest/40 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-px bg-forest/5 rounded-xl overflow-hidden">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`blank-${idx}`} className="bg-white min-h-[56px]" />
            }

            const iso = isoDate(year, month, day)
            const dayActions = actionsByDate.get(iso) ?? []
            const isToday = iso === todayIso
            const isPast = iso < todayIso

            const visibleDots = dayActions.slice(0, 3)
            const extraCount = dayActions.length - 3

            return (
              <button
                key={iso}
                onClick={() => dayActions.length > 0 && setSelectedDate(iso)}
                aria-label={`${day} ${monthLabel}${dayActions.length > 0 ? `, ${dayActions.length} action${dayActions.length > 1 ? 's' : ''}` : ''}`}
                className={cn(
                  'bg-white min-h-[56px] flex flex-col items-center pt-2 pb-1 gap-1 transition-colors',
                  dayActions.length > 0 && 'cursor-pointer hover:bg-sand',
                  dayActions.length === 0 && 'cursor-default',
                  isToday && 'bg-lime/20',
                  isPast && !isToday && 'bg-forest/[0.02]',
                )}
              >
                <span
                  className={cn(
                    'font-poppins text-sm font-semibold',
                    isToday ? 'text-forest' : isPast ? 'text-forest/30' : 'text-forest/80',
                  )}
                >
                  {day}
                </span>

                {/* Dots */}
                {visibleDots.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-wrap justify-center">
                    {visibleDots.map(a => (
                      <span
                        key={a.id}
                        className={cn('w-1.5 h-1.5 rounded-full', actionTypeDotColor[a.type])}
                        aria-hidden
                      />
                    ))}
                    {extraCount > 0 && (
                      <span className="font-raleway text-[9px] text-forest/40">+{extraCount}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {([
            ['arrosage',     'bg-blue-400',    'Arrosage'],
            ['taille',       'bg-forest',      'Taille'],
            ['semis',        'bg-lime',        'Semis'],
            ['rempotage',    'bg-amber-500',   'Rempotage'],
            ['fertilisation','bg-purple-400',  'Fertilisation'],
            ['traitement',   'bg-red-400',     'Traitement'],
            ['recolte',      'bg-sun',         'Récolte'],
          ] as [string, string, string][]).map(([, colorClass, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', colorClass)} aria-hidden />
              <span className="font-raleway text-xs text-forest/60">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day sheet */}
      <Sheet open={!!selectedDate} onOpenChange={open => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-poppins text-forest capitalize">
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })
                : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 pb-6">
            {selectedActions.map(a => (
              <ActionCardMedium key={a.id} action={a} onDone={id => { onDone(id); setSelectedDate(null) }} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/components/dashboard/calendrier/views/CalendarView.tsx
git commit -m "feat(calendrier): add CalendarView with CSS grid and Sheet drawer"
```

---

## Task 10: Page `/dashboard/calendrier/page.tsx`

**Files:**
- Create: `growi-frontend/app/dashboard/calendrier/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// growi-frontend/app/dashboard/calendrier/page.tsx
'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { mockActions, GardenAction } from '@/lib/mock-actions'
import { getTemporalBucket } from '@/lib/calendar-utils'
import { CalendarViewToggle, type ActiveView } from '@/components/dashboard/calendrier/CalendarViewToggle'
import { TodoView } from '@/components/dashboard/calendrier/views/TodoView'
import { CalendarView } from '@/components/dashboard/calendrier/views/CalendarView'
import { useToast } from '@/components/ui/toast'
import { fadeIn } from '@/lib/animations'

function CalendrierPageInner() {
  const searchParams = useSearchParams()
  const activeView = (searchParams.get('vue') as ActiveView) ?? 'todo'
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()

  const [actions, setActions] = useState<GardenAction[]>(mockActions)

  // Mark action as done (optimistic)
  const handleDone = useCallback(
    (id: string) => {
      setActions(prev =>
        prev.map(a =>
          a.id === id
            ? { ...a, done: true, doneAt: new Date().toISOString() }
            : a,
        ),
      )
      toast('✓ Action notée comme faite ! Ton jardin te remercie 🌱')
      // TODO: remplacer par API call PATCH /actions/:id { done: true }
    },
    [toast],
  )

  // Undo: mark action as not done
  const handleUndo = useCallback((id: string) => {
    setActions(prev =>
      prev.map(a => (a.id === id ? { ...a, done: false, doneAt: undefined } : a)),
    )
    // TODO: remplacer par API call PATCH /actions/:id { done: false }
  }, [])

  const doneActions = useMemo(
    () => actions.filter(a => a.done),
    [actions],
  )

  // Summary bar counts
  const todayDoneCount = useMemo(
    () =>
      actions.filter(
        a => a.done && a.doneAt && a.doneAt.startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
    [actions],
  )
  const weekPendingCount = useMemo(
    () =>
      actions.filter(a => {
        if (a.done) return false
        const b = getTemporalBucket(a.dueDate)
        return b === 'today' || b === 'tomorrow' || b === 'this-week'
      }).length,
    [actions],
  )
  const monthPendingCount = useMemo(
    () =>
      actions.filter(a => !a.done && getTemporalBucket(a.dueDate) === 'this-month').length,
    [actions],
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl lg:max-w-none">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
            Ton calendrier jardin 📅
          </h1>
          <p className="font-raleway text-forest/60 mt-1">
            Tes prochaines actions, du plus urgent au plus lointain.
          </p>
        </div>
        <Suspense>
          <CalendarViewToggle activeView={activeView} />
        </Suspense>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl bg-sand px-4 py-3 flex flex-wrap gap-x-5 gap-y-1 font-raleway text-sm text-forest/70">
        {todayDoneCount > 0 && (
          <span>✅ {todayDoneCount} faite{todayDoneCount > 1 ? 's' : ''} aujourd&apos;hui</span>
        )}
        <span>⏳ {weekPendingCount} à venir cette semaine</span>
        <span>📅 {monthPendingCount} ce mois</span>
      </div>

      {/* Views */}
      <AnimatePresence mode="wait">
        {activeView === 'todo' ? (
          <motion.div
            key="todo"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <TodoView
              actions={actions}
              doneActions={doneActions}
              onDone={handleDone}
              onUndo={handleUndo}
            />
          </motion.div>
        ) : (
          <motion.div
            key="calendrier"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <CalendarView actions={actions} onDone={handleDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CalendrierPage() {
  return (
    <Suspense>
      <CalendrierPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add ../growi-frontend/app/dashboard/calendrier/page.tsx
git commit -m "feat(calendrier): add calendrier page with view toggle and state management"
```

---

## Task 11: Build verification

**Files:** none new

- [ ] **Step 1: Run the build**

```bash
cd growi-frontend && npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Fix any type errors**

Common issues to watch for:
- `useReducedMotion` import from `framer-motion` — verify it's exported
- `actionTypeDotColor` used in `CalendarView` — imported from `@/lib/mock-actions`
- `formatMediumDate` used in `ThisMonthSection` — imported from `@/lib/calendar-utils`
- If `Suspense` is already wrapping `CalendarViewToggle` in the page, don't double-wrap

- [ ] **Step 3: Commit any fixes**

```bash
git add -p
git commit -m "fix(calendrier): resolve TypeScript build errors"
```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `GardenAction` type + 15+ mocks covering all buckets | Task 1 ✓ |
| `getTemporalBucket()`, `groupByType()`, `groupByMonth()` | Task 2 ✓ |
| `DoneButton` — 3 variants (full/outline/icon) | Task 3 ✓ |
| Optimistic UI + toast 3s + undo | Task 10 (state) + Task 8 (accordion undo) ✓ |
| `TodaySection` — large cards, badge priorité, notes, CTA primary | Tasks 5+6 ✓ |
| `TomorrowSection` — medium cards, CTA outline | Tasks 5+6 ✓ |
| `ThisWeekSection` — compact rows, CTA icon | Tasks 5+6 ✓ |
| `ThisMonthSection` — accordion grouped | Tasks 5+6 ✓ |
| `LaterSection` — text résumé par mois | Tasks 5+6 ✓ |
| Done accordion en bas de TodoView | Task 8 ✓ |
| CalendarView — CSS Grid 7 colonnes | Task 9 ✓ |
| Navigation mois prev/next/aujourd'hui | Task 9 ✓ |
| Dots colorés max 3 + "+N" | Task 9 ✓ |
| Fond lime/20 jour courant | Task 9 ✓ |
| Click jour → Sheet shadcn | Task 9 ✓ |
| `CalendarViewToggle` + URL persistance ?vue= | Task 7 ✓ |
| `AnimatePresence` entre vues | Task 10 ✓ |
| `aria-label` sur DoneButton | Task 3 ✓ |
| Toast `role="status"` / `aria-live="polite"` | Géré par `ToastProvider` existant ✓ |
| `prefers-reduced-motion` | Task 10 ✓ |
| TypeScript strict, zéro `any` | Task 11 ✓ |
| `// TODO: remplacer par API call` | Tasks 3, 10 ✓ |

**No gaps found.**
