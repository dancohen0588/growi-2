// app/dashboard/plantes/page.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { Plus, Droplets } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlants } from '@/lib/plants-context'
import { getDaysUntilWatering } from '@/lib/mock-plants'
import { PlantCard } from '@/components/dashboard/plantes/PlantCard'
import { PlantListEmpty } from '@/components/dashboard/plantes/PlantListEmpty'
import { cn } from '@/lib/utils'

type LocationFilter = 'all' | 'interieur' | 'exterieur' | 'balcon' | 'serre'
type HealthFilter = 'all' | 'critical' | 'warning'

const locationFilters: { label: string; value: LocationFilter }[] = [
  { label: 'Toutes',       value: 'all' },
  { label: '🏠 Intérieur', value: 'interieur' },
  { label: '🌳 Extérieur', value: 'exterieur' },
  { label: '🌇 Balcon',   value: 'balcon' },
  { label: '🏡 Serre',    value: 'serre' },
]

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function PlantesPage() {
  const { plants } = usePlants()
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')

  const filtered = useMemo(() => {
    return plants.filter(p => {
      if (locationFilter !== 'all' && p.location !== locationFilter) return false
      if (healthFilter !== 'all' && p.healthStatus !== healthFilter) return false
      return true
    })
  }, [plants, locationFilter, healthFilter])

  const overdueCount = useMemo(
    () => plants.filter(p => getDaysUntilWatering(p) <= 0).length,
    [plants],
  )

  const count = plants.length
  const s = count > 1 ? 's' : ''

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
            Mes plantes 🌿
          </h1>
          <p className="font-raleway text-forest/60 mt-1">
            {count === 0
              ? 'Ton jardin est vide pour le moment.'
              : `Tu as ${count} plante${s} dans ton jardin.`}
          </p>
        </div>
        <Button variant="primary" asChild>
          <Link href="/dashboard/plantes/nouveau">
            <Plus size={18} aria-hidden />
            Ajouter une plante
          </Link>
        </Button>
      </div>

      {/* Watering urgent banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
          <Droplets className="text-red-500 shrink-0" size={20} aria-hidden />
          <p className="font-raleway text-sm text-red-700 flex-1">
            <strong>{overdueCount} plante{overdueCount > 1 ? 's ont' : ' a'}</strong> besoin d&apos;eau maintenant !
          </p>
          <button
            onClick={() => setHealthFilter(healthFilter === 'critical' ? 'all' : 'critical')}
            className="font-raleway text-sm text-red-600 underline underline-offset-2 hover:text-red-800 transition-colors"
          >
            Voir lesquelles →
          </button>
        </div>
      )}

      {/* Filters */}
      {plants.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Location filters */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            role="group"
            aria-label="Filtrer par emplacement"
          >
            {locationFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setLocationFilter(f.value)}
                aria-pressed={locationFilter === f.value}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-all border',
                  locationFilter === f.value
                    ? 'bg-lime text-forest font-semibold border-lime'
                    : 'bg-white border-border text-forest/70 hover:border-forest/30',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Health quick filters */}
          <div className="flex gap-2" role="group" aria-label="Filtrer par état de santé">
            {([
              { label: '🚨 En danger',    value: 'critical' },
              { label: '⚠️ À surveiller', value: 'warning' },
            ] as { label: string; value: HealthFilter }[]).map(f => (
              <button
                key={f.value}
                onClick={() =>
                  setHealthFilter(prev => (prev === f.value ? 'all' : f.value))
                }
                aria-pressed={healthFilter === f.value}
                className={cn(
                  'rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-all border',
                  healthFilter === f.value
                    ? 'bg-lime text-forest font-semibold border-lime'
                    : 'bg-white border-border text-forest/70 hover:border-forest/30',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plant grid or empty state */}
      {filtered.length === 0 && plants.length === 0 ? (
        <PlantListEmpty />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-raleway text-forest/60">
            Aucune plante ne correspond à ce filtre.
          </p>
          <button
            onClick={() => { setLocationFilter('all'); setHealthFilter('all') }}
            className="mt-2 font-raleway text-sm text-forest underline underline-offset-2 hover:text-forest-light"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map(plant => (
            <motion.div key={plant.id} variants={fadeUp}>
              <PlantCard plant={plant} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
