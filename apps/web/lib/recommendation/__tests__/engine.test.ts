import { describe, it, expect } from 'vitest'
import { RecommendationEngine } from '../engine'
import type { PlantContext, WeatherForecast } from '../types'
import type { PlantInstance, PlantCatalog, GardenZone, Garden } from '@prisma/client'

// ─── Helpers ───────────────────────────────────────────────────────────────

const NOW = new Date('2026-04-16T10:00:00Z')
const DAY = 86_400_000

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY)
}

function makeWeather(overrides?: Partial<WeatherForecast>): WeatherForecast {
  return {
    latitude: 48.85,
    longitude: 2.35,
    timezone: 'Europe/Paris',
    current: { temperature: 20, precipitation: 0, weatherCode: 0 },
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(NOW.getTime() + i * DAY).toISOString().slice(0, 10),
      tempMax: 22,
      tempMin: 12,
      precipSum: 0,
      precipProbabilityMax: 0,
    })),
    ...overrides,
  }
}

function makeGarden(overrides?: Partial<Garden>): Garden {
  return {
    id: 'garden-1',
    userId: 'user-1',
    name: 'Mon jardin',
    description: null,
    type: 'OUTDOOR',
    surfaceM2: null,
    climateZone: null,
    soilType: null,
    orientation: null,
    canvasData: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Garden
}

function makeCatalog(overrides?: Partial<PlantCatalog>): PlantCatalog {
  return {
    id: 'cat-1',
    slug: 'monstera',
    commonName: 'Monstera',
    scientificName: 'Monstera deliciosa',
    family: 'Araceae',
    emoji: '🌿',
    category: 'interieur',
    imageUrl: null,
    descriptionShort: null,
    descriptionLong: null,
    sunExposure: 'partial',
    wateringFreqDays: 7,
    wateringDifficulty: 'EASY',
    minTempCelsius: null,
    maxTempCelsius: null,
    hardinesZone: null,
    soilTypes: null,
    fertilizerMonths: null,
    indoor: true,
    outdoor: false,
    edible: false,
    toxic: false,
    aliases: null,
    tags: null,
    source: null,
    pruningMonths: null,
    pruningType: null,
    sowingMonthsIndoor: null,
    sowingMonthsOutdoor: null,
    transplantMonths: null,
    harvestMonthsStart: null,
    harvestMonthsEnd: null,
    harvestDaysFromSowing: null,
    dormancyMonths: null,
    floweringMonths: null,
    frostSensitivity: null,
    heatStressThresholdC: null,
    wateringAdjHeat: null,
    wateringAdjRain: null,
    sunHoursNeeded: null,
    repottingFreqMonths: null,
    repottingSeasons: null,
    fertilizationType: null,
    treatmentSeasons: null,
    mulchRecommended: false,
    winterProtectionType: null,
    careTipWatering: null,
    careTipLight: null,
    careTipSoil: null,
    careTipPruning: null,
    careTipDiseases: null,
    careTipWinter: null,
    funFact: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as PlantCatalog
}

function makeInstance(
  overrides?: Partial<PlantInstance>,
  catalogOverrides?: Partial<PlantCatalog>,
): PlantContext['instance'] {
  return {
    id: 'inst-1',
    userId: 'user-1',
    gardenId: 'garden-1',
    zoneId: null,
    catalogPlantId: 'cat-1',
    customName: null,
    emoji: null,
    photoUrl: null,
    location: 'OUTDOOR',
    positionX: null,
    positionY: null,
    datePlanted: null,
    dateAdded: NOW,
    wateringFreqDays: null,
    lastWateredAt: null,
    lastFertilizedAt: null,
    soilType: null,
    sunExposure: null,
    healthStatus: 'HEALTHY',
    healthNote: null,
    notes: null,
    containerSizeLiters: null,
    containerMaterial: null,
    substrateType: null,
    lastPrunedAt: null,
    lastRepottedAt: null,
    lastTreatedAt: null,
    seedBatchRef: null,
    growthStage: null,
    isMultiYear: null,
    expectedHarvestDate: null,
    customWateringAdjFactor: null,
    alertsEnabled: true,
    updatedAt: NOW,
    catalogPlant: makeCatalog(catalogOverrides),
    zone: null,
    ...overrides,
  } as PlantContext['instance']
}

function makeCtx(
  instanceOverrides?: Partial<PlantInstance>,
  catalogOverrides?: Partial<PlantCatalog>,
  weatherOverrides?: Partial<WeatherForecast>,
): PlantContext {
  return {
    instance: makeInstance(instanceOverrides, catalogOverrides),
    garden: makeGarden(),
    weather: makeWeather(weatherOverrides),
    currentDate: NOW,
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

const engine = new RecommendationEngine()

describe('R1 — Arrosage standard', () => {
  it('triggers when plant not watered for 8 days (freq=7)', () => {
    const ctx = makeCtx({ lastWateredAt: daysAgo(8) })
    const actions = engine.evaluate([ctx])

    expect(actions.length).toBeGreaterThanOrEqual(1)
    const watering = actions.find((a) => a.type === 'arrosage')
    expect(watering).toBeDefined()
    expect(watering!.priority).toBe('high')
    expect(watering!.done).toBe(false)
  })

  it('does NOT trigger when plant was watered today', () => {
    const ctx = makeCtx({ lastWateredAt: NOW })
    const actions = engine.evaluate([ctx])

    const watering = actions.filter((a) => a.type === 'arrosage')
    expect(watering).toHaveLength(0)
  })
})

describe('R3 — Report arrosage pluie', () => {
  it('generates a pre-checked action when rain > 5mm is forecast', () => {
    const ctx = makeCtx(
      { lastWateredAt: daysAgo(8) },
      {},
      {
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(NOW.getTime() + i * DAY).toISOString().slice(0, 10),
          tempMax: 22,
          tempMin: 12,
          precipSum: i === 0 ? 10 : 0,
          precipProbabilityMax: i === 0 ? 80 : 0,
        })),
      },
    )
    const actions = engine.evaluate([ctx])

    const rain = actions.find((a) => a.id.startsWith('r3-'))
    expect(rain).toBeDefined()
    expect(rain!.done).toBe(true)
    expect(rain!.priority).toBe('low')

    // R1 should be filtered out by R3
    const r1 = actions.find((a) => a.id.startsWith('r1-'))
    expect(r1).toBeUndefined()
  })
})

describe('R5 — Taille en retard overrides R4', () => {
  it('keeps only R5 when lastPrunedAt > 13 months', () => {
    const ctx = makeCtx(
      { lastPrunedAt: daysAgo(400) },
      { pruningMonths: '[4]' }, // April = month 4
    )
    const actions = engine.evaluate([ctx])

    const r5 = actions.find((a) => a.id.startsWith('r5-'))
    const r4 = actions.find((a) => a.id.startsWith('r4-'))
    expect(r5).toBeDefined()
    expect(r5!.priority).toBe('high')
    expect(r4).toBeUndefined()
  })
})

describe('R8 — Récolte imminente', () => {
  it('triggers when current month is in harvest range', () => {
    const ctx = makeCtx(
      {},
      { harvestMonthsStart: 4, harvestMonthsEnd: 6 }, // April–June
    )
    const actions = engine.evaluate([ctx])

    const harvest = actions.find((a) => a.type === 'recolte')
    expect(harvest).toBeDefined()
    expect(harvest!.priority).toBe('high')
    expect(harvest!.label).toContain('récolter')
  })
})

describe('R10 — Alerte gel', () => {
  it('triggers frost alert when tempMin < 2°C and frostSensitivity HIGH', () => {
    const ctx = makeCtx(
      {},
      { frostSensitivity: 'HIGH' },
      {
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(NOW.getTime() + i * DAY).toISOString().slice(0, 10),
          tempMax: 5,
          tempMin: i === 0 ? -1 : 8,
          precipSum: 0,
          precipProbabilityMax: 0,
        })),
      },
    )
    const actions = engine.evaluate([ctx])
    const frost = actions.find((a) => a.id.startsWith('r10-'))
    expect(frost).toBeDefined()
    expect(frost!.priority).toBe('high')
    expect(frost!.label).toContain('Gel')

    const alerts = engine.generateAlerts([ctx])
    const gelAlert = alerts.find((a) => a.type === 'gel')
    expect(gelAlert).toBeDefined()
    expect(gelAlert!.severity).toBe('high')
  })
})

