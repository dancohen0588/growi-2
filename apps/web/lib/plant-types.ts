// Plant types and UI utilities — replaces the type/util exports of mock-plants.ts

export type PlantLocation = 'interieur' | 'exterieur' | 'serre' | 'balcon'
export type SunExposure = 'full' | 'partial' | 'shade'
export type HealthStatus = 'healthy' | 'warning' | 'critical'
export type WateringDifficulty = 'easy' | 'medium' | 'demanding'

export interface Plant {
  id: string
  name: string
  scientificName?: string
  emoji: string
  category: 'interieur' | 'potager' | 'fleurs' | 'arbres' | 'aromatiques'
  location: PlantLocation
  zone?: string
  dateAdded: string
  datePlanted?: string
  photoUrl?: string
  wateringFrequencyDays: number
  lastWateredDate?: string
  nextWateringDate?: string
  sunExposure: SunExposure
  soilType?: string
  wateringDifficulty: WateringDifficulty
  fertilizerMonths?: number[]
  healthStatus: HealthStatus
  healthNote?: string
  description: string
  careTips: {
    watering: string
    light: string
    soil: string
    pruning?: string
    diseases?: string
    winter?: string
  }
  funFact?: string
  notes?: string
  catalogPlantId?: string | null
  catalogPlant?: { imageUrl: string | null; commonName: string } | null
  growthStage?: string
  harvestWindow?: { start: string; end: string }
  nextPruningDate?: string
  containerSizeLiters?: number
  pruningMonths?: number[]
  harvestMonthsStart?: number
  harvestMonthsEnd?: number
  frostSensitivity?: string
}

export const locationConfig: Record<PlantLocation, { label: string; icon: string }> = {
  interieur: { label: 'Intérieur',  icon: '🏠' },
  exterieur: { label: 'Extérieur',  icon: '🌳' },
  balcon:    { label: 'Balcon',     icon: '🌇' },
  serre:     { label: 'Serre',      icon: '🏡' },
}

export const healthStatusConfig: Record<
  HealthStatus,
  { label: string; color: string; dot: string; icon: string }
> = {
  healthy:  { label: 'En bonne santé', color: 'text-emerald-600', dot: 'bg-emerald-500', icon: '✅' },
  warning:  { label: 'À surveiller',   color: 'text-amber-600',   dot: 'bg-amber-400',   icon: '⚠️' },
  critical: { label: 'En danger',      color: 'text-red-600',     dot: 'bg-red-500',     icon: '🚨' },
}

export const sunExposureConfig: Record<SunExposure, { label: string; icon: string }> = {
  full:    { label: 'Plein soleil', icon: '☀️' },
  partial: { label: 'Mi-ombre',    icon: '⛅' },
  shade:   { label: 'Ombre',       icon: '🌥️' },
}

export const difficultyConfig: Record<WateringDifficulty, { label: string; color: string }> = {
  easy:      { label: 'Facile',   color: 'text-lime' },
  medium:    { label: 'Moyen',    color: 'text-sun'  },
  demanding: { label: 'Exigeant', color: 'text-red-500' },
}

export function getDaysUntilWatering(plant: Plant): number {
  if (!plant.lastWateredDate) return 0
  const last = new Date(plant.lastWateredDate)
  const next = new Date(last.getTime() + plant.wateringFrequencyDays * 86_400_000)
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000)
}

export function getWateringProgress(plant: Plant): number {
  if (!plant.lastWateredDate) return 100
  const last = new Date(plant.lastWateredDate).getTime()
  const elapsed = (Date.now() - last) / 86_400_000
  return Math.min(100, Math.round((elapsed / plant.wateringFrequencyDays) * 100))
}

export function getWateringBarColor(progress: number): string {
  if (progress < 50) return 'bg-lime'
  if (progress < 80) return 'bg-sun'
  return 'bg-red-400'
}
