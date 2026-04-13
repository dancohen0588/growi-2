'use client'

// TODO: Remplacer par des appels API REST quand le backend sera disponible

import React, { createContext, useContext, useState } from 'react'
import { mockPlants, type Plant } from '@/lib/mock-plants'
import type { PlantFormValues } from '@/lib/plant-schemas'

interface PlantsContextValue {
  plants: Plant[]
  addPlant: (data: PlantFormValues) => Plant
  updatePlant: (id: string, data: PlantFormValues) => void
  deletePlant: (id: string) => void
}

const PlantsContext = createContext<PlantsContextValue | null>(null)

export function PlantsProvider({ children }: { children: React.ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>(mockPlants)

  function addPlant(data: PlantFormValues): Plant {
    const newPlant: Plant = {
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      description: '',
      careTips: {
        watering: '',
        light: '',
        soil: '',
      },
      ...data,
    }
    setPlants(prev => [...prev, newPlant])
    return newPlant
  }

  function updatePlant(id: string, data: PlantFormValues): void {
    setPlants(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              ...data,
            }
          : p,
      ),
    )
  }

  function deletePlant(id: string): void {
    setPlants(prev => prev.filter(p => p.id !== id))
  }

  return (
    <PlantsContext.Provider value={{ plants, addPlant, updatePlant, deletePlant }}>
      {children}
    </PlantsContext.Provider>
  )
}

export function usePlants(): PlantsContextValue {
  const ctx = useContext(PlantsContext)
  if (!ctx) throw new Error('usePlants must be used within a PlantsProvider')
  return ctx
}
