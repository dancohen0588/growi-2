'use client'

import React, { createContext, useContext, useState, useTransition } from 'react'
import type { Plant } from '@/lib/plant-types'
import type { PlantFormValues } from '@/lib/plant-schemas'
import {
  addPlantToMyGarden,
  deletePlantInstance,
  logWatering,
  updateMyPlant,
} from '@/lib/actions/plant.actions'

interface PlantsContextValue {
  plants: Plant[]
  addPlant:    (data: PlantFormValues, catalogPlantId?: string) => Promise<Plant | undefined>
  updatePlant: (id: string, data: PlantFormValues) => Promise<void>
  deletePlant: (id: string) => Promise<void>
  isPending:   boolean
}

const PlantsContext = createContext<PlantsContextValue | null>(null)

export function PlantsProvider({
  children,
  initialPlants = [],
}: {
  children:      React.ReactNode
  initialPlants?: Plant[]
}) {
  const [plants, setPlants] = useState<Plant[]>(initialPlants)
  const [isPending, startTransition] = useTransition()

  async function addPlant(
    data: PlantFormValues,
    catalogPlantId?: string,
  ): Promise<Plant | undefined> {
    const result = await addPlantToMyGarden({
      catalogPlantId,
      customName:       data.name,
      emoji:            data.emoji,
      location:         mapLocation(data.location),
      wateringFreqDays: data.wateringFrequencyDays,
      sunExposure:      mapSun(data.sunExposure),
      datePlanted:      data.datePlanted,
      notes:            data.notes,
      photoUrl:         data.photoUrl || null,
    })
    if (result.success && result.plant) {
      startTransition(() => {
        setPlants(prev => [result.plant!, ...prev])
      })
      return result.plant
    }
    return undefined
  }

  async function updatePlant(id: string, data: PlantFormValues): Promise<void> {
    // L'affichage suit tout de suite ; la Server Action écrit et revalide.
    startTransition(() => {
      setPlants(prev =>
        prev.map(p =>
          p.id === id
            ? {
                ...p,
                name:                  data.name ?? p.name,
                emoji:                 data.emoji ?? p.emoji,
                photoUrl:              data.photoUrl ?? p.photoUrl,
                wateringFrequencyDays: data.wateringFrequencyDays ?? p.wateringFrequencyDays,
              }
            : p,
        ),
      )
    })

    const result = await updateMyPlant(id, {
      customName:       data.name || null,
      emoji:            data.emoji,
      location:         mapLocation(data.location),
      wateringFreqDays: data.wateringFrequencyDays,
      sunExposure:      mapSun(data.sunExposure),
      soilType:         data.soilType || null,
      datePlanted:      data.datePlanted,
      notes:            data.notes || null,
      // `null` efface la photo ; le serveur supprime alors le fichier.
      photoUrl:         data.photoUrl || null,
    })

    if (!result.success) {
      throw new Error(result.error ?? "La plante n'a pas pu être mise à jour.")
    }
  }

  async function deletePlant(id: string): Promise<void> {
    await deletePlantInstance(id)
    startTransition(() => {
      setPlants(prev => prev.filter(p => p.id !== id))
    })
  }

  return (
    <PlantsContext.Provider value={{ plants, addPlant, updatePlant, deletePlant, isPending }}>
      {children}
    </PlantsContext.Provider>
  )
}

export function usePlants(): PlantsContextValue {
  const ctx = useContext(PlantsContext)
  if (!ctx) throw new Error('usePlants must be used inside PlantsProvider')
  return ctx
}

// ── Location/sun mappers (Plant UI values → Prisma enum values) ───────────

function mapLocation(loc: string): 'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'BALCONY' {
  const map: Record<string, 'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'BALCONY'> = {
    exterieur: 'OUTDOOR',
    interieur: 'INDOOR',
    serre:     'GREENHOUSE',
    balcon:    'BALCONY',
  }
  return map[loc] ?? 'OUTDOOR'
}

function mapSun(sun?: string): 'FULL_SUN' | 'PARTIAL' | 'SHADE' | undefined {
  if (!sun) return undefined
  const map: Record<string, 'FULL_SUN' | 'PARTIAL' | 'SHADE'> = {
    full:    'FULL_SUN',
    partial: 'PARTIAL',
    shade:   'SHADE',
  }
  return map[sun]
}
