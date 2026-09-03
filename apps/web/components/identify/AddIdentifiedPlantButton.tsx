'use client'

import Link from 'next/link'
import { useCallback, useState, useTransition } from 'react'
import { ArrowRight, Check, Loader2, Plus } from 'lucide-react'

import { addIdentifiedPlantToMyPlants } from '@/lib/actions/plant.actions'
import type { IdentifiedPlant } from '@/components/identify/IdentifyFlow'

/** L'action de fin de parcours côté tableau de bord : ajouter à son jardin. */
export function AddIdentifiedPlantButton({ plant }: { plant: IdentifiedPlant }) {
  const [isPending, startTransition] = useTransition()
  const [addedPlantId, setAddedPlantId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const handleAdd = useCallback(() => {
    setAddError(null)
    startTransition(async () => {
      const res = await addIdentifiedPlantToMyPlants({
        commonName: plant.commonName,
        scientificName: plant.scientificName,
        emoji: plant.emoji,
        encyclopediaSlug: plant.encyclopediaSlug,
      })
      if (res.success && res.plantId) setAddedPlantId(res.plantId)
      else setAddError(res.error ?? "Impossible d'ajouter la plante.")
    })
  }, [plant])

  if (addedPlantId) {
    return (
      <Link
        href={`/dashboard/plantes/${addedPlantId}`}
        className="rounded-xl bg-lime/20 border border-lime/40 text-forest font-poppins font-semibold text-sm px-5 py-3 hover:bg-lime/30 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Check size={18} aria-hidden />
        Plante ajoutée — voir sa fiche
        <ArrowRight size={16} aria-hidden />
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-3 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 size={18} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={18} aria-hidden />
        )}
        {isPending ? 'Ajout en cours…' : 'Ajouter à mes plantes'}
      </button>

      {addError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 font-raleway">
          {addError}
        </p>
      )}
    </>
  )
}
