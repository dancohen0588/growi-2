'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePlants } from '@/lib/plants-context'
import { type PlantLocation, type HealthStatus, getWateringProgress } from '@/lib/plant-types'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { PlantCard } from './PlantCard'
import { PlantListEmpty } from './PlantListEmpty'

type LocationFilter = 'all' | PlantLocation
type HealthFilter = 'all' | HealthStatus

const LOCATION_FILTERS: { value: LocationFilter; label: string }[] = [
  { value: 'all',       label: 'Toutes' },
  { value: 'interieur', label: '🏠 Intérieur' },
  { value: 'exterieur', label: '🌳 Extérieur' },
  { value: 'balcon',    label: '🌇 Balcon' },
  { value: 'serre',     label: '🏡 Serre' },
]

const HEALTH_FILTERS: { value: HealthFilter; label: string }[] = [
  { value: 'all',      label: 'Tous états' },
  { value: 'healthy',  label: '✅ Bonne santé' },
  { value: 'warning',  label: '⚠️ À surveiller' },
  { value: 'critical', label: '🚨 En danger' },
]

export function PlantsListView() {
  const { plants } = usePlants()
  const shouldReduceMotion = useReducedMotion()
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')

  const filtered = plants.filter(p => {
    const matchLoc = locationFilter === 'all' || p.location === locationFilter
    const matchHealth = healthFilter === 'all' || p.healthStatus === healthFilter
    return matchLoc && matchHealth
  })

  const overdueCount = plants.filter(p => getWateringProgress(p) >= 100).length

  if (plants.length === 0) return <PlantListEmpty />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-forest">
            Mes plantes 🌿
          </h1>
          <p className="font-raleway text-sm text-forest/60 mt-0.5">
            {plants.length} plante{plants.length > 1 ? 's' : ''} dans ton jardin
          </p>
        </div>
        <Button variant="primary" size="sm" asChild>
          <Link href="/dashboard/plantes/nouveau">
            <Plus size={16} aria-hidden />
            Ajouter une plante
          </Link>
        </Button>
      </div>

      {/* Urgent watering banner */}
      {overdueCount > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
          <span className="text-xl" aria-hidden>💧</span>
          <p className="font-raleway text-sm text-red-700">
            <strong>{overdueCount} plante{overdueCount > 1 ? 's' : ''}</strong> doit{overdueCount > 1 ? 'vent' : ''} être arrosée maintenant !
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par emplacement">
          {LOCATION_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setLocationFilter(f.value)}
              aria-pressed={locationFilter === f.value}
              className={cn(
                'rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-colors',
                locationFilter === f.value
                  ? 'bg-forest text-white'
                  : 'bg-white text-forest/70 border border-forest/15 hover:border-forest/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par santé">
          {HEALTH_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setHealthFilter(f.value)}
              aria-pressed={healthFilter === f.value}
              className={cn(
                'rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-colors',
                healthFilter === f.value
                  ? 'bg-forest text-white'
                  : 'bg-white text-forest/70 border border-forest/15 hover:border-forest/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="font-raleway text-sm text-forest/60 py-10 text-center">
          Aucune plante dans cette catégorie.
        </p>
      ) : (
        <motion.div
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filtered.map((plant, i) => (
            <motion.div key={plant.id} variants={shouldReduceMotion ? undefined : fadeUp}>
              <PlantCard plant={plant} priority={i < 3} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
