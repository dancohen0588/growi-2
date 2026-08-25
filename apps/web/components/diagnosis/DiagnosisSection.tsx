'use client'

import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import type { HealthStatus } from '@growi/shared'

import { DiagnosisFlow } from '@/components/diagnosis/DiagnosisFlow'
import { DiagnosisHistory } from '@/components/diagnosis/DiagnosisHistory'
import { useToast } from '@/components/ui/toast'

/**
 * Le CTA de diagnostic et l'historique qui l'accompagne, sur la fiche plante.
 *
 * Les deux vivent ensemble parce qu'un diagnostic réussi doit apparaître dans
 * l'historique sans rechargement : c'est ici que le compteur de rafraîchissement
 * est tenu.
 */

export interface DiagnosisSectionProps {
  plantId: string
  plantName: string
  plantPhotoUrl?: string
  /** Remonte le nouvel état à la fiche, pour que son badge suive immédiatement. */
  onStatusApplied?: (status: HealthStatus, note: string) => void
}

export function DiagnosisSection({
  plantId,
  plantName,
  plantPhotoUrl,
  onStatusApplied,
}: DiagnosisSectionProps) {
  const [open, setOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-3.5 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2 shadow-cta"
      >
        <Stethoscope size={18} aria-hidden />
        Diagnostiquer ma plante
      </button>

      <DiagnosisFlow
        plantId={plantId}
        plantName={plantName}
        plantPhotoUrl={plantPhotoUrl}
        open={open}
        onOpenChange={setOpen}
        onDiagnosed={() => setRefreshKey((k) => k + 1)}
        onStatusApplied={(status, note) => {
          setRefreshKey((k) => k + 1)
          onStatusApplied?.(status, note)
          toast('État de la plante mis à jour.')
        }}
      />

      <DiagnosisHistory plantId={plantId} refreshKey={refreshKey} />
    </div>
  )
}
