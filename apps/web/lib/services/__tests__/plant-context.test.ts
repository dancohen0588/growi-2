import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le contexte est ce qui distingue un conseil utile d'un conseil générique :
// il est partagé par le diagnostic et le chat, et ce qu'il tait — une météo en
// panne, une section vide — compte autant que ce qu'il dit.

const prismaMock = vi.hoisted(() => ({ plantInstance: { findFirst: vi.fn() } }))
const gardenWeather = vi.hoisted(() => ({ getGardenWeather: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/garden-weather.service', () => gardenWeather)

const {
  CARE_LOG_NOTE_MAX,
  buildPlantContext,
  buildPlantContextText,
  contextBlock,
  daysSince,
  line,
  section,
} = await import('../plant-context')
const { ServiceError } = await import('../errors')

const USER = 'user_1'
const PLANT = 'plant_1'
const NOW = new Date('2026-08-24T12:00:00Z')

function plant(overrides: Record<string, unknown> = {}) {
  return {
    id: PLANT,
    userId: USER,
    customName: 'Basilic du balcon',
    photoUrl: null,
    healthStatus: 'HEALTHY',
    healthNote: null,
    location: 'OUTDOOR',
    growthStage: null,
    datePlanted: null,
    sunExposure: 'FULL_SUN',
    soilType: null,
    substrateType: null,
    containerSizeLiters: null,
    containerMaterial: null,
    lastWateredAt: null,
    lastFertilizedAt: null,
    lastPrunedAt: null,
    lastTreatedAt: null,
    lastRepottedAt: null,
    catalogPlant: null,
    garden: null,
    careLogs: [],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function careLog(overrides: Record<string, unknown> = {}) {
  return {
    type: 'WATERING',
    occurredAt: new Date('2026-08-20T08:00:00Z'),
    note: null,
    productUsed: null,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const WEATHER = {
  locationName: 'Lyon',
  current: { temperature: 34.2, humidity: 28 },
  forecast: [{ date: '2026-08-24', tempMin: 21, tempMax: 34, precipitationSum: 0 }],
  context: {
    gardenSeasonLabel: 'Plein été',
    climateZoneLabel: 'Continental',
    frostRisk: { label: 'Aucun risque' },
    wateringIndex: { score: 9, reasoning: 'Canicule et sol sec' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  gardenWeather.getGardenWeather.mockRejectedValue(new Error('pas d’adresse'))
})

describe('helpers de mise en forme', () => {
  it('n’écrit pas de ligne pour une valeur absente', () => {
    expect(line('Sol', null)).toBeNull()
    expect(line('Sol', undefined)).toBeNull()
    expect(line('Sol', '')).toBeNull()
    expect(line('Sol', 'argileux')).toBe('- Sol : argileux')
  })

  it('rend une section seulement si elle a du contenu', () => {
    expect(section('JARDIN', [null, null])).toBeNull()
    expect(section('JARDIN', [null, '- Sol : argileux'])).toBe('JARDIN\n- Sol : argileux')
  })

  it('dit les délais en français plutôt qu’en dates', () => {
    expect(daysSince(null, NOW)).toBeNull()
    expect(daysSince(new Date('2026-08-24T06:00:00Z'), NOW)).toBe("aujourd'hui")
    expect(daysSince(new Date('2026-08-23T06:00:00Z'), NOW)).toBe('hier')
    expect(daysSince(new Date('2026-08-18T12:00:00Z'), NOW)).toBe('il y a 6 jours')
  })
})

describe('buildPlantContextText', () => {
  it('décrit la plante et ses derniers gestes', async () => {
    const text = await buildPlantContextText(
      USER,
      plant({
        lastWateredAt: new Date('2026-08-18T12:00:00Z'),
        careLogs: [careLog({ note: 'Terre encore humide' })],
      }),
      NOW,
    )

    expect(text).toContain('PLANTE')
    expect(text).toContain('- Nom : Basilic du balcon')
    expect(text).toContain('- Dernier arrosage : il y a 6 jours')
    expect(text).toContain("JOURNAL D'ENTRETIEN (1 derniers gestes)")
    expect(text).toContain('- 2026-08-20 WATERING : Terre encore humide')
  })

  it('n’invente pas de lignes pour un contexte absent', async () => {
    const text = await buildPlantContextText(USER, plant(), NOW)

    expect(text).toContain('PLANTE')
    expect(text).not.toContain('FICHE CATALOGUE')
    expect(text).not.toContain('JARDIN')
    expect(text).not.toContain("JOURNAL D'ENTRETIEN")
    expect(text).not.toContain('Dernier arrosage')
  })

  it('inclut la météo quand elle répond', async () => {
    gardenWeather.getGardenWeather.mockResolvedValue(WEATHER)

    const text = await buildPlantContextText(USER, plant(), NOW)

    expect(text).toContain('MÉTÉO')
    expect(text).toContain('- Lieu : Lyon')
    expect(text).toContain('- Maintenant : 34 °C, humidité 28 %')
    expect(text).toContain('- Indice d’arrosage : 9/10 — Canicule et sol sec')
  })

  it('se passe de la météo quand elle échoue, sans faire échouer le reste', async () => {
    // Un utilisateur sans adresse, ou Open-Meteo en panne, ne doit jamais
    // empêcher un diagnostic ni une réponse du chat.
    const text = await buildPlantContextText(USER, plant(), NOW)

    expect(text).not.toContain('MÉTÉO')
    expect(text).toContain('PLANTE')
  })

  it('tronque la note d’un geste', async () => {
    // Une note est du texte libre qui atterrit dans l'instruction système :
    // la borner limite ce qu'une consigne glissée là peut peser.
    const long = 'a'.repeat(CARE_LOG_NOTE_MAX + 50)
    const text = await buildPlantContextText(USER, plant({ careLogs: [careLog({ note: long })] }), NOW)

    expect(text).toContain(`${'a'.repeat(CARE_LOG_NOTE_MAX)}…`)
    expect(text).not.toContain('a'.repeat(CARE_LOG_NOTE_MAX + 1))
  })

  it('laisse intacte une note courte', async () => {
    const text = await buildPlantContextText(USER, plant({ careLogs: [careLog({ note: 'Court' })] }), NOW)

    expect(text).toContain(': Court')
    expect(text).not.toContain('…')
  })

  it('rend les sections nues, sans en-tête — c’est `contextBlock` qui date le bloc', async () => {
    const text = await buildPlantContextText(USER, plant(), NOW)

    expect(text.startsWith('PLANTE')).toBe(true)
    expect(text).not.toContain('CONTEXTE')
    expect(contextBlock(text, NOW)).toBe(`CONTEXTE\nDate du jour : 2026-08-24\n\n${text}`)
  })
})

describe('buildPlantContext', () => {
  it('charge la plante de l’utilisateur et rend son contexte', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(plant())

    const bundle = await buildPlantContext(USER, PLANT, NOW)

    expect(prismaMock.plantInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLANT, userId: USER } }),
    )
    expect(bundle.plant.id).toBe(PLANT)
    expect(bundle.text).toContain('- Nom : Basilic du balcon')
  })

  it('refuse la plante d’un autre', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(buildPlantContext(USER, PLANT, NOW)).rejects.toThrow(ServiceError)
  })
})
