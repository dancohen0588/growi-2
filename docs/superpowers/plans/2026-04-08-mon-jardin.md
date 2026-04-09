# Mon Jardin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full garden map editor at `/dashboard/jardin` — drag-and-drop canvas (React-Konva), palette sidebar, compass overlay, element/config property panels, localStorage persistence, and PNG export.

**Architecture:** A `useGarden` hook centralises all state and actions; `GardenCanvas` (SSR-disabled, React-Konva) renders elements; `@dnd-kit/core` handles drag from palette to canvas; all data flows through typed models in `lib/garden/`. No real API — localStorage mock with TODO comments for replacement.

**Tech Stack:** Next.js 14 App Router, React-Konva 9, @dnd-kit/core, html2canvas, shadcn/ui (AlertDialog, Accordion), custom Tabs component, Tailwind CSS, lucide-react, sonner (not used — project uses custom `useToast`).

---

## Scope Check

This spec is one cohesive feature. All 12+ components share the same `useGarden` hook, the same types, and the same state tree. Splitting into sub-plans would require duplicating the type system across plans. One plan is appropriate.

No test suite is configured in this project (`CLAUDE.md`: "No test suite is configured yet"). TDD steps are replaced with build-verification steps (`npm run build` from `growi-frontend/`).

---

## File Map

### Create

| File | Responsibility |
|------|----------------|
| `growi-frontend/lib/garden/types.ts` | All TypeScript types for Garden feature |
| `growi-frontend/lib/garden/defaults.ts` | Default values, SOL_INFOS, ORIENTATION_TO_DEG |
| `growi-frontend/lib/garden/palette.ts` | PALETTE_CATALOG — element definitions |
| `growi-frontend/lib/garden/storage.ts` | loadGarden / saveGarden via localStorage |
| `growi-frontend/lib/garden/compute-sun.ts` | TYPE_COLORS, getSunArcPath, snapToGrid |
| `growi-frontend/lib/garden/garden-reco.ts` | generateReco — recommendation text logic |
| `growi-frontend/hooks/useGarden.ts` | Central state + all actions + persistence |
| `growi-frontend/components/ui/tabs.tsx` | Simple custom Tabs/TabsList/TabsTrigger/TabsContent |
| `growi-frontend/app/dashboard/jardin/page.tsx` | Page with dynamic import of GardenCanvas |
| `growi-frontend/components/dashboard/jardin/GardenCanvasSkeleton.tsx` | Skeleton shown while Konva loads |
| `growi-frontend/components/dashboard/jardin/GardenToolbar.tsx` | Top bar: name, save, export, clear |
| `growi-frontend/components/dashboard/jardin/GardenPalette.tsx` | Left sidebar — accordion of palette sections |
| `growi-frontend/components/dashboard/jardin/GardenPaletteSection.tsx` | Accordion section wrapper |
| `growi-frontend/components/dashboard/jardin/GardenPaletteItem.tsx` | Draggable palette item (@dnd-kit useDraggable) |
| `growi-frontend/components/dashboard/jardin/GardenCanvas.tsx` | React-Konva Stage — NO SSR — elements, transformer, drop |
| `growi-frontend/components/dashboard/jardin/GardenCompass.tsx` | HTML overlay compass widget |
| `growi-frontend/components/dashboard/jardin/GardenRightPanel.tsx` | Right panel with Tabs: Élément + Jardin |
| `growi-frontend/components/dashboard/jardin/GardenPropsTab.tsx` | Element properties tab content |
| `growi-frontend/components/dashboard/jardin/GardenConfigTab.tsx` | Garden config tab content |
| `growi-frontend/components/dashboard/jardin/GardenStatsBar.tsx` | Floating stats badge (plantes / arbres / zones) |
| `growi-frontend/components/dashboard/jardin/GardenZoomControls.tsx` | Zoom +/−/reset bar |
| `growi-frontend/components/dashboard/jardin/GardenEmptyState.tsx` | Shown when canvas has no elements |

### Modify

| File | Change |
|------|--------|
| `growi-frontend/components/dashboard/DashboardNav.tsx` | Add "Mon Jardin" nav item with Map icon |
| `growi-frontend/app/dashboard/page.tsx` | Add Mon Jardin FeatureCard |
| `growi-frontend/package.json` | Add konva, react-konva, @dnd-kit/core, @dnd-kit/utilities, html2canvas + types |

---

## Task 1: Install dependencies

**Files:**
- Modify: `growi-frontend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd growi-frontend
npm install konva react-konva @dnd-kit/core @dnd-kit/utilities html2canvas
npm install --save-dev @types/html2canvas
```

> Note: `@types/html2canvas` may not exist — html2canvas ships its own types. If install fails with `@types/html2canvas`, skip it.

- [ ] **Step 2: Verify imports resolve**

```bash
cd growi-frontend
node -e "require('konva'); require('html2canvas'); console.log('OK')" 2>/dev/null || echo "check package.json"
```

