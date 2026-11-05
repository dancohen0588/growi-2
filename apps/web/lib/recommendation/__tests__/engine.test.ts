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

  it('annonce le prochain arrosage quand la plante vient d\'être arrosée', () => {
    const ctx = makeCtx({ lastWateredAt: NOW })
    const actions = engine.evaluate([ctx])

    // freq = 7 jours : rendez-vous dans une semaine, en priorité basse pour ne
    // pas concurrencer ce qui est dû aujourd'hui.
    const watering = actions.find((a) => a.type === 'arrosage')
    expect(watering).toBeDefined()
    expect(watering!.priority).toBe('low')
    expect(watering!.dueDate).toBe(
      new Date(NOW.getTime() + 7 * DAY).toISOString().slice(0, 10),
    )
  })

  it('se tait quand le prochain arrosage est au-delà de deux semaines', () => {
    const ctx = makeCtx({ lastWateredAt: NOW, wateringFreqDays: 30 })
    const actions = engine.evaluate([ctx])

    expect(actions.filter((a) => a.type === 'arrosage')).toHaveLength(0)
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
    // Une récolte est une bonne nouvelle, pas une urgence.
    expect(harvest!.priority).toBe('medium')
    expect(harvest!.label).toContain('récolter')
  })

  it('se tait une semaine après une récolte notée', () => {
    const ctx = makeCtx(
      { lastHarvestedAt: daysAgo(3) } as any,
      { harvestMonthsStart: 4, harvestMonthsEnd: 6 },
    )
    expect(engine.evaluate([ctx]).filter((a) => a.type === 'recolte')).toHaveLength(0)

    const old = makeCtx(
      { lastHarvestedAt: daysAgo(9) } as any,
      { harvestMonthsStart: 4, harvestMonthsEnd: 6 },
    )
    expect(engine.evaluate([old]).filter((a) => a.type === 'recolte')).toHaveLength(1)
  })

  it('couvre la saison en fenêtre, et se date sur la récolte attendue', () => {
    const season = engine
      .evaluate([makeCtx({}, { harvestMonthsStart: 4, harvestMonthsEnd: 6 })])
      .find((a) => a.type === 'recolte')
    expect(season!.kind).toBe('window')
    expect(season!.window).toEqual({ start: '2026-04-01', end: '2026-06-30' })

    const expected = engine
      .evaluate([
        makeCtx(
          { expectedHarvestDate: new Date('2026-04-20T10:00:00Z') } as any,
          { harvestMonthsStart: 4, harvestMonthsEnd: 6 },
        ),
      ])
      .find((a) => a.type === 'recolte')
    expect(expected!.kind).toBe('dated')
    expect(expected!.dueDate).toBe('2026-04-20')
  })
})

describe('actions à fenêtre — plus jamais « en retard »', () => {
  it('la taille saisonnière couvre les mois consécutifs du catalogue', () => {
    const action = engine
      .evaluate([makeCtx({}, { pruningMonths: '[3,4,9]' })])
      .find((a) => a.type === 'taille')

    expect(action!.kind).toBe('window')
    // Mars-avril se suivent, septembre non : la fenêtre s'arrête au 30 avril.
    expect(action!.window).toEqual({ start: '2026-04-01', end: '2026-04-30' })
    expect(action!.dueDate).toBe('2026-04-30')
    expect(action!.priority).toBe('low')
  })

  it('la taille en retard, elle, reste datée et prioritaire', () => {
    const action = engine
      .evaluate([makeCtx({ lastPrunedAt: daysAgo(400) }, { pruningMonths: '[4]' })])
      .find((a) => a.type === 'taille')

    expect(action!.kind).toBe('dated')
    expect(action!.priority).toBe('high')
    expect(action!.why).toContain('treize mois')
  })

  it('le rempotage et le traitement couvrent la saison entière', () => {
    const repotting = engine
      .evaluate([
        makeCtx({ containerSizeLiters: 5 } as any, { repottingSeasons: '["SPRING"]' }),
      ])
      .find((a) => a.type === 'rempotage')

    expect(repotting!.kind).toBe('window')
    expect(repotting!.window).toEqual({ start: '2026-03-01', end: '2026-05-31' })
  })
})

