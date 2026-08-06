import { prisma } from '@/lib/prisma'
import { fetchWeatherForecast } from './weather-adapter'
import { RecommendationEngine } from './engine'
import type { PlantContext, GardenAdviceResult, PlantAdvice, WeatherForecast } from './types'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function neutralForecast(): WeatherForecast {
  const today = new Date()
  return {
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
    current: { temperature: 15, precipitation: 0, weatherCode: 0 },
    daily: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return {
        date: d.toISOString().slice(0, 10),
        tempMax: 15,
        tempMin: 15,
        precipSum: 0,
        precipProbabilityMax: 0,
      }
    }),
  }
}

export async function getGardenAdvice(
  gardenId: string,
  userId: string,
): Promise<GardenAdviceResult> {
  // 1. Check cache
  const cached = await prisma.gardenAdviceCache.findUnique({
    where: { gardenId },
  })

  if (cached && cached.expiresAt > new Date()) {
    return cached.payload as unknown as GardenAdviceResult
  }

  // 2. Fetch garden + owner coords
  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId },
    include: {
      user: { select: { latitude: true, longitude: true } },
    },
  })

  if (!garden) {
    throw new Error('Jardin introuvable')
  }

  // 3. Fetch plant instances (include orphan plants with no gardenId)
  const instances = await prisma.plantInstance.findMany({
    where: {
      userId,
      OR: [{ gardenId }, { gardenId: null }],
    },
    include: { catalogPlant: true, zone: true },
  })

  // 4. Weather
  const lat = garden.user.latitude
  const lon = garden.user.longitude
  const weather =
    lat != null && lon != null
      ? await fetchWeatherForecast(lat, lon)
      : neutralForecast()

  // 5. Build contexts
  const now = new Date()
  const contexts: PlantContext[] = instances.map((instance) => ({
    instance,
    garden,
    weather,
    currentDate: now,
  }))

  // 6. Evaluate
  const engine = new RecommendationEngine()
  const result = engine.evaluateGarden(contexts, gardenId)

  // 7. Cache (upsert)
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS)
  await prisma.gardenAdviceCache.upsert({
    where: { gardenId },
    create: {
      gardenId,
      generatedAt: now,
      expiresAt,
      payload: result as any,
    },
    update: {
      generatedAt: now,
      expiresAt,
      payload: result as any,
    },
  })

  return result
}

export async function getPlantAdvice(
  plantInstanceId: string,
  userId: string,
): Promise<PlantAdvice> {
  const instance = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    include: {
      catalogPlant: true,
      zone: true,
      garden: { include: { user: { select: { latitude: true, longitude: true } } } },
    },
  })

  if (!instance) {
    throw new Error('Plante introuvable')
  }

  // Resolve garden: use linked garden, or fall back to user's most recent garden
  let garden = instance.garden
  if (!garden) {
    const fallback = await prisma.garden.findFirst({
      where: { userId },
      include: { user: { select: { latitude: true, longitude: true } } },
      orderBy: { createdAt: 'desc' },
    })
    garden = fallback
  }

  let weather: WeatherForecast
  if (garden) {
    const lat = garden.user.latitude
    const lon = garden.user.longitude
    weather = lat != null && lon != null
      ? await fetchWeatherForecast(lat, lon)
      : neutralForecast()
  } else {
    weather = neutralForecast()
  }

  // Build a minimal garden object if none exists
  const gardenForCtx = garden ?? {
    id: 'no-garden',
    userId,
    name: '',
    description: null,
    type: 'OUTDOOR',
    surfaceM2: null,
    climateZone: null,
    soilType: null,
    orientation: null,
    canvasData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const ctx: PlantContext = {
    instance,
    garden: gardenForCtx as any,
    weather,
    currentDate: new Date(),
  }

  const engine = new RecommendationEngine()
  return engine.evaluateForPlant(ctx)
}

export async function invalidateGardenAdviceCache(gardenId: string): Promise<void> {
  await prisma.gardenAdviceCache.deleteMany({ where: { gardenId } })
}