Expected: `OK` or a DOM error (fine — we're in Node, not browser). The key is no "Cannot find module" error.

- [ ] **Step 3: Commit**

```bash
cd growi-frontend
git add package.json package-lock.json
git commit -m "feat(jardin): install konva, react-konva, dnd-kit, html2canvas"
```

---

## Task 2: Garden data layer

**Files:**
- Create: `growi-frontend/lib/garden/types.ts`
- Create: `growi-frontend/lib/garden/defaults.ts`
- Create: `growi-frontend/lib/garden/palette.ts`
- Create: `growi-frontend/lib/garden/storage.ts`
- Create: `growi-frontend/lib/garden/compute-sun.ts`
- Create: `growi-frontend/lib/garden/garden-reco.ts`

- [ ] **Step 1: Create `lib/garden/types.ts`**

```typescript
// growi-frontend/lib/garden/types.ts

export type GardenElementType =
  | 'mur' | 'portail' | 'bordure' | 'cloture' | 'abri' | 'terrasse'
  | 'massif' | 'pelouse' | 'potager' | 'serre' | 'allee' | 'rocaille'
  | 'plante' | 'arbre'
  | 'eau' | 'fontaine' | 'mare'
  | 'deco' | 'compost' | 'eclairage' | 'station-meteo' | 'pergola'

export type ElementSun = 'full' | 'half' | 'shade'

export type SolType =
  | 'argileux' | 'sableux' | 'limoneux' | 'calcaire' | 'tourbeux' | 'fertile'

export type SlopeDirection = 'N' | 'S' | 'E' | 'O'

export type ClimateZone =
  | 'oceanique' | 'continental' | 'mediterr' | 'montagne'

export type MicroClimat =
  | 'abrite' | 'vente' | 'humide' | 'sec' | 'gel' | 'urban'

export type GardenOrientation = 'S' | 'N' | 'E' | 'O' | 'SE' | 'SO' | 'NE' | 'NO'

export interface GardenElement {
  id: string
  type: GardenElementType
  emoji: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  sun: ElementSun
  customColor?: string
  customBorder?: string
  notes?: string
  linkedPlantId?: string
}

export interface GardenConfig {
  orientation: GardenOrientation
  compassDeg: number
  solType: SolType
  slopeDeg: number
  slopeDirection: SlopeDirection
  microclimats: MicroClimat[]
  widthMeters: number
  heightMeters: number
  climateZone: ClimateZone
}

export interface Garden {
  id: string
  name: string
  elements: GardenElement[]
  config: GardenConfig
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Create `lib/garden/defaults.ts`**

```typescript
// growi-frontend/lib/garden/defaults.ts
import type { GardenConfig, Garden, SolType, GardenOrientation } from './types'

export const DEFAULT_GARDEN_CONFIG: GardenConfig = {
  orientation: 'S',
  compassDeg: 180,
  solType: 'argileux',
  slopeDeg: 0,
  slopeDirection: 'N',
  microclimats: [],
  widthMeters: 10,
  heightMeters: 15,
  climateZone: 'oceanique',
}

export const DEFAULT_GARDEN: Garden = {
  id: 'main',
  name: 'Mon jardin',
  elements: [],
  config: DEFAULT_GARDEN_CONFIG,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const SOL_INFOS: Record<SolType, string> = {
  argileux: "🌱 Retient bien l'eau · pH neutre à basique",
  sableux:  '🏜️ Drainage rapide · Réchauffe vite · Pauvre en nutriments',
  limoneux: '🌾 Bon équilibre eau/air · Fertile · Idéal légumes',
  calcaire: '⛰️ Drainant · pH basique · Riche en calcium',
  tourbeux: "💧 Très acide · Retient l'eau · Riche en M.O.",
  fertile:  '🌱 Idéal · Équilibré · Convient à toutes cultures',
}

export const ORIENTATION_TO_DEG: Record<GardenOrientation, number> = {
  S: 180, N: 0, E: 90, O: 270,
  SE: 135, SO: 225, NE: 45, NO: 315,
}

export const ORIENTATION_LABELS: Record<GardenOrientation, string> = {
  S: 'Façade Sud', N: 'Façade Nord', E: 'Est', O: 'Ouest',
  SE: 'Sud-Est', SO: 'Sud-Ouest', NE: 'Nord-Est', NO: 'Nord-Ouest',
}
```

- [ ] **Step 3: Create `lib/garden/palette.ts`**

```typescript
// growi-frontend/lib/garden/palette.ts
import type { GardenElementType } from './types'

export interface PaletteItem {
  type: GardenElementType
  emoji: string
  label: string
  defaultWidth: number
  defaultHeight: number
  isCircular?: boolean
}

export const PALETTE_CATALOG: Record<string, PaletteItem[]> = {
  'Structures': [
    { type: 'mur',      emoji: '🧱', label: 'Mur',       defaultWidth: 120, defaultHeight: 36 },
    { type: 'portail',  emoji: '🚪', label: 'Portail',   defaultWidth: 80,  defaultHeight: 50 },
    { type: 'bordure',  emoji: '〰️', label: 'Bordure',   defaultWidth: 120, defaultHeight: 28 },
    { type: 'cloture',  emoji: '🪵', label: 'Clôture',   defaultWidth: 120, defaultHeight: 36 },
    { type: 'terrasse', emoji: '🪨', label: 'Terrasse',  defaultWidth: 160, defaultHeight: 120 },
    { type: 'abri',     emoji: '🏠', label: 'Abri',      defaultWidth: 100, defaultHeight: 100 },
  ],
  'Zones': [
    { type: 'pelouse',  emoji: '🟩', label: 'Pelouse',   defaultWidth: 180, defaultHeight: 140 },
    { type: 'massif',   emoji: '🌸', label: 'Massif',    defaultWidth: 160, defaultHeight: 120 },
    { type: 'potager',  emoji: '🥕', label: 'Potager',   defaultWidth: 160, defaultHeight: 120 },
    { type: 'serre',    emoji: '🏡', label: 'Serre',     defaultWidth: 140, defaultHeight: 100 },
    { type: 'allee',    emoji: '🟫', label: 'Allée',     defaultWidth: 60,  defaultHeight: 160 },
    { type: 'rocaille', emoji: '🌵', label: 'Rocaille',  defaultWidth: 120, defaultHeight: 100 },
  ],
  'Plantes': [
    { type: 'plante', emoji: '🌹', label: 'Rosier',    defaultWidth: 60, defaultHeight: 60, isCircular: true },
    { type: 'plante', emoji: '🌻', label: 'Tournesol', defaultWidth: 60, defaultHeight: 60, isCircular: true },
    { type: 'plante', emoji: '🌿', label: 'Basilic',   defaultWidth: 50, defaultHeight: 50, isCircular: true },
    { type: 'plante', emoji: '🍅', label: 'Tomate',    defaultWidth: 60, defaultHeight: 60, isCircular: true },
    { type: 'plante', emoji: '🫐', label: 'Myrtille',  defaultWidth: 60, defaultHeight: 60, isCircular: true },
    { type: 'plante', emoji: '🌾', label: 'Graminée',  defaultWidth: 50, defaultHeight: 60, isCircular: true },
    { type: 'plante', emoji: '🌷', label: 'Tulipe',    defaultWidth: 50, defaultHeight: 50, isCircular: true },
    { type: 'plante', emoji: '🎍', label: 'Bambou',    defaultWidth: 50, defaultHeight: 80, isCircular: false },
  ],
  'Arbres': [
    { type: 'arbre', emoji: '🌳', label: 'Arbre',    defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🌲', label: 'Conifère', defaultWidth: 70, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🍎', label: 'Pommier',  defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🍒', label: 'Cerisier', defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🫒', label: 'Olivier',  defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🌴', label: 'Palmier',  defaultWidth: 70, defaultHeight: 90, isCircular: true },
  ],
  'Eau & Équipements': [
    { type: 'fontaine',      emoji: '⛲', label: 'Fontaine',      defaultWidth: 80,  defaultHeight: 80,  isCircular: true },
    { type: 'mare',          emoji: '🏊', label: 'Mare',          defaultWidth: 100, defaultHeight: 80,  isCircular: true },
    { type: 'compost',       emoji: '♻️', label: 'Compost',       defaultWidth: 60,  defaultHeight: 60  },
    { type: 'eclairage',     emoji: '💡', label: 'Éclairage',     defaultWidth: 40,  defaultHeight: 40  },
    { type: 'station-meteo', emoji: '🌡️', label: 'Station météo', defaultWidth: 40,  defaultHeight: 50  },
    { type: 'pergola',       emoji: '🪴', label: 'Pergola',       defaultWidth: 140, defaultHeight: 100 },
  ],
}
```

- [ ] **Step 4: Create `lib/garden/storage.ts`**

```typescript
// growi-frontend/lib/garden/storage.ts
import type { Garden } from './types'

const STORAGE_KEY = 'growi_garden_v1'

export function saveGarden(garden: Garden): void {
  try {
    const updated = { ...garden, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    console.warn('[Growi] Impossible de sauvegarder le jardin dans localStorage')
  }
}

export function loadGarden(): Garden | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Garden) : null
  } catch {
    return null
  }
}

// TODO: Replace with API calls:
// POST /api/garden  → saveGarden
// GET  /api/garden  → loadGarden
```

- [ ] **Step 5: Create `lib/garden/compute-sun.ts`**

```typescript
// growi-frontend/lib/garden/compute-sun.ts
import type { GardenElementType } from './types'

export const TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  mur:           { fill: 'rgba(180,221,127,.28)', stroke: '#5a8a4a' },
  portail:       { fill: 'rgba(246,196,69,.30)',  stroke: '#c49a10' },
  bordure:       { fill: 'rgba(30,86,49,.10)',    stroke: '#2d7a47' },
  cloture:       { fill: 'rgba(180,221,127,.22)', stroke: '#5a8a4a' },
  terrasse:      { fill: 'rgba(222,184,135,.30)', stroke: '#b8925a' },
  abri:          { fill: 'rgba(246,196,69,.22)',  stroke: '#c49a10' },
  massif:        { fill: 'rgba(180,221,127,.18)', stroke: '#8aaa7b' },
  pelouse:       { fill: 'rgba(144,238,144,.28)', stroke: '#5a8a4a' },
  potager:       { fill: 'rgba(180,221,127,.20)', stroke: '#8aaa7b' },
  serre:         { fill: 'rgba(200,240,200,.35)', stroke: '#4a9a5a' },
  allee:         { fill: 'rgba(222,184,135,.22)', stroke: '#b8925a' },
  rocaille:      { fill: 'rgba(180,180,170,.30)', stroke: '#888880' },
  plante:        { fill: 'rgba(180,221,127,.22)', stroke: '#a2cf6b' },
  arbre:         { fill: 'rgba(30,86,49,.14)',    stroke: '#1E5631' },
  eau:           { fill: 'rgba(135,206,235,.30)', stroke: '#5ab4d1' },
  fontaine:      { fill: 'rgba(135,206,235,.30)', stroke: '#5ab4d1' },
  mare:          { fill: 'rgba(100,180,230,.28)', stroke: '#3a90c0' },
  deco:          { fill: 'rgba(246,196,69,.22)',  stroke: '#c49a10' },
  compost:       { fill: 'rgba(139,94,60,.18)',   stroke: '#6b4e2a' },
  eclairage:     { fill: 'rgba(246,196,69,.30)',  stroke: '#c49a10' },
  'station-meteo':{ fill: 'rgba(246,196,69,.22)', stroke: '#c49a10' },
  pergola:       { fill: 'rgba(180,221,127,.18)', stroke: '#8aaa7b' },
}

export function getTypeColors(type: GardenElementType): { fill: string; stroke: string } {
  return TYPE_COLORS[type] ?? { fill: 'rgba(180,221,127,.20)', stroke: '#5a8a4a' }
}

export function snapToGrid(value: number, gridSize = 20): number {
  return Math.round(value / gridSize) * gridSize
}

export function getSunArcPath(compassDeg: number): { d: string; sunDirection: string } {
  const r = 36, cx = 44, cy = 44
  const toRad = (d: number) => (d - 90) * Math.PI / 180
  const sunDeg = compassDeg
  const x1 = cx + r * Math.cos(toRad(sunDeg - 50))
  const y1 = cy + r * Math.sin(toRad(sunDeg - 50))
  const x2 = cx + r * Math.cos(toRad(sunDeg + 50))
  const y2 = cy + r * Math.sin(toRad(sunDeg + 50))
  const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}`
  const dirs: Array<[string, number, number]> = [
    ['Nord',   315, 405],
    ['Est',     45, 135],
    ['Sud',    135, 225],
    ['Ouest',  225, 315],
  ]
  const normalized = ((compassDeg % 360) + 360) % 360
  const sunSide = dirs.find(([, a, b]) => {
    const na = ((a % 360) + 360) % 360
    const nb = ((b % 360) + 360) % 360
    if (na < nb) return normalized >= na && normalized < nb
    return normalized >= na || normalized < nb
  })?.[0] ?? 'Sud'
  return { d, sunDirection: sunSide }
}
```

- [ ] **Step 6: Create `lib/garden/garden-reco.ts`**