describe('gardes sur l’état de santé', () => {
  it('ne propose pas de fertiliser une plante en détresse', () => {
    const healthy = makeCtx({}, { fertilizerMonths: '4' })
    expect(engine.evaluate([healthy]).some((a) => a.type === 'fertilisation')).toBe(true)

    const critical = makeCtx({ healthStatus: 'CRITICAL' }, { fertilizerMonths: '4' })
    expect(engine.evaluate([critical]).some((a) => a.type === 'fertilisation')).toBe(false)
  })

  it('ne propose pas de rempoter une plante qui ne va pas bien', () => {
    const warning = makeCtx(
      { containerSizeLiters: 5, healthStatus: 'WARNING' } as any,
      { repottingSeasons: '["SPRING"]' },
    )
    expect(engine.evaluate([warning]).some((a) => a.type === 'rempotage')).toBe(false)
  })
})

describe('explications et cap par plante', () => {
  it('chaque action porte sa règle et son « pourquoi »', () => {
    const actions = engine.evaluate([makeCtx({ lastWateredAt: daysAgo(8) })])
    const watering = actions.find((a) => a.type === 'arrosage')!

    expect(watering.ruleId).toBe('r1-watering-standard')
    expect(watering.why).toContain('il y a 8 jours')
    expect(watering.kind).toBe('dated')
  })

  it('reprend le conseil catalogue pour dire comment faire', () => {
    const actions = engine.evaluate([
      makeCtx({ lastWateredAt: daysAgo(8) }, { careTipWatering: 'Arrose au pied, jamais le feuillage.' }),
    ])

    expect(actions.find((a) => a.type === 'arrosage')!.howTo).toBe(
      'Arrose au pied, jamais le feuillage.',
    )
  })

  it('ne garde que trois actions par plante, les plus prioritaires', () => {
    const ctx = makeCtx(
      { lastWateredAt: daysAgo(8), containerSizeLiters: 5 } as any,
      {
        pruningMonths: '[4]',
        fertilizerMonths: '4',
        repottingSeasons: '["SPRING"]',
        treatmentSeasons: '["SPRING"]',
        harvestMonthsStart: 4,
        harvestMonthsEnd: 6,
      },
    )
    const actions = engine.evaluate([ctx])

    expect(actions).toHaveLength(3)
    // L'arrosage du jour survit ; une fenêtre sans urgence ne le devance pas.
    expect(actions[0].type).toBe('arrosage')
    expect(actions[0].kind).toBe('dated')
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

// ─── Saisons, journal et nouvelles règles ──────────────────────────────────

import { gestureLabelForRule } from '../engine'

function at(
  date: Date,
  instanceOverrides?: Partial<PlantInstance>,
  catalogOverrides?: Partial<PlantCatalog>,
  weatherOverrides?: Partial<WeatherForecast>,
  ruleLogs?: Record<string, Date>,
): PlantContext {
  return { ...makeCtx(instanceOverrides, catalogOverrides, weatherOverrides), currentDate: date, ruleLogs }
}

function nights(tempMin: number, precipToday = 0): Partial<WeatherForecast> {
  return {
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: `d${i}`,
      tempMax: tempMin + 8,
      tempMin,
      precipSum: i === 0 ? precipToday : 0,
      precipProbabilityMax: 0,
    })),
  }
}

const NOV = new Date('2026-11-04T10:00:00')
const JAN = new Date('2027-01-12T10:00:00')
const MAY = new Date('2026-05-12T10:00:00')
const JUL = new Date('2026-07-08T10:00:00')

function before(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY)
}

