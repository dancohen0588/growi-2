// lib/garden/storage.ts
// Persistence layer for the garden canvas.
// Reads/writes canvasData to the database via Server Actions.

import type { Garden } from './types'
import { updateGardenCanvas } from '@/lib/actions/garden.actions'

export async function saveGardenToDB(gardenId: string, garden: Garden): Promise<void> {
  await updateGardenCanvas(gardenId, JSON.stringify(garden))
}

// Legacy localStorage helpers — kept only for migration read on first load.
// Remove after all users have migrated (safe to delete after MVP launch).
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

export function loadGardenFromLocalStorage(): Garden | null {
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

export function clearLocalStorageGarden(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
