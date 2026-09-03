'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ParcelDetail } from '@growi/shared'
import type { Garden, GardenElement, GardenConfig, GardenAnnotation, LayerOrder } from '@/lib/garden/types'
import { isSurfaceType, rectPoints } from '@/lib/garden/types'
import { seedGardenFromParcels, type CadastreSeedOptions } from '@/lib/garden/cadastre-seed'
import type { PaletteItem } from '@/lib/garden/palette'
import { createDefaultGarden } from '@/lib/garden/defaults'
import { loadGardenForEditor, renameGarden } from '@/lib/actions/garden.actions'
import {
  saveGardenToDB,
  loadGardenFromLocalStorage,
  clearLocalStorageGarden,
} from '@/lib/garden/storage'
import { snapToGrid } from '@/lib/garden/compute-sun'

// Profondeur de la pile d'annulation (Ctrl/Cmd + Z).
const HISTORY_LIMIT = 50

export interface UseGardenReturn {
  garden: Garden
  /** Identifiant en base du jardin ouvert — celui demandé, ou le jardin courant. */
  gardenId: string | null
  selectedId: string | null
  zoom: number
  isSaving: boolean
  isLoaded: boolean
  completeOnboarding: () => void

  selectElement: (id: string | null) => void
  selectedElement: GardenElement | null