describe('R1 — rythme de saison', () => {
  it('espace l’arrosage d’une plante exposée en dormance', () => {
    const ctx = at(NOV, { lastWateredAt: before(NOV, 8), location: 'BALCONY' }, { dormancyMonths: '[11,12,1,2]' })
    const watering = engine.evaluate([ctx]).find((a) => a.type === 'arrosage')!

    // 7 jours × 3 = 21 : rien aujourd'hui, une annonce dans 13 jours.
    expect(watering.priority).toBe('low')
    expect(watering.dueDate > '2026-11-04').toBe(true)
    expect(watering.why).toContain('repos végétatif')
    expect(watering.why).toContain('21 jours')
  })

  it('espace moins à l’intérieur', () => {
    const ctx = at(
      NOV,
      { lastWateredAt: before(NOV, 11), location: 'INDOOR' },
      { dormancyMonths: '[11,12,1,2]' },
    )
    // 7 × 1,5 = 10,5 jours : onze jours, c'est dû.
    expect(engine.evaluate([ctx]).find((a) => a.type === 'arrosage')!.priority).toBe('high')
  })

  it('sans donnée, l’hiver espace au balcon et pas dedans', () => {
    const balcony = at(JAN, { lastWateredAt: before(JAN, 10), location: 'BALCONY' })
    expect(engine.evaluate([balcony]).find((a) => a.type === 'arrosage')!.priority).toBe('low')

    const indoor = at(JAN, { lastWateredAt: before(JAN, 10), location: 'INDOOR' })
    expect(engine.evaluate([indoor]).find((a) => a.type === 'arrosage')!.priority).toBe('high')
  })

  it('le réglage de l’utilisateur l’emporte sur la saison', () => {
    const ctx = at(
      NOV,
      { lastWateredAt: before(NOV, 8), customWateringAdjFactor: 1, location: 'BALCONY' },
      { dormancyMonths: '[11]' },
    )
    expect(engine.evaluate([ctx]).find((a) => a.type === 'arrosage')!.priority).toBe('high')
  })

  it('compte depuis l’ajout une plante jamais arrosée qui dort dehors', () => {
    // Ajoutée il y a 10 jours : prochain arrosage à J+11 (21 jours au rythme
    // d'hiver), annoncé ; ajoutée avant-hier, il est trop loin pour être dit.
    const added = at(NOV, { dateAdded: before(NOV, 10), location: 'BALCONY' }, { dormancyMonths: '[11]' })
    const watering = engine.evaluate([added]).find((a) => a.type === 'arrosage')!
    expect(watering.priority).toBe('low')
    expect(watering.dueDate).toBe('2026-11-15')

    const fresh = at(NOV, { dateAdded: before(NOV, 2), location: 'BALCONY' }, { dormancyMonths: '[11]' })
    expect(engine.evaluate([fresh]).some((a) => a.type === 'arrosage')).toBe(false)
  })
})

describe('R3 — la pluie, mais seulement pour ce qui la reçoit', () => {
  it('reporte après trois jours de pluie déjà tombée', () => {
    const ctx = makeCtx({ lastWateredAt: daysAgo(8) }, {}, { recentPrecipSum: 14 })
    const actions = engine.evaluate([ctx])
    expect(actions.find((a) => a.id.startsWith('r3-'))!.why).toContain('14 mm')
    expect(actions.find((a) => a.id.startsWith('r1-'))).toBeUndefined()
  })

  it('ne reporte pas l’arrosage d’une plante d’intérieur', () => {
    const ctx = makeCtx({ lastWateredAt: daysAgo(8), location: 'INDOOR' }, {}, nights(12, 20))
    const actions = engine.evaluate([ctx])
    expect(actions.find((a) => a.id.startsWith('r3-'))).toBeUndefined()
    expect(actions.find((a) => a.id.startsWith('r1-'))!.priority).toBe('high')
  })
})

describe('cap par plante', () => {
  it('un arrosage annoncé ne prend pas la place d’un geste du moment', () => {
    const ctx = makeCtx(
      { lastWateredAt: NOW, containerSizeLiters: 5 },
      {
        pruningMonths: '[4]',
        fertilizerMonths: '4',
        repottingSeasons: '["SPRING"]',
        treatmentSeasons: '["SPRING"]',
      },
    )
    const actions = engine.evaluate([ctx])
    const announced = actions.filter((a) => a.type === 'arrosage')

    expect(announced).toHaveLength(1)
    expect(announced[0].priority).toBe('low')
    // Trois gestes du moment, plus l'annonce.
    expect(actions.filter((a) => a.type !== 'arrosage')).toHaveLength(3)
  })
})