```typescript
// growi-frontend/lib/garden/garden-reco.ts
import type { GardenConfig } from './types'

export function generateReco(config: GardenConfig): string {
  const { orientation, solType, slopeDeg, microclimats, climateZone } = config
  let reco = ''

  if (['S', 'SE', 'SO'].includes(orientation))
    reco += 'Excellente exposition — parfait pour les légumes gourmands en soleil (tomates, poivrons, courgettes). '
  else if (orientation === 'N')
    reco += "Exposition Nord : privilégie les plantes d'ombre — fougères, hostas, impatiens. "
  else
    reco += 'Belle orientation latérale — idéale pour rosiers et légumes semi-ombragés. '

  if (solType === 'argileux') reco += "Sol argileux : surélève tes rangs pour éviter l'engorgement. "
  if (solType === 'sableux')  reco += 'Sol sableux : arrose plus souvent et amende généreusement avec du compost. '
  if (solType === 'calcaire') reco += "Sol calcaire : myrtilles et rhododendrons ne s'y plairont pas — préfère l'acidophile en pot. "
  if (solType === 'fertile')  reco += 'Sol fertile : toutes cultures sont envisageables — tu as de la chance ! '

  if (climateZone === 'mediterr') reco += "Climat méditerranéen : mise sur lavande, romarin et tomates. Arrosage goutte-à-goutte recommandé. "
  if (climateZone === 'montagne') reco += "Altitude : saison courte — démarre tes semis sous abri et utilise des variétés précoces. "

  if (slopeDeg > 25) reco += '⚠️ Forte pente : installe des terrasses en paliers pour limiter l\'érosion. '
  else if (slopeDeg > 10) reco += 'Pente modérée : des cordons de retenue entre tes rangs amélioreront le drainage. '

  if (microclimats.includes('gel'))   reco += '❄️ Risque gel : protège tes plantes fragiles avec un voile d\'hivernage. '
  if (microclimats.includes('vente')) reco += '💨 Vent dominant : installe des brise-vent naturels (bambous, haies). '
  if (microclimats.includes('sec'))   reco += "☀️ Sol sec : privilégie le paillage épais pour conserver l'humidité. "

  return (reco.trim() || 'Configure ton jardin pour obtenir des recommandations personnalisées.') + ' 🌿'
}
```

- [ ] **Step 7: Verify TypeScript compilation**

```bash
cd growi-frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `lib/garden/` files. Fix any type mismatches before continuing.

- [ ] **Step 8: Commit**

```bash
cd growi-frontend
git add lib/garden/
git commit -m "feat(jardin): add garden data layer — types, defaults, palette, storage, compute-sun, reco"
```

---

## Task 3: `useGarden` hook

**Files:**
- Create: `growi-frontend/hooks/useGarden.ts`

- [ ] **Step 1: Create `hooks/useGarden.ts`**

```typescript
// growi-frontend/hooks/useGarden.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Garden, GardenElement, GardenConfig } from '@/lib/garden/types'
import type { PaletteItem } from '@/lib/garden/palette'
import { DEFAULT_GARDEN } from '@/lib/garden/defaults'
import { loadGarden, saveGarden as persistGarden } from '@/lib/garden/storage'
import { snapToGrid } from '@/lib/garden/compute-sun'

export interface UseGardenReturn {
  garden: Garden
  selectedId: string | null
  zoom: number
  isSaving: boolean

  selectElement: (id: string | null) => void
  selectedElement: GardenElement | null

  addElement: (item: PaletteItem, x: number, y: number) => void
  updateElement: (id: string, patch: Partial<GardenElement>) => void
  deleteElement: (id: string) => void
  clearCanvas: () => void

  setZoom: (zoom: number) => void
  updateConfig: (patch: Partial<GardenConfig>) => void

  saveGarden: () => void
  exportPNG: (containerId: string) => Promise<void>
}

