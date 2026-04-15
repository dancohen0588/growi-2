// Mapper: Prisma PlantInstance → Plant (presentation type)
// Lives outside 'use server' so it can be used by both server actions and utilities.

import type { PlantInstance, PlantCatalog, GardenZone } from '@prisma/client'
import type { Plant, PlantLocation, SunExposure, HealthStatus, WateringDifficulty } from '@/lib/plant-types'

export type PlantInstanceWithRelations = PlantInstance & {
  catalogPlant: PlantCatalog | null
  zone: GardenZone | null
}

const locationMap: Record<string, PlantLocation> = {
  OUTDOOR:    'exterieur',
  INDOOR:     'interieur',
  GREENHOUSE: 'serre',
  BALCONY:    'balcon',
}

const healthMap: Record<string, HealthStatus> = {
  HEALTHY:  'healthy',
  WARNING:  'warning',
  CRITICAL: 'critical',
}

const sunMap: Record<string, SunExposure> = {
  FULL_SUN: 'full',
  PARTIAL:  'partial',
  SHADE:    'shade',
}

const difficultyMap: Record<string, WateringDifficulty> = {
  EASY:      'easy',
  MEDIUM:    'medium',
  DEMANDING: 'demanding',
}

const categoryMap: Record<string, Plant['category']> = {
  INDOOR:       'interieur',
  VEGETABLE:    'potager',
  FLOWERS:      'fleurs',
  TREES_SHRUBS: 'arbres',
  HERBS:        'aromatiques',
  SUCCULENTS:   'interieur',
  AQUATIC:      'potager',
  CLIMBING:     'fleurs',
}

export function toPlant(instance: PlantInstanceWithRelations): Plant {
  const cat = instance.catalogPlant
  const wateringFreqDays = instance.wateringFreqDays ?? cat?.wateringFreqDays ?? 7

  return {
    id:                 instance.id,
    name:               instance.customName ?? cat?.commonName ?? 'Ma plante',
    scientificName:     cat?.scientificName,
    emoji:              instance.emoji ?? cat?.emoji ?? '🌿',
    category:           categoryMap[cat?.category ?? ''] ?? 'interieur',
    location:           locationMap[instance.location] ?? 'exterieur',
    zone:               instance.zone?.name,
    dateAdded:          instance.dateAdded.toISOString(),
    datePlanted:        instance.datePlanted?.toISOString(),
    photoUrl:           instance.photoUrl ?? undefined,
    wateringFrequencyDays: wateringFreqDays,
    lastWateredDate:    instance.lastWateredAt?.toISOString(),
    nextWateringDate:   instance.lastWateredAt
      ? new Date(instance.lastWateredAt.getTime() + wateringFreqDays * 86_400_000).toISOString()
      : undefined,
    sunExposure:        sunMap[instance.sunExposure ?? cat?.sunExposure ?? 'PARTIAL'] ?? 'partial',
    soilType:           instance.soilType ?? undefined,
    wateringDifficulty: difficultyMap[cat?.wateringDifficulty ?? 'EASY'] ?? 'easy',
    healthStatus:       healthMap[instance.healthStatus] ?? 'healthy',
    healthNote:         instance.healthNote ?? undefined,
    description:        cat?.descriptionShort ?? '',
    careTips:           { watering: '', light: '', soil: '' },
    notes:              instance.notes ?? undefined,
    catalogPlantId:     instance.catalogPlantId,
    catalogPlant:       cat
      ? { imageUrl: cat.imageUrl, commonName: cat.commonName }
      : null,
  }
}