describe('R10 — alerte gel, version 2', () => {
  const frost = nights(-3)

  it('ne concerne que les plantes dehors', () => {
    const indoor = at(NOV, { location: 'INDOOR' }, { frostSensitivity: 'HIGH' }, frost)
    expect(engine.evaluate([indoor]).some((a) => a.ruleId === 'r10-frost-alert')).toBe(false)
    expect(engine.generateAlerts([indoor])).toHaveLength(0)
  })

  it('est un « autre geste » expliqué, plus un traitement', () => {
    const ctx = at(NOV, {}, { frostSensitivity: 'HIGH', winterProtectionType: 'FLEECE' }, frost)
    const action = engine.evaluate([ctx]).find((a) => a.ruleId === 'r10-frost-alert')!

    expect(action.type).toBe('autre')
    expect(action.kind).toBe('dated')
    expect(action.dueDate).toBe('2026-11-04')
    expect(action.why).toContain('-3 °C')
    expect(action.howTo).toContain('voile')
  })

  it('se tait trois jours après une protection posée', () => {
    const ctx = at(NOV, {}, { frostSensitivity: 'HIGH' }, frost, {
      'r10-frost-alert': before(NOV, 1),
    })
    expect(engine.evaluate([ctx]).some((a) => a.ruleId === 'r10-frost-alert')).toBe(false)
  })

  it('se tait pour une plante rentrée cet hiver', () => {
    const ctx = at(NOV, {}, { frostSensitivity: 'HIGH', winterProtectionType: 'INDOOR' }, frost, {
      'r14-winter-prep': before(NOV, 20),
    })
    expect(engine.evaluate([ctx]).some((a) => a.ruleId === 'r10-frost-alert')).toBe(false)
    expect(engine.generateAlerts([ctx])).toHaveLength(0)
  })
})

describe('R13 — paillage', () => {
  it('propose le paillage de printemps une fois dans la saison', () => {
    const ctx = at(MAY, {}, { mulchRecommended: true })
    const action = engine.evaluate([ctx]).find((a) => a.ruleId === 'r13-mulching')!
    expect(action.type).toBe('autre')
    expect(action.window).toEqual({ start: '2026-05-01', end: '2026-06-30' })

    const done = at(MAY, {}, { mulchRecommended: true }, undefined, {
      'r13-mulching': new Date('2026-05-03T10:00:00'),
    })
    expect(engine.evaluate([done]).some((a) => a.ruleId === 'r13-mulching')).toBe(false)
  })

  it('un paillage du printemps ne vaut pas pour l’automne', () => {
    const ctx = at(NOV, {}, { mulchRecommended: true }, undefined, {
      'r13-mulching': new Date('2026-05-03T10:00:00'),
    })
    expect(engine.evaluate([ctx]).some((a) => a.ruleId === 'r13-mulching')).toBe(true)
  })

  it('cède l’automne à l’hivernage quand celui-ci est un paillage', () => {
    const ctx = at(NOV, {}, { mulchRecommended: true, winterProtectionType: 'MULCH' })
    const actions = engine.evaluate([ctx])
    expect(actions.some((a) => a.ruleId === 'r13-mulching')).toBe(false)
    expect(actions.some((a) => a.ruleId === 'r14-winter-prep')).toBe(true)
  })

  it('ne concerne pas les plantes d’intérieur', () => {
    const ctx = at(MAY, { location: 'INDOOR' }, { mulchRecommended: true })
    expect(engine.evaluate([ctx]).some((a) => a.ruleId === 'r13-mulching')).toBe(false)
  })
})

