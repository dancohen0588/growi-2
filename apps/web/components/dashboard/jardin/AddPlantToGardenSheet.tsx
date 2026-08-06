'use client'

import { useState } from 'react'
import { Sprout, Loader2 } from 'lucide-react'
import type { PlantCatalog } from '@prisma/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { PlantSearchInput } from '@/components/dashboard/plantes/PlantSearchInput'

interface AddPlantToGardenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlantSelected: (plant: PlantCatalog) => Promise<void>
  onFallback?: () => void
}

export function AddPlantToGardenSheet({
  open,
  onOpenChange,
  onPlantSelected,
  onFallback,
}: AddPlantToGardenSheetProps) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(plant: PlantCatalog | null) {
    if (!plant || adding) return
    setAdding(true)
    setError(null)
    try {
      await onPlantSelected(plant)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !adding && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg rounded-2xl bg-white shadow-card-hover p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-forest/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime/20 flex items-center justify-center">
              <Sprout size={20} className="text-forest" aria-hidden />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <DialogTitle className="font-poppins font-bold text-base text-forest">
                Ajouter une plante au jardin
              </DialogTitle>
              <DialogDescription className="font-raleway text-xs text-forest/60 mt-0.5">
                Choisis une plante du catalogue, on la pose directement sur ton plan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-3">
          <PlantSearchInput
            autoFocus
            onSelect={handleSelect}
            onFallback={() => {
              onOpenChange(false)
              onFallback?.()
            }}
            placeholder="Nom commun, scientifique…"
          />

          {adding && (
            <div className="flex items-center gap-2 rounded-lg bg-lime/10 border border-lime/40 px-3 py-2">
              <Loader2 size={14} className="text-forest animate-spin" aria-hidden />
              <p className="font-raleway text-xs text-forest/70">
                Ajout de la plante en cours…
              </p>
            </div>
          )}

          {error && !adding && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 font-raleway text-xs text-red-600"
            >
              {error}
            </div>
          )}

          <p className="font-raleway text-[11px] text-forest/40">
            💡 Astuce — tu peux aussi glisser-déposer une plante depuis la palette à gauche.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
