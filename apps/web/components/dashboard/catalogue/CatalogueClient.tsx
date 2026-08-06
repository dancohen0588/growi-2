'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlantCatalog } from '@prisma/client'
import { searchCatalog } from '@/lib/actions/catalog.actions'
import { addPlantToMyGarden } from '@/lib/actions/plant.actions'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { label: 'Toutes',       value: '' },
  { label: '🏠 Intérieur', value: 'INDOOR' },
  { label: '🍅 Potager',   value: 'VEGETABLE' },
  { label: '🌸 Fleurs',    value: 'FLOWERS' },
  { label: '🌿 Aromatiques', value: 'HERBS' },
  { label: '🌵 Succulentes', value: 'SUCCULENTS' },
  { label: '🌳 Arbres',    value: 'TREES_SHRUBS' },
  { label: '🌿 Grimpantes', value: 'CLIMBING' },
]

export function CatalogueClient({ initialPlants }: { initialPlants: PlantCatalog[] }) {
  const [plants, setPlants]       = useState(initialPlants)
  const [query, setQuery]         = useState('')
  const [category, setCategory]   = useState('')
  const [isPending, startTransition] = useTransition()
  const [addingId, setAddingId]   = useState<string | null>(null)
  const router = useRouter()

  function handleSearch(q: string, cat: string) {
    startTransition(async () => {
      const results = await searchCatalog(q, cat || undefined)
      setPlants(results)
    })
  }

  async function handleAdd(plant: PlantCatalog) {
    setAddingId(plant.id)
    await addPlantToMyGarden({
      catalogPlantId: plant.id,
      location:       plant.indoor ? 'INDOOR' : 'OUTDOOR',
    })
    setAddingId(null)
    router.push('/dashboard/plantes')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <input
        type="search"
        placeholder="Rechercher une plante…"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          handleSearch(e.target.value, category)
        }}
        className="w-full rounded-xl border border-border bg-white px-4 py-3 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime"
      />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => {
              setCategory(c.value)
              handleSearch(query, c.value)
            }}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-all border',
              category === c.value
                ? 'bg-lime text-forest font-semibold border-lime'
                : 'bg-white border-border text-forest/70 hover:border-forest/30',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Results grid */}
      {isPending ? (
        <p className="font-raleway text-sm text-forest/50 text-center py-8">Recherche…</p>
      ) : plants.length === 0 ? (
        <p className="font-raleway text-sm text-forest/50 text-center py-8">
          Aucune plante trouvée.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plants.map(plant => (
            <div
              key={plant.id}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card"
            >
              {/* Emoji */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{plant.emoji ?? '🌿'}</span>
                <div>
                  <p className="font-poppins font-semibold text-sm text-forest">
                    {plant.commonName}
                  </p>
                  <p className="font-raleway italic text-xs text-forest/50">
                    {plant.scientificName}
                  </p>
                </div>
              </div>

              {/* Description */}
              {plant.descriptionShort && (
                <p className="font-raleway text-xs text-forest/70 leading-relaxed">
                  {plant.descriptionShort}
                </p>
              )}

              {/* Watering info */}
              <p className="font-raleway text-xs text-forest/60">
                💧 Arrosage tous les {plant.wateringFreqDays} jours
              </p>

              {/* Add button */}
              <button
                onClick={() => handleAdd(plant)}
                disabled={addingId === plant.id}
                className="mt-auto rounded-xl bg-lime px-4 py-2 font-raleway text-sm font-semibold text-forest transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {addingId === plant.id ? 'Ajout…' : '+ Ajouter à mes plantes'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