describe('R14 — hivernage', () => {
  it('prépare l’hiver d’une plante dehors, selon sa protection', () => {
    const ctx = at(NOV, {}, { winterProtectionType: 'INDOOR' })
    const action = engine.evaluate([ctx]).find((a) => a.ruleId === 'r14-winter-prep')!
    expect(action.shortLabel).toBe('Rentrer')
    expect(action.kind).toBe('window')
    expect(action.window).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    expect(action.priority).toBe('low')
  })

  it('remonte quand le froid approche', () => {
    const ctx = at(NOV, {}, { winterProtectionType: 'FLEECE' }, nights(1))
    const action = engine.evaluate([ctx]).find((a) => a.ruleId === 'r14-winter-prep')!
    expect(action.priority).toBe('medium')
    expect(action.why).toContain('1 °C')
  })

  it('une fois par hiver, et rien pour ce qui est déjà à l’abri', () => {
    const done = at(new Date('2026-12-10T10:00:00'), {}, { winterProtectionType: 'FLEECE' }, undefined, {
      'r14-winter-prep': new Date('2026-10-20T10:00:00'),
    })
    expect(engine.evaluate([done]).some((a) => a.ruleId === 'r14-winter-prep')).toBe(false)

    const sheltered = at(NOV, { location: 'GREENHOUSE' }, { winterProtectionType: 'FLEECE' })
    expect(engine.evaluate([sheltered]).some((a) => a.ruleId === 'r14-winter-prep')).toBe(false)

    const none = at(NOV, {}, { winterProtectionType: 'NONE' })
    expect(engine.evaluate([none]).some((a) => a.ruleId === 'r14-winter-prep')).toBe(false)
  })
})

describe('R15 — fleurs fanées', () => {
  const flowers = { category: 'FLOWERS', floweringMonths: '[6,7,8]' }

  it('revient toutes les deux semaines pendant la floraison', () => {
    const fresh = at(JUL, {}, flowers)
    const action = engine.evaluate([fresh]).find((a) => a.ruleId === 'r15-deadheading')!
    expect(action.window).toEqual({ start: '2026-07-08', end: '2026-07-21' })

    const recent = at(JUL, {}, flowers, undefined, { 'r15-deadheading': before(JUL, 5) })
    expect(engine.evaluate([recent]).some((a) => a.ruleId === 'r15-deadheading')).toBe(false)

    const older = at(JUL, {}, flowers, undefined, { 'r15-deadheading': before(JUL, 20) })
    expect(engine.evaluate([older]).find((a) => a.ruleId === 'r15-deadheading')!.why).toContain(
      'il y a 20 jours',
    )
  })

  it('jamais sur une plante comestible ni sur un arbre', () => {
    const tomato = at(JUL, {}, { category: 'VEGETABLE', edible: true, floweringMonths: '[6,7]' })
    expect(engine.evaluate([tomato]).some((a) => a.ruleId === 'r15-deadheading')).toBe(false)

    const tree = at(JUL, {}, { category: 'TREES_SHRUBS', treeType: 'FRUIT', floweringMonths: '[7]' })
    expect(engine.evaluate([tree]).some((a) => a.ruleId === 'r15-deadheading')).toBe(false)

    const shrub = at(JUL, {}, { category: 'TREES_SHRUBS', treeType: 'SHRUB', floweringMonths: '[7]' })
    expect(engine.evaluate([shrub]).some((a) => a.ruleId === 'r15-deadheading')).toBe(true)
  })
})

describe('R16 — mise en place au jardin', () => {
  const seedling = { location: 'INDOOR' }
  const tomato = {
    category: 'VEGETABLE',
    outdoor: true,
    indoor: false,
    transplantMonths: '[5,6]',
    frostSensitivity: 'HIGH',
  }

  it('propose de sortir les plants quand les nuits le permettent', () => {
    const ctx = at(MAY, seedling, tomato, nights(12))
    const action = engine.evaluate([ctx]).find((a) => a.ruleId === 'r16-transplant')!
    expect(action.shortLabel).toBe('Mettre en terre')
    expect(action.window).toEqual({ start: '2026-05-01', end: '2026-06-30' })
  })

  it('attend des nuits plus douces pour une plante frileuse', () => {
    const ctx = at(MAY, seedling, tomato, nights(7))
    expect(engine.evaluate([ctx]).some((a) => a.ruleId === 'r16-transplant')).toBe(false)
  })

  it('se tait une fois fait, et pour une plante d’intérieur', () => {
    const done = at(MAY, seedling, tomato, nights(12), { 'r16-transplant': before(MAY, 3) })
    expect(engine.evaluate([done]).some((a) => a.ruleId === 'r16-transplant')).toBe(false)

    const houseplant = at(MAY, seedling, { ...tomato, indoor: true }, nights(12))
    expect(engine.evaluate([houseplant]).some((a) => a.ruleId === 'r16-transplant')).toBe(false)
  })
})

