'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Garden, GardenElement, GardenConfig } from '@/lib/garden/types'
import type { PaletteItem } from '@/lib/garden/palette'
import { createDefaultGarden } from '@/lib/garden/defaults'
import { getOrCreateDefaultGarden } from '@/lib/actions/garden.actions'
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
  selectedId: string | null
  zoom: number
  isSaving: boolean

  selectElement: (id: string | null) => void
  selectedElement: GardenElement | null

  addElement: (item: PaletteItem, x: number, y: number, extra?: Partial<GardenElement>) => string
  updateElement: (id: string, patch: Partial<GardenElement>) => void
  deleteElement: (id: string) => void
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  setZoom: (zoom: number) => void
  updateConfig: (patch: Partial<GardenConfig>) => void
  updateName: (name: string) => void

  saveGarden: () => void
  exportPNG: (containerId: string) => Promise<void>
}

export function useGarden(): UseGardenReturn {
  const [garden, setGarden] = useState<Garden>(createDefaultGarden)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gardenDbIdRef = useRef<string | null>(null)

  // Miroir de l'état courant + pile d'annulation (snapshots avant mutation).
  const gardenRef = useRef(garden)
  gardenRef.current = garden
  const historyRef = useRef<Garden[]>([])
  const redoRef = useRef<Garden[]>([])

  // Load from DB on mount (with one-time localStorage migration fallback)
  useEffect(() => {
    async function init() {
      const dbGarden = await getOrCreateDefaultGarden()
      if (!dbGarden) return
      gardenDbIdRef.current = dbGarden.id

      if (dbGarden.canvasData) {
        try {
          const parsed: unknown = JSON.parse(dbGarden.canvasData)
          if (
            parsed &&
            typeof parsed === 'object' &&
            'elements' in parsed &&
            Array.isArray((parsed as any).elements)
          ) {
            setGarden(parsed as Garden)
            return
          }
        } catch {
          // Invalid JSON — fall through
        }
      }

      // One-time migration: import from localStorage if DB canvas is empty
      const local = loadGardenFromLocalStorage()
      if (local) {
        setGarden(local)
        clearLocalStorageGarden()
        await saveGardenToDB(dbGarden.id, local)
      }
    }
    init()
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current)
    }
  }, [])

  // Auto-save with debounce on every garden change
  const scheduleAutoSave = useCallback((updated: Garden) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (gardenDbIdRef.current) {
        saveGardenToDB(gardenDbIdRef.current, updated)
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
      ...extra,
    }
    updateGarden(prev => ({ ...prev, elements: [...prev.elements, newEl] }))
    setSelectedId(newEl.id)
    return newEl.id
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

  const updateName = useCallback((name: string) => {
    updateGarden(prev => ({ ...prev, name }))
  }, [updateGarden])

  const saveGarden = useCallback(() => {
    if (!gardenDbIdRef.current) return
    setIsSaving(true)
    saveGardenToDB(gardenDbIdRef.current, garden).then(() => {
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
    selectedId,
    zoom,
    isSaving,
    selectElement,
    selectedElement,
    addElement,
    updateElement,
    deleteElement,
    clearCanvas,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
    setZoom,
    updateConfig,
    updateName,
    saveGarden,
    exportPNG,
  }
}