  addElement: (item: PaletteItem, x: number, y: number, extra?: Partial<GardenElement>) => string
  duplicateElement: (source: GardenElement) => string
  updateElement: (id: string, patch: Partial<GardenElement>) => void
  deleteElement: (id: string) => void
  reorderElement: (id: string, mode: LayerOrder) => void
  clearCanvas: () => void
  addAnnotation: (x: number, y: number, text: string) => string
  updateAnnotation: (id: string, patch: Partial<GardenAnnotation>) => void
  deleteAnnotation: (id: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  setZoom: (zoom: number) => void
  updateConfig: (patch: Partial<GardenConfig>) => void
  updateName: (name: string) => void
  /** Pose un import cadastral en une seule entrée d'annulation. */
  applyCadastreSeed: (parcels: ParcelDetail[], options: CadastreSeedOptions) => Garden
  /** Écrit `Garden.surfaceM2` en base (API v1). */
  setSurfaceM2: (surfaceM2: number) => Promise<void>

  saveGarden: () => void
  exportPNG: (containerId: string) => Promise<void>
}

/**
 * État de l'éditeur de plan pour un jardin.
 *
 * @param requestedGardenId Jardin à ouvrir. `null` ouvre le jardin courant
 * (le plus récent), créé au besoin — c'est le cas au premier affichage, avant
 * que l'utilisateur n'ait choisi.
 */
export function useGarden(requestedGardenId: string | null = null): UseGardenReturn {
  const [garden, setGarden] = useState<Garden>(createDefaultGarden)
  const [gardenId, setGardenId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gardenDbIdRef = useRef<string | null>(null)

  // Miroir de l'état courant + pile d'annulation (snapshots avant mutation).
  const gardenRef = useRef(garden)
  gardenRef.current = garden
  const historyRef = useRef<Garden[]>([])
  const redoRef = useRef<Garden[]>([])

  // Chargement depuis la base — au montage, puis à chaque changement de jardin.
  // Tout est remis à zéro : sans cela, le plan du jardin précédent resterait
  // affiché (et finirait enregistré) sous le nouveau.
  useEffect(() => {
    // Le jardin déjà ouvert : c'est le cas quand l'appelant se contente de
    // nommer celui que le serveur venait de choisir. Recharger ferait
    // clignoter le plan pour rien.
    if (requestedGardenId && requestedGardenId === gardenDbIdRef.current) return

    let cancelled = false

    setIsLoaded(false)
    setSelectedId(null)
    historyRef.current = []
    redoRef.current = []

    async function init() {
      const dbGarden = await loadGardenForEditor(requestedGardenId)
      if (!dbGarden || cancelled) return
      gardenDbIdRef.current = dbGarden.id
      setGardenId(dbGarden.id)

      // Le nom fait foi en base : le canevas en garde une copie, mais c'est
      // celui de la colonne `name` que voient l'API v1 et l'app mobile.
      if (dbGarden.canvasData) {
        try {
          const parsed: unknown = JSON.parse(dbGarden.canvasData)
          if (
            parsed &&
            typeof parsed === 'object' &&
            'elements' in parsed &&
            Array.isArray((parsed as any).elements)
          ) {
            setGarden({ ...(parsed as Garden), name: dbGarden.name })
            return
          }
        } catch {
          // Invalid JSON — fall through
        }
      }

      // One-time migration: import from localStorage if DB canvas is empty
      const local = loadGardenFromLocalStorage()
      if (local) {
        const migrated = { ...local, name: dbGarden.name }
        setGarden(migrated)
        clearLocalStorageGarden()
        await saveGardenToDB(dbGarden.id, migrated)
        return
      }

      setGarden({ ...createDefaultGarden(), name: dbGarden.name })
    }

    init().finally(() => {
      if (!cancelled) setIsLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [requestedGardenId])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current)
    }
  }, [])

  // Auto-save with debounce on every garden change.
  // Le jardin cible est figé à la programmation : si l'utilisateur en change
  // entre-temps, l'enregistrement en attente doit partir dans le jardin où le
  // dessin a été fait, pas dans celui qu'on vient d'ouvrir.
  const scheduleAutoSave = useCallback((updated: Garden) => {
    const targetId = gardenDbIdRef.current
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (targetId) {
        // Le jardin peut avoir été supprimé entre-temps : un enregistrement
        // qui échoue ne doit pas remonter en rejet non traité.
        saveGardenToDB(targetId, updated).catch(err => {
          console.error('[useGarden] enregistrement automatique :', err)
        })
      }
    }, 1500)
  }, [])

  // Empile l'état courant avant toute mutation (pour l'annulation).
  // Plusieurs mutations synchrones d'une même action partagent le même snapshot
  // (référence identique tant qu'aucun rendu n'a eu lieu) → une seule annulation.
  const pushHistory = useCallback(() => {
    redoRef.current = [] // une nouvelle action invalide le rétablissement
    const h = historyRef.current
    if (h[h.length - 1] === gardenRef.current) return
    h.push(gardenRef.current)
    if (h.length > HISTORY_LIMIT) h.shift()
  }, [])

  const updateGarden = useCallback((updater: (prev: Garden) => Garden) => {
    pushHistory()
    setGarden(prev => {
      const next = updater({ ...prev, updatedAt: new Date().toISOString() })
      scheduleAutoSave(next)
      return next
    })
  }, [scheduleAutoSave, pushHistory])

  const selectElement = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const selectedElement = useMemo(
    () => garden.elements.find(e => e.id === selectedId) ?? null,
    [garden.elements, selectedId],
  )

  const addElement = useCallback((item: PaletteItem, x: number, y: number, extra?: Partial<GardenElement>): string => {
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
      // Les zones & structures sont des polygones dès la création (rectangle modifiable).
      ...(isSurfaceType(item.type)
        ? { points: rectPoints(item.defaultWidth, item.defaultHeight) }
        : {}),
      ...extra,
    }
    // Un élément qu'on vient de poser passe au premier plan, quel que soit son
    // type : le voir est la première chose qu'on en attend. Les zones étaient
    // envoyées au fond, ce qui les faisait disparaître sous un plan déjà
    // rempli — le panneau de propriétés permet de les y renvoyer.
    updateGarden(prev => ({ ...prev, elements: [...prev.elements, newEl] }))
    setSelectedId(newEl.id)
    return newEl.id
  }, [updateGarden])

  // Duplique un élément (copier/coller) : clone décalé d'une case de grille,
  // nouvel id, lien catalogue retiré (copie purement visuelle).
  const duplicateElement = useCallback((source: GardenElement): string => {
    const clone: GardenElement = {
      ...source,
      id: crypto.randomUUID(),
      x: snapToGrid(source.x + 20),
      y: snapToGrid(source.y + 20),
      linkedPlantId: undefined,
      points: source.points ? source.points.map(p => ({ ...p })) : undefined,
    }
    updateGarden(prev => ({ ...prev, elements: [...prev.elements, clone] }))
    setSelectedId(clone.id)
    return clone.id
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

  // Réordonne un élément (ordre du tableau = ordre des calques).
  const reorderElement = useCallback((id: string, mode: LayerOrder) => {
    updateGarden(prev => {
      const i = prev.elements.findIndex(e => e.id === id)
      if (i < 0) return prev
      const next = prev.elements.slice()
      const [el] = next.splice(i, 1)
      const j =
        mode === 'front'   ? next.length
        : mode === 'back'  ? 0
        : mode === 'forward' ? Math.min(next.length, i + 1)
        : Math.max(0, i - 1)
      next.splice(j, 0, el)
      return { ...prev, elements: next }
    })
  }, [updateGarden])

  // ── Commentaires (P3) ────────────────────────────────────────────────
  const addAnnotation = useCallback((x: number, y: number, text: string): string => {
    const ann: GardenAnnotation = {
      id: crypto.randomUUID(),
      x: Math.round(x),
      y: Math.round(y),
      text,
      createdAt: new Date().toISOString(),
    }
    updateGarden(prev => ({ ...prev, annotations: [...(prev.annotations ?? []), ann] }))
    return ann.id
  }, [updateGarden])

  const updateAnnotation = useCallback((id: string, patch: Partial<GardenAnnotation>) => {
    updateGarden(prev => ({
      ...prev,
      annotations: (prev.annotations ?? []).map(a => a.id === id ? { ...a, ...patch } : a),
    }))
  }, [updateGarden])

  const deleteAnnotation = useCallback((id: string) => {
    updateGarden(prev => ({
      ...prev,
      annotations: (prev.annotations ?? []).filter(a => a.id !== id),
    }))
  }, [updateGarden])

  // Annule la dernière action (Ctrl/Cmd + Z) : restaure le snapshot précédent.
  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    redoRef.current.push(gardenRef.current)
    if (redoRef.current.length > HISTORY_LIMIT) redoRef.current.shift()
    setSelectedId(null)
    setGarden(prev)
    scheduleAutoSave(prev)
  }, [scheduleAutoSave])

  // Rétablit la dernière action annulée (Ctrl/Cmd + Maj + Z).
  const redo = useCallback(() => {
    const next = redoRef.current.pop()
    if (!next) return
    historyRef.current.push(gardenRef.current)
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift()
    setSelectedId(null)
    setGarden(next)
    scheduleAutoSave(next)
  }, [scheduleAutoSave])

  const updateConfig = useCallback((patch: Partial<GardenConfig>) => {
    updateGarden(prev => ({ ...prev, config: { ...prev.config, ...patch } }))
  }, [updateGarden])

  /**
   * Renomme le jardin en base, et non dans le seul plan dessiné : c'est la
   * colonne `name` que servent l'API v1 et l'app mobile. Le renommage ne passe
   * donc pas par la pile d'annulation — annuler un trait de crayon ne doit pas
   * défaire un renommage déjà enregistré.
   */
  const updateName = useCallback((name: string) => {
    const id = gardenDbIdRef.current
    if (!id) return

    const previous = gardenRef.current.name
    setGarden(prev => ({ ...prev, name }))

    renameGarden(id, name).catch(() => {
      setGarden(prev => (prev.name === name ? { ...prev, name: previous } : prev))
    })
  }, [])

  /**
   * Pose un import cadastral : **un seul** `updateGarden`, donc une seule
   * entrée dans la pile d'annulation — Ctrl+Z retire tout l'import d'un coup.
   *
   * L'état complet est calculé depuis le plan courant puis renvoyé, ce qui
   * permet à l'appelant de recadrer la vue sur ce qui vient d'être posé sans
   * attendre le prochain rendu.
   */
  const applyCadastreSeed = useCallback(
    (parcels: ParcelDetail[], options: CadastreSeedOptions): Garden => {
      const next = seedGardenFromParcels(gardenRef.current, parcels, options)
      updateGarden(prev => ({ ...next, updatedAt: prev.updatedAt }))
      return next
    },
    [updateGarden],
  )

  /**
   * Écrit la surface du jardin en base — colonne `surfaceM2`, que lisent l'app
   * mobile et le contexte du diagnostic. Elle vit à côté du canevas : une
   * surface importée du cadastre n'aurait aucun effet si on la laissait dans
   * le seul plan dessiné.
   */
  const setSurfaceM2 = useCallback(async (surfaceM2: number): Promise<void> => {
    const id = gardenDbIdRef.current
    if (!id) return
    try {
      await fetch(`/api/v1/gardens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surfaceM2 }),
      })
    } catch (err) {
      // Le plan, lui, est posé : une surface non enregistrée se corrige dans
      // l'onglet « Jardin », elle ne justifie pas de défaire l'import.
      console.error('[useGarden] surface du jardin :', err)
    }
  }, [])

  // Marque l'assistant de création comme terminé (P4).
  const completeOnboarding = useCallback(() => {
    updateGarden(prev => ({ ...prev, onboarding: { completed: true } }))
  }, [updateGarden])

  const saveGarden = useCallback(() => {
    if (!gardenDbIdRef.current) return
    setIsSaving(true)
    saveGardenToDB(gardenDbIdRef.current, garden)
      .catch(err => console.error('[useGarden] enregistrement :', err))
      .finally(() => {
        savingTimerRef.current = setTimeout(() => setIsSaving(false), 800)
      })
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
    gardenId,
    selectedId,
    zoom,
    isSaving,
    isLoaded,
    completeOnboarding,
    selectElement,
    selectedElement,
    addElement,
    duplicateElement,
    updateElement,
    deleteElement,
    reorderElement,
    clearCanvas,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
    setZoom,
    updateConfig,
    updateName,
    applyCadastreSeed,
    setSurfaceM2,
    saveGarden,
    exportPNG,
  }
}