describe('R6/R7 — semis', () => {
  it('ne propose pas de semer une plante d’intérieur', () => {
    const ctx = at(new Date('2026-03-10T10:00:00'), { location: 'INDOOR' }, {
      category: 'INDOOR',
      sowingMonthsIndoor: '[3]',
    })
    expect(engine.evaluate([ctx]).some((a) => a.type === 'semis')).toBe(false)
  })

  it('se tait une fois semé dans la fenêtre', () => {
    const march = new Date('2026-03-10T10:00:00')
    const catalog = { category: 'VEGETABLE', sowingMonthsIndoor: '[3,4]' }
    expect(engine.evaluate([at(march, { location: 'INDOOR' }, catalog)]).some((a) => a.type === 'semis')).toBe(true)

    const sown = at(march, { location: 'INDOOR' }, catalog, undefined, {
      'r6-sowing-indoor': new Date('2026-03-02T10:00:00'),
    })
    expect(engine.evaluate([sown]).some((a) => a.type === 'semis')).toBe(false)
  })
})

describe('gestes nommés au journal', () => {
  it('donne un nom aux « autres gestes » du moteur', () => {
    expect(gestureLabelForRule('r13-mulching')).toBe('Paillage')
    expect(gestureLabelForRule('r14-winter-prep')).toBe('Hivernage')
    expect(gestureLabelForRule('r1-watering-standard')).toBeUndefined()
    expect(gestureLabelForRule(undefined)).toBeUndefined()
  })
})

describe('hiver : la pluie arrose la pleine terre', () => {
  it('ne propose pas d’arroser une plante en pleine terre de novembre à février', () => {
    const inGround = at(NOV, { lastWateredAt: before(NOV, 60) })
    expect(engine.evaluate([inGround]).some((a) => a.type === 'arrosage')).toBe(false)
  })

  it('garde l’arrosage des pots dehors, espacé', () => {
    const potted = at(NOV, { lastWateredAt: before(NOV, 20), containerSizeLiters: 10 })
    const watering = engine.evaluate([potted]).find((a) => a.type === 'arrosage')!
    expect(watering.priority).toBe('high')
    expect(watering.why).toContain('En hiver, dehors')
  })

  it('reprend au printemps', () => {
    const april = at(NOW, { lastWateredAt: daysAgo(8) })
    expect(engine.evaluate([april]).find((a) => a.type === 'arrosage')!.priority).toBe('high')
  })
})

describe('R17 — fin de saison des annuelles gélives', () => {
  const tomato = { category: 'VEGETABLE', frostSensitivity: 'HIGH', mulchRecommended: true, edible: true }

  it('remplace arrosage, paillage et protection par « arracher et composter »', () => {
    const ctx = at(NOV, { lastWateredAt: before(NOV, 30), containerSizeLiters: 20 }, tomato, nights(-2))
    const actions = engine.evaluate([ctx])

    expect(actions.map((a) => a.ruleId)).toEqual(['r17-end-of-season'])
    expect(actions[0].shortLabel).toBe('Fin de saison')
    expect(actions[0].window).toEqual({ start: '2026-11-01', end: '2026-12-31' })
    expect(engine.generateAlerts([ctx])).toHaveLength(0)
  })

  it('une fois, et jamais pour une tomate à l’intérieur', () => {
    const done = at(NOV, {}, tomato, undefined, { 'r17-end-of-season': before(NOV, 2) })
    expect(engine.evaluate([done]).some((a) => a.ruleId === 'r17-end-of-season')).toBe(false)

    const indoor = at(NOV, { location: 'INDOOR' }, tomato)
    expect(engine.evaluate([indoor]).some((a) => a.ruleId === 'r17-end-of-season')).toBe(false)
  })

  it('se tait en janvier, et ne touche pas une laitue qui supporte le froid', () => {
    expect(engine.evaluate([at(JAN, {}, tomato)])).toHaveLength(0)
    const lettuce = at(NOV, {}, { ...tomato, frostSensitivity: 'LIGHT' })
    expect(engine.evaluate([lettuce]).some((a) => a.ruleId === 'r17-end-of-season')).toBe(false)
  })
})
