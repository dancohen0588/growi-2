// app/dashboard/plantes/[id]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { PlantDetailHero } from '@/components/dashboard/plantes/PlantDetailHero'
import { PlantInfoGrid } from '@/components/dashboard/plantes/PlantInfoGrid'
import { PlantCareTipsSection } from '@/components/dashboard/plantes/PlantCareTipsSection'

interface PageProps {
  params: { id: string }
}

export default function PlantDetailPage({ params }: PageProps) {
  const { plants } = usePlants()
  const plant = plants.find(p => p.id === params.id)

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

      {/* Info grid */}
      <section>
        <h2 className="font-poppins font-semibold text-lg text-forest mb-4">
          Informations clés
        </h2>
        <PlantInfoGrid plant={plant} />
      </section>

      {/* Description */}
      <section className="rounded-2xl bg-white shadow-card p-6">
        <h2 className="font-poppins font-semibold text-lg text-forest mb-3">
          À propos
        </h2>
        <p className="font-raleway text-forest/80 leading-relaxed">
          {plant.description}
        </p>
      </section>

      {/* Care tips + funFact */}
      <PlantCareTipsSection plant={plant} />
    </div>
  )
}
