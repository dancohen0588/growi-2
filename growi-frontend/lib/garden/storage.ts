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
