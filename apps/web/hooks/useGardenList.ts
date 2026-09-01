'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreateGardenInput } from '@growi/shared'

import {
  createGarden as createGardenAction,
  deleteGarden as deleteGardenAction,
  getGardenSummaries,
  type GardenSummary,
} from '@/lib/actions/garden.actions'

/**
 * Dernier jardin ouvert sur ce navigateur. Un identifiant devenu invalide
 * (jardin supprimé, autre compte) n'est pas un problème : le serveur retombe
 * alors sur le jardin courant.
 */
const STORAGE_KEY = 'growi_current_garden_id'

function readStoredGardenId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeGardenId(gardenId: string | null): void {
  try {
    if (gardenId) localStorage.setItem(STORAGE_KEY, gardenId)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Navigation privée, stockage plein : le choix ne survivra pas au
    // rechargement, ce n'est pas une raison pour casser l'écran.
  }
}

export interface UseGardenListReturn {
  gardens: GardenSummary[]
  /** Jardin demandé à l'éditeur ; `null` tant que rien n'a été choisi. */
  currentGardenId: string | null
  selectGarden: (gardenId: string) => void
  createGarden: (input: CreateGardenInput) => Promise<void>
  deleteGarden: (gardenId: string) => Promise<void>
  /** À appeler quand l'éditeur a résolu le jardin réellement ouvert. */
  onGardenLoaded: (gardenId: string) => void
  /** Garde la liste à jour après un renommage, sans recharger. */
  onGardenRenamed: (gardenId: string, name: string) => void
}

/** Les jardins du compte et celui qu'affiche l'éditeur de plan. */
export function useGardenList(): UseGardenListReturn {
  const [gardens, setGardens] = useState<GardenSummary[]>([])
  const [currentGardenId, setCurrentGardenId] = useState<string | null>(readStoredGardenId)
  const gardensRef = useRef<GardenSummary[]>(gardens)
  gardensRef.current = gardens

  const refresh = useCallback(async () => {
    const list = await getGardenSummaries()
    gardensRef.current = list
    setGardens(list)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectGarden = useCallback((gardenId: string) => {
    setCurrentGardenId(gardenId)
    storeGardenId(gardenId)
  }, [])

  const createGarden = useCallback(async (input: CreateGardenInput) => {
    const { garden } = await createGardenAction(input)
    await refresh()
    selectGarden(garden.id)
  }, [refresh, selectGarden])

  /**
   * Supprime un jardin et bascule sur celui qui reste le plus récent.
   *
   * Sans jardin restant, la sélection repart à zéro : l'éditeur en fera
   * recréer un, plutôt que de rester sur un identifiant mort.
   */
  const deleteGarden = useCallback(async (gardenId: string) => {
    await deleteGardenAction(gardenId)

    const list = await getGardenSummaries()
    gardensRef.current = list
    setGardens(list)

    const next = list[0]?.id ?? null
    setCurrentGardenId(next)
    storeGardenId(next)
  }, [])

  const onGardenLoaded = useCallback((gardenId: string) => {
    setCurrentGardenId(prev => (prev === gardenId ? prev : gardenId))
    storeGardenId(gardenId)
    // Le tout premier jardin est créé à la volée par le serveur : sans ce
    // rafraîchissement, le sélecteur resterait vide.
    if (!gardensRef.current.some(g => g.id === gardenId)) void refresh()
  }, [refresh])

  const onGardenRenamed = useCallback((gardenId: string, name: string) => {
    setGardens(prev => prev.map(g => (g.id === gardenId ? { ...g, name } : g)))
  }, [])

  return {
    gardens,
    currentGardenId,
    selectGarden,
    createGarden,
    deleteGarden,
    onGardenLoaded,
    onGardenRenamed,
  }
}
