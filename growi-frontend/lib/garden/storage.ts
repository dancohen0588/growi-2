// growi-frontend/lib/garden/storage.ts
import type { Garden } from './types'

const STORAGE_KEY = 'growi_garden_v1'

function isGarden(v: unknown): v is Garden {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'elements' in v &&
    'config' in v &&
    Array.isArray((v as Garden).elements)
  )
}

export function saveGarden(garden: Garden): void {
  if (typeof window === 'undefined') return
  try {
    const updated = { ...garden, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    console.warn('[Growi] Impossible de sauvegarder le jardin dans localStorage')
  }
}

export function loadGarden(): Garden | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isGarden(parsed) ? parsed : null
  } catch {
    return null
  }
}

// TODO: Replace with API calls:
// POST /api/garden  → saveGarden
// GET  /api/garden  → loadGarden
