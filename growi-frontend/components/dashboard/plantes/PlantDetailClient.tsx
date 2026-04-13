'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { type Plant } from '@/lib/plant-types'
import { PlantDetailHero } from './PlantDetailHero'
import { PlantInfoGrid } from './PlantInfoGrid'
import { PlantCareTipsSection } from './PlantCareTipsSection'

interface PlantDetailClientProps {
  plantId: string
  initialPlant: Plant
}

export function PlantDetailClient({ plantId, initialPlant }: PlantDetailClientProps) {
  const { plants } = usePlants()
  // Use live plant from context (reflects edits), fall back to initial
  const plant = plants.find(p => p.id === plantId) ?? initialPlant

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane">
        <ol className="flex items-center gap-1.5 font-raleway text-xs text-forest/50">
          <li>
            <Link href="/dashboard/plantes" className="hover:text-forest transition-colors">
              Mes plantes
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight size={12} />
          </li>
          <li aria-current="page" className="text-forest font-medium">
            {plant.name}
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <PlantDetailHero plant={plant} />

      {/* Description */}
      {plant.description && (
        <div className="rounded-2xl bg-white shadow-card p-6">
          <h2 className="font-poppins font-semibold text-lg text-forest mb-3">
            À propos
          </h2>
          <p className="font-raleway text-forest/80 leading-relaxed">
            {plant.description}
          </p>
        </div>
      )}

      {/* Info grid */}
      <PlantInfoGrid plant={plant} />

      {/* Care tips */}
      <PlantCareTipsSection plant={plant} />
    </div>
  )
}
