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

export interface UseGardenReturn {
  garden: Garden
  selectedId: string | null
  zoom: number
  isSaving: boolean

  selectElement: (id: string | null) => void
  selectedElement: GardenElement | null

  addElement: (item: PaletteItem, x: number, y: number) => string
  updateElement: (id: string, patch: Partial<GardenElement>) => void
  deleteElement: (id: string) => void
  clearCanvas: () => void

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

  const selectedElement = useMemo(
    () => garden.elements.find(e => e.id === selectedId) ?? null,
    [garden.elements, selectedId],
  )

  const addElement = useCallback((item: PaletteItem, x: number, y: number): string => {
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
    setZoom,
    updateConfig,
    updateName,
    saveGarden,
    exportPNG,
  }
}