export function useGarden(): UseGardenReturn {
  const [garden, setGarden] = useState<Garden>(DEFAULT_GARDEN)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadGarden()
    if (saved) setGarden(saved)
  }, [])

  // Auto-save with debounce on every garden change
  const scheduleAutoSave = useCallback((updated: Garden) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      persistGarden(updated)
    }, 1500)
  }, [])

  const updateGarden = useCallback((updater: (prev: Garden) => Garden) => {
    setGarden(prev => {
      const next = updater({ ...prev, updatedAt: new Date().toISOString() })
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave])

  const selectElement = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const selectedElement = garden.elements.find(e => e.id === selectedId) ?? null

  const addElement = useCallback((item: PaletteItem, x: number, y: number) => {
    const newEl: GardenElement = {
      id: crypto.randomUUID(),
      type: item.type,
      emoji: item.emoji,
      label: item.label,
      x: snapToGrid(x),
      y: snapToGrid(y),
      width: item.defaultWidth,
      height: item.defaultHeight,
      rotation: 0,
      sun: 'full',
    }
    updateGarden(prev => ({ ...prev, elements: [...prev.elements, newEl] }))
    setSelectedId(newEl.id)
  }, [updateGarden])

  const updateElement = useCallback((id: string, patch: Partial<GardenElement>) => {
    updateGarden(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el),
    }))
  }, [updateGarden])

  const deleteElement = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : prev)
    updateGarden(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
    }))
  }, [updateGarden])

  const clearCanvas = useCallback(() => {
    setSelectedId(null)
    updateGarden(prev => ({ ...prev, elements: [] }))
  }, [updateGarden])

  const updateConfig = useCallback((patch: Partial<GardenConfig>) => {
    updateGarden(prev => ({ ...prev, config: { ...prev.config, ...patch } }))
  }, [updateGarden])

  const saveGarden = useCallback(() => {
    setIsSaving(true)
    persistGarden(garden)
    setTimeout(() => setIsSaving(false), 600)
  }, [garden])

  const exportPNG = useCallback(async (containerId: string) => {
    // Dynamic import to avoid SSR issues
    const html2canvas = (await import('html2canvas')).default
    const el = document.getElementById(containerId)
    if (!el) return
    const canvas = await html2canvas(el, { backgroundColor: '#F9F7E8', scale: 2 })
    const link = document.createElement('a')
    link.download = `${garden.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [garden.name])

  return {
    garden,
    selectedId,
    zoom,
    isSaving,
    selectElement,
    selectedElement,
    addElement,
    updateElement,
    deleteElement,
    clearCanvas,
    setZoom,
    updateConfig,
    saveGarden,
    exportPNG,
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd growi-frontend
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd growi-frontend
git add hooks/useGarden.ts
git commit -m "feat(jardin): add useGarden hook with CRUD, zoom, config, persistence"
```

---

## Task 4: Tabs UI component

**Files:**
- Create: `growi-frontend/components/ui/tabs.tsx`

No shadcn Tabs exists in this project. Build a minimal custom one following the existing UI conventions.

- [ ] **Step 1: Create `components/ui/tabs.tsx`**

```typescript
// growi-frontend/components/ui/tabs.tsx
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({ value: '', onChange: () => {} })

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? value! : internal

  const onChange = React.useCallback((v: string) => {
    if (!controlled) setInternal(v)
    onValueChange?.(v)
  }, [controlled, onValueChange])

  return (
    <TabsContext.Provider value={{ value: current, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center border-b border-forest/10 bg-white',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: current, onChange } = React.useContext(TabsContext)
  const active = current === value

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onChange(value)}
      className={cn(
        'flex-1 py-2 font-raleway text-xs font-semibold transition-colors border-b-2 -mb-px',
        active
          ? 'border-forest text-forest'
          : 'border-transparent text-forest/50 hover:text-forest/80',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: current } = React.useContext(TabsContext)
  if (current !== value) return null
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd growi-frontend
git add components/ui/tabs.tsx
git commit -m "feat(ui): add minimal custom Tabs component"
```

---

## Task 5: Jardin page scaffold + GardenCanvasSkeleton

**Files:**
- Create: `growi-frontend/app/dashboard/jardin/page.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenCanvasSkeleton.tsx`

- [ ] **Step 1: Create `GardenCanvasSkeleton.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenCanvasSkeleton.tsx
export function GardenCanvasSkeleton() {
  return (
    <div className="flex-1 bg-sand animate-pulse flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 opacity-40">
        <span className="text-5xl">🌱</span>
        <p className="font-raleway text-sm text-forest">Chargement de ton jardin…</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/dashboard/jardin/page.tsx`**

```typescript
// growi-frontend/app/dashboard/jardin/page.tsx
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { GardenCanvasSkeleton } from '@/components/dashboard/jardin/GardenCanvasSkeleton'

export const metadata: Metadata = {
  title: 'Mon Jardin',
}

const GardenCanvas = dynamic(
  () => import('@/components/dashboard/jardin/GardenCanvas').then(m => ({ default: m.GardenCanvas })),
  { ssr: false, loading: () => <GardenCanvasSkeleton /> },
)

export default function JardinPage() {
  return (
    // Cancel the p-6 padding from dashboard layout so canvas fills viewport
    <div className="-m-6 -mb-24 md:-mb-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <GardenCanvas />
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd growi-frontend
npm run build 2>&1 | tail -20
```

Expected: Build passes (GardenCanvas not yet created → Next.js dynamic import with SSR:false won't fail at build if the import path doesn't exist yet, but add a placeholder). If it fails, create a temporary stub:

```typescript
// growi-frontend/components/dashboard/jardin/GardenCanvas.tsx (TEMP STUB)
'use client'
export function GardenCanvas() { return <div>Canvas</div> }
```

- [ ] **Step 4: Commit**

```bash
cd growi-frontend
git add app/dashboard/jardin/ components/dashboard/jardin/GardenCanvasSkeleton.tsx
git commit -m "feat(jardin): add jardin page scaffold with dynamic import"
```

---

## Task 6: GardenToolbar

**Files:**
- Create: `growi-frontend/components/dashboard/jardin/GardenToolbar.tsx`

- [ ] **Step 1: Create `GardenToolbar.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenToolbar.tsx
'use client'

import { useRef, useState } from 'react'
import { Save, Camera, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface GardenToolbarProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onExport: () => void
  onClear: () => void
  isSaving: boolean
}

export function GardenToolbar({ name, onNameChange, onSave, onExport, onClear, isSaving }: GardenToolbarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [clearOpen, setClearOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function commitName() {
    setEditing(false)
    const trimmed = draft.trim() || 'Mon jardin'
    setDraft(trimmed)
    onNameChange(trimmed)
  }

  function handleSave() {
    onSave()
    toast('✅ Ton jardin a été sauvegardé 🌱')
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 h-[52px] shrink-0 bg-white border-b border-forest/10">
        {/* Left: breadcrumb + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" aria-hidden>🌱</span>
          <span className="font-raleway text-xs text-forest/40 hidden sm:block shrink-0">Mon Jardin /</span>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName() }}
              className="font-poppins font-semibold text-sm text-forest bg-transparent border-0 border-b-2 border-lime focus:outline-none min-w-0 max-w-[180px]"
              aria-label="Nom du jardin"
              autoFocus
            />
          ) : (
            <button
              onDoubleClick={() => { setDraft(name); setEditing(true) }}
              className="font-poppins font-semibold text-sm text-forest hover:text-lime-hover truncate max-w-[180px]"
              title="Double-clic pour renommer"
            >
              {name}
            </button>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setClearOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs text-forest/60 hover:bg-sand hover:text-forest transition-colors"
            title="Effacer le canvas"
            aria-label="Effacer tous les éléments"
          >
            <Trash2 size={14} aria-hidden />
            <span className="hidden sm:block">Effacer</span>
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-raleway text-xs text-forest/60 hover:bg-sand hover:text-forest transition-colors"
            title="Exporter en PNG"
            aria-label="Exporter la carte en image PNG"
          >
            <Camera size={14} aria-hidden />
            <span className="hidden sm:block">Exporter</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-poppins font-semibold text-xs text-forest bg-lime hover:bg-lime-hover transition-colors',
              isSaving && 'opacity-70 cursor-not-allowed',
            )}
          >
            <Save size={14} aria-hidden />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Effacer le jardin ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les éléments seront supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setClearOpen(false)}
              className="px-4 py-2 rounded-lg font-raleway text-sm text-forest/70 hover:bg-sand transition-colors"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onClear(); setClearOpen(false) }}
              className="px-4 py-2 rounded-lg font-poppins font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Effacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd growi-frontend
git add components/dashboard/jardin/GardenToolbar.tsx
git commit -m "feat(jardin): add GardenToolbar with inline name editing, save, export, clear"
```

---

## Task 7: GardenPalette

**Files:**
- Create: `growi-frontend/components/dashboard/jardin/GardenPaletteItem.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenPaletteSection.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenPalette.tsx`

- [ ] **Step 1: Create `GardenPaletteItem.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenPaletteItem.tsx
'use client'

import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'

interface GardenPaletteItemProps {
  item: PaletteItem
}

export function GardenPaletteItem({ item }: GardenPaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}-${item.label}`,
    data: item,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={item.label}
      aria-label={`Glisser ${item.label} sur le canvas`}
      className={cn(
        'flex flex-col items-center gap-0.5 bg-sand border border-border rounded-lg p-2 cursor-grab select-none',
        'hover:border-lime hover:bg-[#f0fae0] transition-all duration-150',
        isDragging && 'opacity-50 cursor-grabbing',
      )}
    >
      <span className="text-2xl block leading-none" aria-hidden>{item.emoji}</span>
      <span className="text-[10px] font-semibold text-forest leading-tight text-center">{item.label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create `GardenPaletteSection.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenPaletteSection.tsx
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'
import { GardenPaletteItem } from './GardenPaletteItem'

interface GardenPaletteSectionProps {
  title: string
  items: PaletteItem[]
  defaultOpen?: boolean
}

export function GardenPaletteSection({ title, items, defaultOpen = true }: GardenPaletteSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-forest/10 last:border-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-sand transition-colors"
        aria-expanded={open}
      >
        <span className="font-poppins font-semibold text-[11px] text-forest uppercase tracking-wide">
          {title}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn('text-forest/40 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5 p-2">
          {items.map(item => (
            <GardenPaletteItem key={`${item.type}-${item.label}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `GardenPalette.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenPalette.tsx
'use client'

import { PALETTE_CATALOG } from '@/lib/garden/palette'
import { GardenPaletteSection } from './GardenPaletteSection'

export function GardenPalette() {
  return (
    <aside
      aria-label="Palette d'éléments"
      className="hidden md:flex flex-col w-48 shrink-0 bg-white border-r border-forest/10 overflow-y-auto"
    >
      <div className="px-3 py-2 border-b border-forest/10">
        <p className="font-poppins font-bold text-[11px] text-forest uppercase tracking-wide">
          Éléments
        </p>
        <p className="font-raleway text-[10px] text-forest/40 mt-0.5">
          Glisse sur le canvas
        </p>
      </div>
      {Object.entries(PALETTE_CATALOG).map(([title, items], i) => (
        <GardenPaletteSection
          key={title}
          title={title}
          items={items}
          defaultOpen={i === 0}
        />
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd growi-frontend
git add components/dashboard/jardin/GardenPaletteItem.tsx components/dashboard/jardin/GardenPaletteSection.tsx components/dashboard/jardin/GardenPalette.tsx
git commit -m "feat(jardin): add GardenPalette with dnd-kit draggable items"
```

---

## Task 8: GardenCanvas (React-Konva)

**Files:**
- Create: `growi-frontend/components/dashboard/jardin/GardenCanvas.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenEmptyState.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenStatsBar.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenZoomControls.tsx`

This is the largest component. It assembles everything.

- [ ] **Step 1: Create `GardenEmptyState.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenEmptyState.tsx
export function GardenEmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none motion-safe:animate-pulse">
      <span className="text-7xl opacity-20" aria-hidden>🌱</span>
      <p className="font-poppins font-semibold text-forest/30 text-sm mt-3 text-center px-4">
        Glisse un élément depuis la palette pour créer ton jardin
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create `GardenStatsBar.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenStatsBar.tsx
import type { GardenElement } from '@/lib/garden/types'

interface GardenStatsBarProps {
  elements: GardenElement[]
}

export function GardenStatsBar({ elements }: GardenStatsBarProps) {
  const plants = elements.filter(e => e.type === 'plante').length
  const trees  = elements.filter(e => e.type === 'arbre').length
  const zones  = elements.filter(e =>
    ['pelouse', 'massif', 'potager', 'serre', 'allee', 'rocaille'].includes(e.type)
  ).length

  if (elements.length === 0) return null

  return (
    <div className="absolute bottom-14 right-3 z-10 flex items-center gap-2 bg-white border border-border rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm font-raleway text-forest/70 select-none pointer-events-none">
      <span>🌺 {plants} plantes</span>
      <span className="text-forest/20">|</span>
      <span>🌳 {trees} arbres</span>
      <span className="text-forest/20">|</span>
      <span>📐 {zones} zones</span>
    </div>
  )
}
```

- [ ] **Step 3: Create `GardenZoomControls.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenZoomControls.tsx
import { cn } from '@/lib/utils'

interface GardenZoomControlsProps {
  zoom: number
  onZoom: (zoom: number) => void
}

const STEP = 0.1
const MIN = 0.4
const MAX = 2.0

export function GardenZoomControls({ zoom, onZoom }: GardenZoomControlsProps) {
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, parseFloat(v.toFixed(1))))

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0 bg-white border border-border rounded-xl shadow-sm overflow-hidden select-none">
      {[
        { label: '−', action: () => onZoom(clamp(zoom - STEP)), title: 'Zoom arrière', disabled: zoom <= MIN },
        { label: `${Math.round(zoom * 100)}%`, action: () => {}, title: 'Niveau de zoom', disabled: true, isDisplay: true },
        { label: '+', action: () => onZoom(clamp(zoom + STEP)), title: 'Zoom avant', disabled: zoom >= MAX },
        { label: '⟳', action: () => onZoom(1), title: 'Réinitialiser le zoom', disabled: false },
      ].map(({ label, action, title, disabled, isDisplay }) => (
        <button
          key={label}
          onClick={action}
          title={title}
          aria-label={title}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 font-poppins text-xs font-semibold border-r border-forest/10 last:border-0 transition-colors',
            isDisplay
              ? 'w-14 text-center text-forest/60 cursor-default'
              : 'text-forest hover:bg-sand disabled:opacity-30 disabled:cursor-not-allowed',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `GardenCanvas.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenCanvas.tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Stage, Layer, Group, Rect, Circle, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import { DndContext, useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'

import { useGarden } from '@/hooks/useGarden'
import type { GardenElement } from '@/lib/garden/types'
import type { PaletteItem } from '@/lib/garden/palette'
import { getTypeColors, snapToGrid } from '@/lib/garden/compute-sun'

import { GardenToolbar } from './GardenToolbar'
import { GardenPalette } from './GardenPalette'
import { GardenRightPanel } from './GardenRightPanel'
import { GardenCompass } from './GardenCompass'
import { GardenEmptyState } from './GardenEmptyState'
import { GardenStatsBar } from './GardenStatsBar'
import { GardenZoomControls } from './GardenZoomControls'

// ─── Single element on Konva ─────────────────────────────────────────────────

interface KonvaElementProps {
  element: GardenElement
  isSelected: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number, x: number, y: number) => void
}

function KonvaElement({ element, isSelected, onSelect, onMove, onResize }: KonvaElementProps) {
  const groupRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { fill, stroke } = getTypeColors(element.type)
  const isCircular = ['plante', 'arbre', 'fontaine', 'mare'].includes(element.type)

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const emojiSize = Math.min(element.width, element.height) * 0.45
  const cx = element.width / 2
  const cy = element.height / 2

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onMove(
      snapToGrid(e.target.x()),
      snapToGrid(e.target.y()),
    )
    e.target.x(snapToGrid(e.target.x()))
    e.target.y(snapToGrid(e.target.y()))
  }

  function handleTransformEnd() {
    const node = groupRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const newW = Math.max(40, Math.round((node.width() * scaleX) / 20) * 20)
    const newH = Math.max(40, Math.round((node.height() * scaleY) / 20) * 20)
    node.scaleX(1)
    node.scaleY(1)
    onResize(newW, newH, snapToGrid(node.x()), snapToGrid(node.y()))
  }

  const sunBadge = element.sun === 'full' ? '☀️' : element.sun === 'half' ? '⛅' : '🌿'

  return (
    <>
      <Group
        ref={groupRef}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {isCircular ? (
          <Circle
            x={cx}
            y={cy}
            radiusX={cx}
            radiusY={cy}
            fill={element.customColor ?? fill}
            stroke={element.customBorder ?? stroke}
            strokeWidth={2}
          />
        ) : (
          <Rect
            width={element.width}
            height={element.height}
            fill={element.customColor ?? fill}
            stroke={element.customBorder ?? stroke}
            strokeWidth={2}
            cornerRadius={
              isCircular ? 999
              : ['plante', 'arbre', 'fontaine', 'mare'].includes(element.type) ? 999
              : ['pelouse', 'massif', 'potager', 'serre', 'allee', 'rocaille'].includes(element.type) ? 12
              : 4
            }
          />
        )}
        {/* Emoji */}
        <Text
          text={element.emoji}
          fontSize={emojiSize}
          x={cx - emojiSize / 2}
          y={cy - emojiSize / 2}
          listening={false}
        />
        {/* Label background */}
        <Rect
          x={cx - 30}
          y={element.height - 16}
          width={60}
          height={14}
          fill="rgba(255,255,255,0.85)"
          cornerRadius={3}
          listening={false}
        />
        {/* Label text */}
        <Text
          text={element.label}
          fontSize={10}
          fill="#1E5631"
          fontFamily="Raleway, sans-serif"
          x={cx - 30}
          y={element.height - 15}
          width={60}
          align="center"
          listening={false}
        />
        {/* Sun badge */}
        <Text
          text={sunBadge}
          fontSize={12}
          x={2}
          y={2}
          listening={false}
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(40, newBox.width),
            height: Math.max(40, newBox.height),
          })}
        />
      )}
    </>
  )
}

// ─── Drop zone wrapper ────────────────────────────────────────────────────────

const CANVAS_DROPPABLE_ID = 'garden-canvas-droppable'

function CanvasDropZone({ children, onDrop }: {
  children: React.ReactNode
  onDrop: (item: PaletteItem, x: number, y: number) => void
}) {
  const { setNodeRef } = useDroppable({ id: CANVAS_DROPPABLE_ID })
  const dragPosRef = useRef({ x: 0, y: 0 })

  useDndMonitor({
    onDragMove(event) {
      const initEvent = event.activatorEvent as PointerEvent
      dragPosRef.current = {
        x: initEvent.clientX + event.delta.x,
        y: initEvent.clientY + event.delta.y,
      }
    },
    onDragEnd(event: DragEndEvent) {
      if (!event.over || event.over.id !== CANVAS_DROPPABLE_ID) return
      const item = event.active.data.current as PaletteItem
      const el = document.getElementById(CANVAS_DROPPABLE_ID)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const relX = dragPosRef.current.x - rect.left - item.defaultWidth / 2
      const relY = dragPosRef.current.y - rect.top - item.defaultHeight / 2
      onDrop(item, Math.max(0, relX), Math.max(0, relY))
    },
  })

  return (
    <div ref={setNodeRef} id={CANVAS_DROPPABLE_ID} className="flex-1 relative overflow-hidden">
      {children}
    </div>
  )
}

// ─── Grid lines layer ─────────────────────────────────────────────────────────

import { Line } from 'react-konva'

function GridLayer({ width, height, gridSize = 40 }: { width: number; height: number; gridSize?: number }) {
  const lines: React.ReactNode[] = []
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke="rgba(180,221,127,0.25)" strokeWidth={1} listening={false} />)
  }
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke="rgba(180,221,127,0.25)" strokeWidth={1} listening={false} />)
  }
  return <>{lines}</>
}

// ─── Main GardenCanvas ────────────────────────────────────────────────────────

export function GardenCanvas() {
  const garden = useGarden()
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)

  const stageW = stageContainerRef.current?.clientWidth ?? 800
  const stageH = stageContainerRef.current?.clientHeight ?? 600

  // Accessible SR table
  const srTable = (
    <table aria-hidden={false} className="sr-only" summary="Éléments dans ton jardin">
      <caption>Éléments de ton jardin</caption>
      <thead><tr><th>Nom</th><th>Type</th><th>Position X</th><th>Position Y</th></tr></thead>
      <tbody>
        {garden.garden.elements.map(el => (
          <tr key={el.id}>
            <td>{el.label}</td>
            <td>{el.type}</td>
            <td>{el.x}px</td>
            <td>{el.y}px</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const handleUpdateGarden = useCallback((name: string) => {
    garden.updateElement
    // This updates the garden name directly via a local state update
    // We need to propagate upward — useGarden doesn't expose setName directly,
    // so we add this as an updateConfig-adjacent action by patching the garden object.
    // Since useGarden exposes garden.garden, we'll just update via a workaround:
    // Add updateName to useGarden in the hook, OR use a local approach.
    // For now, use the garden's updateConfig to carry the name as a side-effect field.
    // SIMPLER: expose updateName from useGarden (add it in the hook).
  }, [garden])

  return (
    <DndContext>
      <div className="flex flex-col h-full">
        <GardenToolbar
          name={garden.garden.name}
          onNameChange={(name) => {
            // TODO: expose updateName from useGarden hook — add it in Task 3 fix
            // For now mutate via a direct approach (see step 2 below)
          }}
          onSave={garden.saveGarden}
          onExport={() => garden.exportPNG(CANVAS_DROPPABLE_ID)}
          onClear={garden.clearCanvas}
          isSaving={garden.isSaving}
        />

        <div className="flex flex-1 overflow-hidden">
          <GardenPalette />

          <CanvasDropZone onDrop={garden.addElement}>
            <div
              ref={stageContainerRef}
              className="w-full h-full"
              aria-label="Carte de ton jardin"
            >
              {srTable}

              {garden.garden.elements.length === 0 && <GardenEmptyState />}

              <Stage
                ref={stageRef}
                width={stageW}
                height={stageH}
                scaleX={garden.zoom}
                scaleY={garden.zoom}
                onClick={(e) => {
                  if (e.target === e.target.getStage()) garden.selectElement(null)
                }}
              >
                {/* Background layer */}
                <Layer>
                  <Rect width={stageW} height={stageH} fill="#F9F7E8" />
                  <GridLayer width={stageW} height={stageH} />
                </Layer>

                {/* Elements layer */}
                <Layer>
                  {garden.garden.elements.map(el => (
                    <KonvaElement
                      key={el.id}
                      element={el}
                      isSelected={garden.selectedId === el.id}
                      onSelect={() => garden.selectElement(el.id)}
                      onMove={(x, y) => garden.updateElement(el.id, { x, y })}
                      onResize={(w, h, x, y) => garden.updateElement(el.id, { width: w, height: h, x, y })}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>

            {/* Compass overlay */}
            <GardenCompass
              compassDeg={garden.garden.config.compassDeg}
              onRotate={(deg) => garden.updateConfig({ compassDeg: deg })}
            />

            <GardenStatsBar elements={garden.garden.elements} />
            <GardenZoomControls zoom={garden.zoom} onZoom={garden.setZoom} />
          </CanvasDropZone>

          <GardenRightPanel
            selectedElement={garden.selectedElement}
            onUpdateElement={(id, patch) => garden.updateElement(id, patch)}
            onDeleteElement={(id) => garden.deleteElement(id)}
            config={garden.garden.config}
            onUpdateConfig={garden.updateConfig}
          />
        </div>
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 5: Fix `useGarden` to expose `updateName`**

Open `growi-frontend/hooks/useGarden.ts` and add `updateName` to the interface and implementation:

In the `UseGardenReturn` interface, after `isSaving`:
```typescript
updateName: (name: string) => void
```

In the hook body, after `updateConfig`:
```typescript
const updateName = useCallback((name: string) => {
  updateGarden(prev => ({ ...prev, name }))
}, [updateGarden])
```

In the return object, after `updateConfig`:
```typescript
updateName,
```

Then fix the `GardenCanvas.tsx` usage in `onNameChange`:
```typescript
onNameChange={(name) => garden.updateName(name)}
```

- [ ] **Step 6: Build check**

```bash
cd growi-frontend
npm run build 2>&1 | grep -E "error|Error|warning" | head -20
```

Expected: 0 errors. Common issues and fixes:
- `'Line' is not exported from 'react-konva'` → it is; ensure version is ≥ 18.
- Konva `Circle` with `radiusX/radiusY` — the Konva Circle uses `radius`, not `radiusX/radiusY`. Fix:
  ```typescript
  // Replace Circle with Ellipse for different radii, or use a single radius
  import { Ellipse } from 'react-konva'
  // ...
  <Ellipse
    x={cx}
    y={cy}
    radiusX={cx}
    radiusY={cy}
    fill={element.customColor ?? fill}
    stroke={element.customBorder ?? stroke}
    strokeWidth={2}
  />
  ```
  Replace the `<Circle>` node in `KonvaElement` with `<Ellipse>` and add Ellipse to the react-konva imports.

- [ ] **Step 7: Commit**

```bash
cd growi-frontend
git add components/dashboard/jardin/GardenCanvas.tsx components/dashboard/jardin/GardenEmptyState.tsx components/dashboard/jardin/GardenStatsBar.tsx components/dashboard/jardin/GardenZoomControls.tsx hooks/useGarden.ts
git commit -m "feat(jardin): add GardenCanvas with Konva rendering, dnd-kit drop, transformer, zoom"
```

---

## Task 9: GardenCompass

**Files:**
- Create: `growi-frontend/components/dashboard/jardin/GardenCompass.tsx`

- [ ] **Step 1: Create `GardenCompass.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenCompass.tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getSunArcPath } from '@/lib/garden/compute-sun'

interface GardenCompassProps {
  compassDeg: number
  onRotate: (deg: number) => void
}

export function GardenCompass({ compassDeg, onRotate }: GardenCompassProps) {
  const [pos, setPos] = useState({ x: 12, y: 60 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, ox: 0, oy: 0 })

  const { d: arcPath, sunDirection } = getSunArcPath(compassDeg)

  function rotate(delta: number) {
    const next = ((compassDeg + delta) % 360 + 360) % 360
    onRotate(next)
  }

  function onMouseDown(e: React.MouseEvent) {
    setDragging(true)
    setDragStart({ mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y })
    e.preventDefault()
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    setPos({
      x: dragStart.ox + e.clientX - dragStart.mx,
      y: dragStart.oy + e.clientY - dragStart.my,
    })
  }

  function onMouseUp() {
    setDragging(false)
  }

  const deg = Math.round(compassDeg)
  const northAngle = (compassDeg - 180 + 360) % 360 // arrow pointing to actual north

  return (
    <div
      className={cn(
        'absolute z-20 bg-white border border-border rounded-xl p-3 shadow-card select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <p className="font-poppins font-bold text-[10px] uppercase tracking-wide text-forest/40 mb-2">
        Orientation
      </p>

      {/* SVG Compass */}
      <svg width={88} height={88} viewBox="0 0 88 88" aria-label="Boussole interactive">
        {/* Background circle */}
        <circle cx={44} cy={44} r={40} fill="#F9F7E8" stroke="rgba(30,86,49,0.12)" strokeWidth={1.5} />

        {/* Graduation ticks */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const r1 = 34, r2 = 38
          return (
            <line
              key={i}
              x1={44 + r1 * Math.cos(angle)}
              y1={44 + r1 * Math.sin(angle)}
              x2={44 + r2 * Math.cos(angle)}
              y2={44 + r2 * Math.sin(angle)}
              stroke="rgba(30,86,49,0.2)"
              strokeWidth={1}
            />
          )
        })}

        {/* Sun arc (yellow) */}
        <path d={arcPath} fill="none" stroke="#F6C445" strokeWidth={4} strokeLinecap="round" opacity={0.8} />

        {/* N/S/E/O Labels */}
        {[
          { label: 'N', dx: 0, dy: -28 },
          { label: 'S', dx: 0, dy: 32 },
          { label: 'E', dx: 30, dy: 4 },
          { label: 'O', dx: -28, dy: 4 },
        ].map(({ label, dx, dy }) => (
          <text
            key={label}
            x={44 + dx}
            y={44 + dy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontFamily="Poppins, sans-serif"
            fontWeight="700"
            fill={label === 'N' ? '#e53e3e' : 'rgba(30,86,49,0.5)'}
          >
            {label}
          </text>
        ))}

        {/* Rotating compass needle */}
        <g transform={`rotate(${northAngle}, 44, 44)`}>
          {/* North (red) */}
          <polygon points="44,14 41,44 47,44" fill="#e53e3e" />
          {/* South (gray) */}
          <polygon points="44,74 41,44 47,44" fill="rgba(30,86,49,0.25)" />
        </g>

        {/* Center dot */}
        <circle cx={44} cy={44} r={3} fill="#1E5631" />
      </svg>

      {/* Degree display + direction */}
      <p className="font-poppins font-semibold text-xs text-forest text-center mt-1.5">
        {deg}° — {sunDirection}
      </p>

      {/* Sun badge */}
      <div className="flex items-center gap-1 mt-1.5 bg-[#fffbe0] border border-sun/30 rounded-lg px-2 py-1 justify-center">
        <span className="text-xs" aria-hidden>☀️</span>
        <span className="font-raleway text-[10px] text-forest/70">Ensoleillé côté {sunDirection}</span>
      </div>

      {/* Rotation buttons */}
      <div className="flex items-center justify-between mt-2 gap-1">
        <button
          onClick={() => rotate(-15)}
          className="flex-1 py-1 rounded-lg bg-sand hover:bg-lime/20 font-poppins font-bold text-xs text-forest transition-colors"
          aria-label="Tourner vers l'ouest"
          title="Tourner vers l'ouest (−15°)"
        >
          ◁
        </button>
        <button
          onClick={() => rotate(15)}
          className="flex-1 py-1 rounded-lg bg-sand hover:bg-lime/20 font-poppins font-bold text-xs text-forest transition-colors"
          aria-label="Tourner vers l'est"
          title="Tourner vers l'est (+15°)"
        >
          ▷
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd growi-frontend
git add components/dashboard/jardin/GardenCompass.tsx
git commit -m "feat(jardin): add GardenCompass HTML overlay with rotating SVG needle and sun arc"
```

---

## Task 10: GardenRightPanel

**Files:**
- Create: `growi-frontend/components/dashboard/jardin/GardenPropsTab.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenConfigTab.tsx`
- Create: `growi-frontend/components/dashboard/jardin/GardenRightPanel.tsx`

- [ ] **Step 1: Create `GardenPropsTab.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenPropsTab.tsx
'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { GardenElement, ElementSun } from '@/lib/garden/types'
import { mockPlants } from '@/lib/mock-plants'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const COLOR_OPTIONS = [
  { label: 'Lime',   value: '#B4DD7F' },
  { label: 'Soleil', value: '#F6C445' },
  { label: 'Ciel',   value: '#87CEEB' },
  { label: 'Sable',  value: '#F9F7E8' },
  { label: 'Rose',   value: '#F48FB1' },
  { label: 'Forêt',  value: '#1E5631' },
  { label: 'Rouge',  value: '#E53E3E' },
  { label: 'Violet', value: '#9B59B6' },
]

interface GardenPropsTabProps {
  element: GardenElement
  onChange: (patch: Partial<GardenElement>) => void
  onDelete: () => void
}

export function GardenPropsTab({ element, onChange, onDelete }: GardenPropsTabProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const sunOptions: Array<{ value: ElementSun; emoji: string; label: string }> = [
    { value: 'full',  emoji: '☀️', label: 'Plein soleil' },
    { value: 'half',  emoji: '⛅', label: 'Mi-ombre' },
    { value: 'shade', emoji: '🌿', label: 'Ombre' },
  ]

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto">
      {/* Header */}
      <div>
        <p className="font-poppins font-bold text-sm text-forest">
          {element.emoji} {element.label}
        </p>
        <p className="font-raleway text-[11px] text-forest/40 mt-0.5">
          Type : {element.type}
          {element.linkedPlantId && <span className="ml-1.5 text-lime-hover font-semibold">🔗 Liée</span>}
        </p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-name" className="font-raleway text-[11px] font-semibold text-forest/60">
          Nom
        </label>
        <input
          id="el-name"
          value={element.label}
          onChange={e => onChange({ label: e.target.value })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
        />
      </div>

      {/* Dimensions */}
      <div className="flex flex-col gap-1">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Dimensions (px)</span>
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="el-w" className="font-raleway text-[10px] text-forest/40">Largeur</label>
            <input
              id="el-w"
              type="number"
              min={40} max={600} step={20}
              value={element.width}
              onChange={e => onChange({ width: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime w-full"
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="el-h" className="font-raleway text-[10px] text-forest/40">Hauteur</label>
            <input
              id="el-h"
              type="number"
              min={40} max={600} step={20}
              value={element.height}
              onChange={e => onChange({ height: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime w-full"
            />
          </div>
        </div>
      </div>

      {/* Sun exposure */}
      <div className="flex flex-col gap-1">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Ensoleillement</span>
        <div className="flex gap-1.5">
          {sunOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ sun: opt.value })}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={element.sun === opt.value}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[10px] font-raleway font-semibold transition-all',
                element.sun === opt.value
                  ? opt.value === 'shade'
                    ? 'border-lime bg-lime/20 text-forest'
                    : 'border-sun bg-sun/20 text-forest'
                  : 'border-border text-forest/50 hover:border-forest/20',
              )}
            >
              <span className="text-base" aria-hidden>{opt.emoji}</span>
              <span className="leading-none">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <span className="font-raleway text-[11px] font-semibold text-forest/60">Couleur</span>
        <div className="flex gap-2 flex-wrap">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.value}
              onClick={() => onChange({ customColor: c.value })}
              title={c.label}
              aria-label={`Couleur ${c.label}`}
              aria-pressed={element.customColor === c.value}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-all',
                element.customColor === c.value ? 'border-forest ring-2 ring-forest/30 scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-notes" className="font-raleway text-[11px] font-semibold text-forest/60">
          Notes
        </label>
        <textarea
          id="el-notes"
          rows={2}
          placeholder="Arrosage, floraison…"
          value={element.notes ?? ''}
          onChange={e => onChange({ notes: e.target.value })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest resize-none focus:outline-none focus:ring-1 focus:ring-lime"
        />
      </div>

      {/* Link plant */}
      <div className="flex flex-col gap-1">
        <label htmlFor="el-plant" className="font-raleway text-[11px] font-semibold text-forest/60">
          Lier à une plante
        </label>
        <select
          id="el-plant"
          value={element.linkedPlantId ?? ''}
          onChange={e => onChange({ linkedPlantId: e.target.value || undefined })}
          className="border border-border rounded-lg px-2.5 py-1.5 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime bg-white"
        >
          <option value="">— Aucune —</option>
          {mockPlants.map(p => (
            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
          ))}
        </select>
      </div>

      {/* Delete */}
      <button
        onClick={() => setDeleteOpen(true)}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-red-200 text-red-500 font-raleway text-xs font-semibold hover:bg-red-50 transition-colors mt-2"
      >
        <Trash2 size={13} aria-hidden />
        Supprimer cet élément
      </button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {element.emoji} {element.label} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera retiré de ton jardin. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 rounded-lg font-raleway text-sm text-forest/70 hover:bg-sand transition-colors"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(); setDeleteOpen(false) }}
              className="px-4 py-2 rounded-lg font-poppins font-semibold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Create `GardenConfigTab.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenConfigTab.tsx
'use client'

import { cn } from '@/lib/utils'
import type { GardenConfig, SolType, GardenOrientation, MicroClimat, ClimateZone, SlopeDirection } from '@/lib/garden/types'
import { SOL_INFOS, ORIENTATION_LABELS, ORIENTATION_TO_DEG } from '@/lib/garden/defaults'
import { generateReco } from '@/lib/garden/garden-reco'

interface GardenConfigTabProps {
  config: GardenConfig
  onChange: (patch: Partial<GardenConfig>) => void
}

function ChipGroup<T extends string>({
  options, value, onChange, multi = false,
}: {
  options: Array<{ value: T; label: string }>
  value: T | T[]
  onChange: (v: T | T[]) => void
  multi?: boolean
}) {
  function isActive(v: T) {
    return multi ? (value as T[]).includes(v) : value === v
  }
  function toggle(v: T) {
    if (!multi) return onChange(v)
    const arr = value as T[]
    onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => toggle(opt.value)}
          aria-pressed={isActive(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-lg font-raleway text-[11px] font-semibold border transition-all',
            isActive(opt.value)
              ? 'bg-lime/20 border-lime text-forest'
              : 'bg-white border-border text-forest/50 hover:border-forest/20',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-forest/8 last:border-0">
      <p className="font-poppins font-bold text-[11px] uppercase tracking-wide text-forest/50">{title}</p>
      {children}
    </div>
  )
}

export function GardenConfigTab({ config, onChange }: GardenConfigTabProps) {
  const reco = generateReco(config)

  const slopeLabel =
    config.slopeDeg === 0 ? '✅ Terrain plat — drainage standard'
    : config.slopeDeg <= 10 ? '🔽 Légère pente — bon drainage naturel'
    : config.slopeDeg <= 25 ? '⚠️ Pente modérée — prévoir des terrasses'
    : '🚨 Forte pente — aménagement indispensable'

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto text-xs">

      <Section title="🧭 Orientation principale">
        <ChipGroup<GardenOrientation>
          options={(Object.keys(ORIENTATION_LABELS) as GardenOrientation[]).map(k => ({
            value: k, label: ORIENTATION_LABELS[k],
          }))}
          value={config.orientation}
          onChange={(v) => onChange({
            orientation: v as GardenOrientation,
            compassDeg: ORIENTATION_TO_DEG[v as GardenOrientation],
          })}
        />
      </Section>

      <Section title="🌍 Type de sol">
        <ChipGroup<SolType>
          options={[
            { value: 'argileux', label: '🧱 Argileux' },
            { value: 'sableux',  label: '🏖️ Sableux' },
            { value: 'limoneux', label: '🌾 Limoneux' },
            { value: 'calcaire', label: '⛰️ Calcaire' },
            { value: 'tourbeux', label: '🌑 Tourbeux' },
            { value: 'fertile',  label: '🌱 Fertile' },
          ]}
          value={config.solType}
          onChange={(v) => onChange({ solType: v as SolType })}
        />
        <p className="font-raleway text-[10px] text-forest/50 italic">
          {SOL_INFOS[config.solType]}
        </p>
      </Section>

      <Section title="📐 Inclinaison du terrain">
        <div className="flex items-center gap-2">
          <input
            id="slope-range"
            type="range"
            min={0} max={45} step={1}
            value={config.slopeDeg}
            onChange={e => onChange({ slopeDeg: Number(e.target.value) })}
            className="flex-1 accent-lime"
            aria-label="Inclinaison du terrain en degrés"
          />
          <span className="font-poppins font-bold text-forest w-8 text-right">{config.slopeDeg}°</span>
        </div>
        <p className="font-raleway text-[10px] text-forest/60">{slopeLabel}</p>
        <div className="mt-1">
          <p className="font-raleway text-[10px] text-forest/50 mb-1">Direction de la pente</p>
          <ChipGroup<SlopeDirection>
            options={[
              { value: 'N', label: 'N' }, { value: 'S', label: 'S' },
              { value: 'E', label: 'E' }, { value: 'O', label: 'O' },
            ]}
            value={config.slopeDirection}
            onChange={(v) => onChange({ slopeDirection: v as SlopeDirection })}
          />
        </div>
      </Section>

      <Section title="🌤️ Micro-climat">
        <ChipGroup<MicroClimat>
          options={[
            { value: 'abrite', label: '🌿 Abrité' },
            { value: 'vente',  label: '💨 Venté' },
            { value: 'humide', label: '💧 Humide' },
            { value: 'sec',    label: '☀️ Sec' },
            { value: 'gel',    label: '❄️ Risque gel' },
            { value: 'urban',  label: '🏙️ Urbain' },
          ]}
          value={config.microclimats}
          onChange={(v) => onChange({ microclimats: v as MicroClimat[] })}
          multi
        />
      </Section>

      <Section title="📏 Superficie">
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="conf-w" className="font-raleway text-[10px] text-forest/40">Largeur (m)</label>
            <input
              id="conf-w"
              type="number"
              min={1} max={500} step={1}
              value={config.widthMeters}
              onChange={e => onChange({ widthMeters: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label htmlFor="conf-h" className="font-raleway text-[10px] text-forest/40">Longueur (m)</label>
            <input
              id="conf-h"
              type="number"
              min={1} max={500} step={1}
              value={config.heightMeters}
              onChange={e => onChange({ heightMeters: Number(e.target.value) })}
              className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>
        </div>
        <p className="font-raleway text-[10px] text-forest/50 font-semibold">
          📐 Surface : {config.widthMeters * config.heightMeters} m²
        </p>
      </Section>

      <Section title="🌍 Zone climatique">
        <ChipGroup<ClimateZone>
          options={[
            { value: 'oceanique',  label: '🌧️ Océanique' },
            { value: 'continental',label: '❄️ Continental' },
            { value: 'mediterr',   label: '🌊 Méditerranéen' },
            { value: 'montagne',   label: '🏔️ Montagne' },
          ]}
          value={config.climateZone}
          onChange={(v) => onChange({ climateZone: v as ClimateZone })}
        />
      </Section>

      {/* Growi reco */}
      <div className="rounded-xl bg-lime/10 border border-lime/30 p-3 mt-1">
        <p className="font-poppins font-bold text-[11px] text-forest mb-1.5">🤖 Recommandation Growi</p>
        <p className="font-raleway text-[11px] text-forest/70 leading-relaxed">{reco}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `GardenRightPanel.tsx`**

```typescript
// growi-frontend/components/dashboard/jardin/GardenRightPanel.tsx
'use client'

import type { GardenElement, GardenConfig } from '@/lib/garden/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GardenPropsTab } from './GardenPropsTab'
import { GardenConfigTab } from './GardenConfigTab'

interface GardenRightPanelProps {
  selectedElement: GardenElement | null
  onUpdateElement: (id: string, patch: Partial<GardenElement>) => void
  onDeleteElement: (id: string) => void
  config: GardenConfig
  onUpdateConfig: (patch: Partial<GardenConfig>) => void
}

export function GardenRightPanel({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  config,
  onUpdateConfig,
}: GardenRightPanelProps) {
  return (
    <aside
      aria-label="Panneau de propriétés"
      className="hidden md:flex flex-col w-60 shrink-0 bg-white border-l border-forest/10 overflow-hidden"
    >
      <Tabs defaultValue="element" className="flex flex-col h-full">
        <TabsList className="shrink-0">
          <TabsTrigger value="element">✏️ Élément</TabsTrigger>
          <TabsTrigger value="config">⚙️ Jardin</TabsTrigger>
        </TabsList>

        <TabsContent value="element" className="flex-1 overflow-y-auto">
          {selectedElement ? (
            <GardenPropsTab
              element={selectedElement}
              onChange={(patch) => onUpdateElement(selectedElement.id, patch)}
              onDelete={() => onDeleteElement(selectedElement.id)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
              <span className="text-4xl opacity-30" aria-hidden>🖱️</span>
              <p className="font-raleway text-xs text-forest/40">
                Clique sur un élément pour modifier ses propriétés
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="flex-1 overflow-y-auto">
          <GardenConfigTab config={config} onChange={onUpdateConfig} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
```

- [ ] **Step 4: Build check**

```bash
cd growi-frontend
npm run build 2>&1 | grep -E "^.*(error|Error)" | head -20
```

Expected: 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd growi-frontend
git add components/dashboard/jardin/GardenPropsTab.tsx components/dashboard/jardin/GardenConfigTab.tsx components/dashboard/jardin/GardenRightPanel.tsx
git commit -m "feat(jardin): add GardenRightPanel with Élément and Jardin config tabs"
```

---

## Task 11: Dashboard integration

**Files:**
- Modify: `growi-frontend/components/dashboard/DashboardNav.tsx`
- Modify: `growi-frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Add "Mon Jardin" to DashboardNav**

In [DashboardNav.tsx](growi-frontend/components/dashboard/DashboardNav.tsx), add `Map` to the lucide-react import and insert the nav item:

```typescript
// Change import line:
import {
  LayoutDashboard,
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
  Map,
} from 'lucide-react'

// In navItems array, after the Accueil entry:
const navItems = [
  { href: '/dashboard',            label: 'Accueil',       icon: LayoutDashboard },
  { href: '/dashboard/jardin',     label: 'Mon Jardin',    icon: Map },
  { href: '/dashboard/plantes',    label: 'Mes plantes',   icon: Leaf },
  { href: '/dashboard/calendrier', label: 'Calendrier',    icon: CalendarDays },
  { href: '/dashboard/diagnostic', label: 'Diagnostic IA', icon: Stethoscope },
  { href: '/dashboard/meteo',      label: 'Météo',         icon: CloudSun },
  { href: '/dashboard/marketplace',label: 'Marketplace',   icon: ShoppingBag },
  { href: '/dashboard/compte',     label: 'Mon compte',    icon: UserCircle },
] as const
```

- [ ] **Step 2: Add Mon Jardin FeatureCard to dashboard/page.tsx**

In [app/dashboard/page.tsx](growi-frontend/app/dashboard/page.tsx), add `Map` to the lucide import and insert the card:

```typescript
// Add Map to import
import {
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
  TrendingUp,
  Map,
} from 'lucide-react'

// In featureCards array, at the top:
const featureCards = [
  {
    href: '/dashboard/jardin',
    title: 'Mon Jardin',
    description: 'Crée la carte de ton jardin et planifie tes zones.',
    icon: Map,
  },
  // ... rest of existing cards
]
```

- [ ] **Step 3: Final build check**

```bash
cd growi-frontend
npm run build 2>&1 | tail -30
```

Expected: ✓ Build succeeds. No TypeScript errors. The dynamic `GardenCanvas` import compiles cleanly.

- [ ] **Step 4: Commit**

```bash
cd growi-frontend
git add components/dashboard/DashboardNav.tsx app/dashboard/page.tsx
git commit -m "feat(jardin): integrate Mon Jardin into DashboardNav and homepage FeatureCards"
```

---

## Task 12: Mobile FAB + accessibility polish

**Files:**
- Modify: `growi-frontend/app/dashboard/jardin/page.tsx`
- Modify: `growi-frontend/components/dashboard/jardin/GardenCanvas.tsx`

On mobile (`< md`), the left palette and right panel are hidden. A FAB opens them in a bottom sheet.

- [ ] **Step 1: Add FAB to page.tsx**

The mobile FAB button appears over the canvas and opens a bottom Sheet. We'll use the existing `Sheet` component.

In `app/dashboard/jardin/page.tsx`, wrap the GardenCanvas in a client wrapper that adds the FAB:

```typescript
// growi-frontend/app/dashboard/jardin/page.tsx
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { GardenCanvasSkeleton } from '@/components/dashboard/jardin/GardenCanvasSkeleton'

export const metadata: Metadata = { title: 'Mon Jardin' }

const GardenCanvas = dynamic(
  () => import('@/components/dashboard/jardin/GardenCanvas').then(m => ({ default: m.GardenCanvas })),
  { ssr: false, loading: () => <GardenCanvasSkeleton /> },
)

export default function JardinPage() {
  return (
    <div className="-m-6 -mb-24 md:-mb-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <GardenCanvas />
    </div>
  )
}
```

The palette and right panel are already `hidden md:flex` — they auto-hide on mobile. The FAB is embedded in `GardenCanvas`:

- [ ] **Step 2: Add mobile FAB to GardenCanvas.tsx**

At the bottom of the `CanvasDropZone` section in GardenCanvas, add a mobile FAB + bottom Sheet (after `GardenZoomControls`):

```typescript
// Add imports at top of GardenCanvas.tsx:
import { useState } from 'react'
import { Layers } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { GardenPalette } from './GardenPalette'
import { GardenConfigTab } from './GardenConfigTab'

// Inside CanvasDropZone JSX, after <GardenZoomControls>:
```

Inside `GardenCanvas` export function, add state and FAB JSX:

```typescript
// After other useGarden destructuring:
const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

// Inside CanvasDropZone, after GardenZoomControls:
{/* Mobile FAB */}
<button
  onClick={() => setMobileSheetOpen(true)}
  className="md:hidden absolute bottom-16 right-3 z-20 w-12 h-12 rounded-full bg-lime shadow-cta flex items-center justify-center"
  aria-label="Ouvrir la palette et les options"
>
  <Layers size={20} className="text-forest" aria-hidden />
</button>

<Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
  <SheetContent side="bottom" className="h-[70vh] flex flex-col">
    <SheetHeader>
      <SheetTitle className="font-poppins text-sm text-forest">Palette & Configuration</SheetTitle>
    </SheetHeader>
    <div className="flex-1 overflow-y-auto">
      <GardenPalette />
    </div>
  </SheetContent>
</Sheet>
```

Note: `GardenPalette` uses `hidden md:flex` — for the Sheet, add a variant prop or create a `GardenPaletteMobile` that removes the `hidden md:flex` restriction. Simplest fix: in `GardenPalette.tsx` change the `<aside>` to conditionally add `hidden md:flex` based on a prop:

```typescript
// GardenPalette.tsx: add optional prop
interface GardenPaletteProps {
  embedded?: boolean // when true, no hidden md:flex
}

export function GardenPalette({ embedded = false }: GardenPaletteProps) {
  return (
    <aside
      aria-label="Palette d'éléments"
      className={cn(
        'flex flex-col bg-white border-r border-forest/10 overflow-y-auto',
        !embedded && 'hidden md:flex w-48 shrink-0',
        embedded && 'w-full',
      )}
    >
```

Use `<GardenPalette embedded />` inside the Sheet.

- [ ] **Step 3: Final comprehensive build check**

```bash
cd growi-frontend
npm run build 2>&1 | tail -40
```

Expected: ✓ Build succeeds.

If there are lingering TypeScript issues with react-konva types (e.g. `Konva.Group` vs `import type Konva`):

```typescript
// Replace: import type Konva from 'konva'
// With:
import Konva from 'konva'
```

If Konva types package is missing:
```bash
cd growi-frontend
npm install --save-dev @types/konva 2>/dev/null || echo "konva ships own types"
```

- [ ] **Step 4: Final commit**

```bash
cd growi-frontend
git add -A
git commit -m "feat(jardin): add mobile FAB + Sheet for palette access on small screens"
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Covered in task |
|-----------------|----------------|
| Éditeur canvas drag & drop | Task 8 (GardenCanvas + KonvaElement) |
| Murs, portails, clôtures, abri, terrasse | Task 2 (PALETTE_CATALOG Structures) |
| Zones (pelouse, massif, potager…) | Task 2 (PALETTE_CATALOG Zones) |
| Plantes redimensionnables | Task 8 (Transformer in KonvaElement) |
| Arbres redimensionnables | Task 8 (Transformer in KonvaElement) |
| Équipements (fontaine, mare, compost…) | Task 2 (PALETTE_CATALOG Eau & Équipements) |
| Boussole interactive | Task 9 (GardenCompass) |
| Config jardin (sol, pente, micro-climat, superficie, zone) | Task 10 (GardenConfigTab) |
| Modifier chaque élément (nom, dims, sun, couleur, notes) | Task 10 (GardenPropsTab) |
| Supprimer via panneau + AlertDialog | Task 10 (GardenPropsTab delete button) |
| Sauvegarder (localStorage + toast) | Task 3 (useGarden) + Task 6 (GardenToolbar) |
| Export PNG via html2canvas | Task 3 (useGarden.exportPNG) + Task 6 (toolbar button) |
| Snap to grid 20px | Task 2 (snapToGrid) + Task 8 (KonvaElement + addElement) |
| Zoom +/−/reset | Task 8 (GardenZoomControls) |
| Empty state | Task 8 (GardenEmptyState) |
| Stats bar (plantes/arbres/zones) | Task 8 (GardenStatsBar) |
| Tutoiement cohérent | All tasks — all user-visible strings use "tu/ton/tes" |
| Responsive (mobile FAB) | Task 12 |
| sr-only accessibility table | Task 8 (GardenCanvas) |
| aria-label boussole | Task 9 |
| `npm run build` sans erreur | Verified at end of Tasks 5, 8, 10, 12 |
| DashboardNav entry | Task 11 |
| FeatureCard on dashboard | Task 11 |
| Recommendation dynamique | Task 2 (generateReco) + Task 10 (GardenConfigTab) |
| Orientation sync boussole ↔ config | Task 10 (ORIENTATION_TO_DEG) |
| Inline name editing (double-clic) | Task 6 (GardenToolbar) |
| Debounce auto-save 1500ms | Task 3 (useGarden scheduleAutoSave) |
| TODO comments for API replacement | Task 2 (storage.ts) |

**Known implementation note:** `GardenCanvas.tsx` imports `useState` from the canvas module level — the `mobileSheetOpen` state should be at the `GardenCanvas` function scope, not inside `CanvasDropZone`. The Step 2 in Task 12 requires careful placement inside the `GardenCanvas` function body with the state hoisted.

**Type conflict note:** `lib/garden/types.ts` defines `ElementSun` (not `SunExposure`) to avoid collision with `lib/mock-plants.ts`'s `SunExposure` type. All garden components use `ElementSun`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-08-mon-jardin.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