describe('evaluateGarden — sorting & aggregation', () => {
  it('returns actions sorted high → medium → low across 3 plants', () => {
    // Plant 1: overdue watering (high)
    const ctx1 = makeCtx({ id: 'p1', lastWateredAt: daysAgo(10) } as any)
    // Plant 2: harvest (high)
    const ctx2: PlantContext = {
      instance: makeInstance(
        { id: 'p2' } as any,
        { harvestMonthsStart: 4, harvestMonthsEnd: 6 },
      ),
      garden: makeGarden(),
      weather: makeWeather(),
      currentDate: NOW,
    }
    // Plant 3: repotting (low)
    const ctx3: PlantContext = {
      instance: makeInstance(
        { id: 'p3', containerSizeLiters: 5 } as any,
        { repottingSeasons: '["SPRING"]' },
      ),
      garden: makeGarden(),
      weather: makeWeather(),
      currentDate: NOW,
    }

    const result = engine.evaluateGarden([ctx1, ctx2, ctx3], 'garden-1')

    expect(result.gardenId).toBe('garden-1')
    expect(result.actions.length).toBeGreaterThanOrEqual(3)
    expect(result.adviceByPlant).toHaveLength(3)

    // Verify sorting: first actions should be high priority
    const priorities = result.actions.map((a) => a.priority)
    const highIdx = priorities.indexOf('high')
    const lowIdx = priorities.lastIndexOf('low')
    if (highIdx !== -1 && lowIdx !== -1) {
      expect(highIdx).toBeLessThan(lowIdx)
    }
  })
})
