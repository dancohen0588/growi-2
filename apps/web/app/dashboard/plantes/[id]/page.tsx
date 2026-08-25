// app/dashboard/plantes/[id]/page.tsx
'use client'

import { useCallback, useState, useEffect } from 'react'
import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { PlantDetailHero } from '@/components/dashboard/plantes/PlantDetailHero'
import { PlantInfoGrid } from '@/components/dashboard/plantes/PlantInfoGrid'
import { PlantCareTipsSection } from '@/components/dashboard/plantes/PlantCareTipsSection'
import { PlantAdviceTimeline } from '@/components/dashboard/plantes/PlantAdviceTimeline'
import { PlantQuickActions } from '@/components/dashboard/plantes/PlantQuickActions'
import { PlantTasksSection } from '@/components/dashboard/plantes/PlantTasksSection'
import { PlantCareData } from '@/components/dashboard/plantes/PlantCareData'
import { PlantCareHistory } from '@/components/dashboard/plantes/PlantCareHistory'
import { DiagnosisSection } from '@/components/diagnosis/DiagnosisSection'
import { getPlantAdviceAction } from '@/app/actions/advice.actions'
import { toPresentationHealth } from '@/lib/plant-mapper'
import type { PlantAdvice } from '@/lib/recommendation/types'

interface PageProps {
  params: { id: string }
}

export default function PlantDetailPage({ params }: PageProps) {
  const { plants, setPlantHealth } = usePlants()
  const plant = plants.find(p => p.id === params.id)
  const [advice, setAdvice] = useState<PlantAdvice | null>(null)
  // Incrémenté à chaque geste noté : les conseils et le journal se relisent,
  // et `router.refresh()` rapatrie les dates d'entretien côté serveur.
  const [careKey, setCareKey] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (!plant) return
    getPlantAdviceAction(plant.id)
      .then(setAdvice)
      .catch(() => setAdvice(null))
  }, [plant, careKey])

  const onCareLogged = useCallback(() => {
    setCareKey((k) => k + 1)
    router.refresh()
  }, [router])

  if (!plant) return notFound()

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 font-raleway text-xs text-forest/50">
        <Link href="/dashboard" className="hover:text-forest transition-colors">
          Tableau de bord
        </Link>
        <ChevronRight size={12} aria-hidden />
        <Link href="/dashboard/plantes" className="hover:text-forest transition-colors">
          Mes plantes
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span aria-current="page" className="text-forest font-medium">
          {plant.name}
        </span>
      </nav>

      {/* Hero */}
      <PlantDetailHero plant={plant} />

      {/* Gestes rapides, à portée de clic sous l'identité de la plante */}
      <PlantQuickActions plantId={plant.id} onLogged={onCareLogged} />

      {/* Ce que le moteur conseille aujourd'hui, validable sans passer par le calendrier */}
      <PlantTasksSection
        tasks={advice?.tasks ?? []}
        gardenId={plant.gardenId ?? null}
        plantId={plant.id}
        onDone={onCareLogged}
      />

      {/* Info grid */}
      <section>
        <h2 className="font-poppins font-semibold text-lg text-forest mb-4">
          Informations clés
        </h2>
        <PlantInfoGrid plant={plant} />
      </section>

      {/* Dates d'entretien */}
      <PlantCareData plant={plant} />

      {/* Diagnostic IA — CTA, parcours et historique */}
      <DiagnosisSection
        plantId={plant.id}
        plantName={plant.name}
        plantPhotoUrl={plant.photoUrl}
        onStatusApplied={(status, note) =>
          setPlantHealth(plant.id, toPresentationHealth(status), note)
        }
      />

      {/* Advice timeline */}
      <PlantAdviceTimeline advice={advice} />

      {/* Description */}
      <section className="rounded-2xl bg-white shadow-card p-6">
        <h2 className="font-poppins font-semibold text-lg text-forest mb-3">
          À propos
        </h2>
        <p className="font-raleway text-forest/80 leading-relaxed">
          {plant.description}
        </p>
      </section>

      {/* Journal d'entretien */}
      <PlantCareHistory plantId={plant.id} refreshKey={careKey} />

      {/* Care tips + funFact */}
      <PlantCareTipsSection plant={plant} />
    </div>
  )
}
