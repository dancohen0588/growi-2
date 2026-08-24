import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le diagnostic écrit dans l'historique d'un utilisateur et peut changer
// l'état de santé de sa plante : ce qu'il refuse d'écrire — analyse ratée,
// réponse hors schéma, plante d'un autre — compte autant que ce qu'il écrit.

const prismaMock = vi.hoisted(() => ({
  plantInstance: { findFirst: vi.fn() },
  diagnosis: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}))
const gemini = vi.hoisted(() => ({ generateJson: vi.fn() }))
const gardenWeather = vi.hoisted(() => ({ getGardenWeather: vi.fn() }))
const logService = vi.hoisted(() => ({ logHealth: vi.fn() }))
const storage = vi.hoisted(() => ({ uploadPhoto: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/garden-weather.service', () => gardenWeather)
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/storage', () => storage)

// Seul l'appel réseau est simulé : `parseImagePayload` et `stripFence` doivent
// s'exercer pour de vrai, ce sont eux qui gardent la porte.
vi.mock('@/lib/services/gemini', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/gemini')>()),
  generateJson: gemini.generateJson,
}))

const {
  applyDiagnosisStatus,
  buildDiagnosisContext,
  diagnosePlant,
  getDiagnosis,
  listDiagnoses,
} = await import('../diagnosis.service')
const { ServiceError } = await import('../errors')

const USER = 'user_1'
const PLANT = 'plant_1'
const IMAGE = 'data:image/jpeg;base64,QUJD'

const RESULT = {
  diagnosed: true,
  status: 'WARNING',
  confidence: 'medium',
  summary: 'Un stress hydrique probable.',
  observations: ['Feuilles basses jaunies'],
  probableCauses: [
    { label: 'Manque d’eau', likelihood: 'likely', explanation: 'Six jours sans arrosage.' },
  ],
  recommendations: [
    { action: 'Arrose ce soir', priority: 'urgent', timeframe: "aujourd'hui" },
    { action: 'Paille le pied', priority: 'soon', timeframe: 'cette semaine' },
  ],
  followUp: 'Reprends une photo dans 7 jours.',
}

function plant(overrides: Record<string, unknown> = {}) {
  return {
    id: PLANT,
    userId: USER,
    customName: 'Basilic du balcon',
    photoUrl: 'https://stockage.test/photo.jpg',
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
  }
}

function geminiReplies(payload: unknown, model = 'gemini-2.5-flash') {
  gemini.generateJson.mockResolvedValue({
    ok: true,
    raw: typeof payload === 'string' ? payload : JSON.stringify(payload),
    model,
  })
}

/** Le bloc CONTEXTE tel qu'il a été soumis au modèle lors du dernier appel. */
function submittedContext(): string {
  return gemini.generateJson.mock.calls.at(-1)![0][1].text
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.GEMINI_API_KEY = 'clé-de-test'

  prismaMock.plantInstance.findFirst.mockResolvedValue(plant())
  prismaMock.diagnosis.create.mockImplementation(({ data }: { data: unknown }) =>
    Promise.resolve({ id: 'diag_1', ...(data as object) }),
  )
  gardenWeather.getGardenWeather.mockRejectedValue(new ServiceError('INVALID_INPUT', 'sans position'))
  storage.uploadPhoto.mockResolvedValue({ url: 'https://stockage.test/diag.jpg', path: 'p' })
  geminiReplies(RESULT)
})

describe('garde-fous', () => {
  it('exige la clé API avant de toucher à la base', async () => {
    delete process.env.GEMINI_API_KEY

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).rejects.toThrow(ServiceError)
    expect(prismaMock.plantInstance.findFirst).not.toHaveBeenCalled()
  })

  it('refuse la plante d’un autre utilisateur', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).rejects.toThrow(
      /Plante introuvable/,
    )
    expect(gemini.generateJson).not.toHaveBeenCalled()
  })

  it('refuse une image invalide sans appeler le modèle', async () => {
    await expect(diagnosePlant(USER, PLANT, { imageBase64: 'pas-une-image' })).rejects.toThrow(
      /Image invalide/,
    )
    expect(gemini.generateJson).not.toHaveBeenCalled()
  })

  it('refuse `useExistingPhoto` quand la fiche n’a pas de photo', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(plant({ photoUrl: null }))

    await expect(diagnosePlant(USER, PLANT, { useExistingPhoto: true })).rejects.toThrow(
      /n'a pas encore de photo/,
    )
    expect(gemini.generateJson).not.toHaveBeenCalled()
  })
})

describe('assemblage du contexte', () => {
  it('soumet le prompt, le contexte, puis la photo — dans cet ordre', async () => {
    await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })

    const parts = gemini.generateJson.mock.calls[0][0]
    expect(parts[0].text).toContain('expert botaniste')
    expect(parts[1].text).toContain('CONTEXTE')
    expect(parts[2]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })
  })

  it('décrit la plante, sa fiche, son jardin et son journal', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(
      plant({
        healthStatus: 'WARNING',
        lastWateredAt: new Date('2026-08-18T10:00:00Z'),
        catalogPlant: {
          scientificName: 'Ocimum basilicum',
          sunExposure: 'FULL_SUN',
          wateringFreqDays: 2,
          minTempCelsius: 10,
          maxTempCelsius: 30,
          careTipDiseases: 'Oïdium, fonte des semis',
          frostSensitivity: 'HIGH',
          heatStressThresholdC: 32,
          soilTypes: 'Riche, drainant',
          careTipWatering: 'Garder frais',
        },
        garden: { type: 'BALCONY', soilType: 'POTTING', orientation: 'SUD', climateZone: 'H2', surfaceM2: 8 },
        careLogs: [
          { occurredAt: new Date('2026-08-18T10:00:00Z'), type: 'watering', note: 'copieux', productUsed: null },
          { occurredAt: new Date('2026-08-10T10:00:00Z'), type: 'fertilizing', note: null, productUsed: 'purin d’ortie' },
        ],
      }),
    )

    await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })
    const context = submittedContext()

    expect(context).toContain('PLANTE')
    expect(context).toContain('Basilic du balcon')
    expect(context).toContain('WARNING')
    expect(context).toContain('FICHE CATALOGUE')
    expect(context).toContain('Oïdium')
    expect(context).toContain('JARDIN')
    expect(context).toContain('BALCONY')
    expect(context).toContain("JOURNAL D'ENTRETIEN")
    expect(context).toContain('purin d’ortie')
  })

  it('exprime les derniers gestes en durée, pas en date brute', async () => {
    const now = new Date('2026-08-24T12:00:00Z')
    const context = await buildDiagnosisContext(
      USER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plant({ lastWateredAt: new Date('2026-08-18T12:00:00Z') }) as any,
      now,
    )

    expect(context).toContain('Dernier arrosage : il y a 6 jours')
  })

  it('n’invente pas de lignes pour un contexte absent', async () => {
    const context = await buildDiagnosisContext(
      USER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plant() as any,
      new Date('2026-08-24T12:00:00Z'),
    )

    expect(context).not.toContain('FICHE CATALOGUE')
    expect(context).not.toContain('JARDIN')
    expect(context).not.toContain("JOURNAL D'ENTRETIEN")
    expect(context).not.toContain('Dernier arrosage')
    expect(context).toContain('PLANTE')
  })

  it('inclut la météo quand elle répond', async () => {
    gardenWeather.getGardenWeather.mockResolvedValue({
      locationName: 'Lyon',
      current: { temperature: 34.2, humidity: 28 },
      forecast: [{ date: '2026-08-24', tempMin: 21, tempMax: 34, precipitationSum: 0 }],
      context: {
        gardenSeasonLabel: 'Plein été',
        climateZoneLabel: 'Continental',
        frostRisk: { label: 'Aucun risque' },
        wateringIndex: { score: 9, reasoning: 'Canicule et sol sec' },
      },
    })

    await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })
    const context = submittedContext()

    expect(context).toContain('MÉTÉO')
    expect(context).toContain('Lyon')
    expect(context).toContain('34 °C')
    expect(context).toContain('Plein été')
    expect(context).toContain('9/10')
  })

  it('diagnostique sans météo quand elle est en panne', async () => {
    gardenWeather.getGardenWeather.mockRejectedValue(new Error('Open-Meteo injoignable'))

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: true,
    })
    expect(submittedContext()).not.toContain('MÉTÉO')
  })
})

describe('diagnostic abouti', () => {
  it('persiste le résultat, sa photo et le modèle qui a répondu', async () => {
    const response = await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })

    expect(storage.uploadPhoto).toHaveBeenCalledWith(USER, 'diagnosis', expect.anything())
    expect(prismaMock.diagnosis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        plantInstanceId: PLANT,
        userId: USER,
        photoUrl: 'https://stockage.test/diag.jpg',
        status: 'WARNING',
        confidence: 'medium',
        summary: 'Un stress hydrique probable.',
        model: 'gemini-2.5-flash',
        payload: expect.objectContaining({ diagnosed: true }),
      }),
    })
    expect(response).toMatchObject({
      diagnosed: true,
      diagnosisId: 'diag_1',
      photoUrl: 'https://stockage.test/diag.jpg',
      currentHealthStatus: 'HEALTHY',
    })
  })

  it('dépose exactement les octets de l’image, et rien d’autre', async () => {
    // `Buffer.from(x, 'base64').buffer` rendrait le pool de 8 Ko de Node —
    // l'image noyée dedans, entourée des octets d'autres traitements.
    await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })

    const { bytes, contentType } = storage.uploadPhoto.mock.calls[0][2]
    expect(contentType).toBe('image/jpeg')
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([65, 66, 67])) // « ABC »
  })

  it('n’applique jamais le statut de lui-même', async () => {
    await diagnosePlant(USER, PLANT, { imageBase64: IMAGE })

    expect(logService.logHealth).not.toHaveBeenCalled()
  })

  it('réutilise la photo de la fiche sans la redéposer', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as unknown as typeof fetch

    try {
      const response = await diagnosePlant(USER, PLANT, { useExistingPhoto: true })

      expect(storage.uploadPhoto).not.toHaveBeenCalled()
      expect(response.photoUrl).toBe('https://stockage.test/photo.jpg')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('accepte une réponse enveloppée dans une clôture markdown', async () => {
    geminiReplies(`\`\`\`json\n${JSON.stringify(RESULT)}\n\`\`\``)

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: true,
    })
  })
})

describe('analyse impossible', () => {
  it('n’écrit rien quand le modèle rend un JSON cassé', async () => {
    geminiReplies('{ ceci n’est pas du JSON')

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: false,
      diagnosisId: null,
      photoUrl: null,
      currentHealthStatus: 'HEALTHY',
    })
    expect(prismaMock.diagnosis.create).not.toHaveBeenCalled()
    expect(storage.uploadPhoto).not.toHaveBeenCalled()
  })

  it('n’écrit rien quand la réponse est hors schéma', async () => {
    geminiReplies({ ...RESULT, status: 'MOURANTE' })

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: false,
    })
    expect(prismaMock.diagnosis.create).not.toHaveBeenCalled()
  })

  it('relaie le motif quand le modèle déclare lui-même ne pas pouvoir juger', async () => {
    geminiReplies({ diagnosed: false, reason: 'Reprends la photo en plein jour.' })

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: false,
      reason: 'Reprends la photo en plein jour.',
    })
    expect(prismaMock.diagnosis.create).not.toHaveBeenCalled()
  })

  it('relaie le message de surcharge sans lever', async () => {
    gemini.generateJson.mockResolvedValue({ ok: false, reason: 'Service Gemini momentanément surchargé.' })

    await expect(diagnosePlant(USER, PLANT, { imageBase64: IMAGE })).resolves.toMatchObject({
      diagnosed: false,
      reason: expect.stringContaining('surchargé'),
    })
    expect(prismaMock.diagnosis.create).not.toHaveBeenCalled()
  })
})

describe('application du statut', () => {
  const stored = {
    id: 'diag_1',
    plantInstanceId: PLANT,
    userId: USER,
    photoUrl: 'https://stockage.test/diag.jpg',
    status: 'WARNING',
    confidence: 'medium',
    summary: 'Un stress hydrique probable.',
    statusApplied: false,
    payload: RESULT,
    createdAt: new Date('2026-08-24T09:00:00Z'),
  }

  it('note un geste de santé et marque le diagnostic comme appliqué', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue(stored)

    await expect(applyDiagnosisStatus(USER, PLANT, 'diag_1')).resolves.toEqual({
      healthStatus: 'WARNING',
    })
    expect(logService.logHealth).toHaveBeenCalledWith(PLANT, USER, 'WARNING', {
      note: 'Un stress hydrique probable.',
      photoUrl: 'https://stockage.test/diag.jpg',
    })
    expect(prismaMock.diagnosis.update).toHaveBeenCalledWith({
      where: { id: 'diag_1' },
      data: { statusApplied: true },
    })
  })

  it('refuse un diagnostic qui n’est pas à l’utilisateur', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue(null)

    await expect(applyDiagnosisStatus(USER, PLANT, 'diag_1')).rejects.toThrow(
      /Diagnostic introuvable/,
    )
    expect(logService.logHealth).not.toHaveBeenCalled()
    expect(prismaMock.diagnosis.update).not.toHaveBeenCalled()
  })

  it('cherche le diagnostic sous la plante ET sous l’utilisateur', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue(stored)
    await applyDiagnosisStatus(USER, PLANT, 'diag_1')

    expect(prismaMock.diagnosis.findFirst).toHaveBeenCalledWith({
      where: { id: 'diag_1', plantInstanceId: PLANT, userId: USER },
    })
  })
})

describe('historique', () => {
  const row = {
    id: 'diag_1',
    plantInstanceId: PLANT,
    userId: USER,
    photoUrl: 'https://stockage.test/diag.jpg',
    status: 'WARNING',
    confidence: 'medium',
    summary: 'Un stress hydrique probable.',
    statusApplied: false,
    payload: RESULT,
    model: 'gemini-2.5-flash',
    createdAt: new Date('2026-08-24T09:00:00Z'),
  }

  it('rend la liste antichronologique, dates en ISO', async () => {
    prismaMock.diagnosis.findMany.mockResolvedValue([row])

    await expect(listDiagnoses(USER, PLANT)).resolves.toEqual([
      {
        id: 'diag_1',
        createdAt: '2026-08-24T09:00:00.000Z',
        photoUrl: 'https://stockage.test/diag.jpg',
        status: 'WARNING',
        confidence: 'medium',
        summary: 'Un stress hydrique probable.',
        statusApplied: false,
      },
    ])
    expect(prismaMock.diagnosis.findMany).toHaveBeenCalledWith({
      where: { plantInstanceId: PLANT },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('refuse de lister l’historique d’une plante qui n’est pas à l’utilisateur', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(listDiagnoses(USER, PLANT)).rejects.toThrow(/Plante introuvable/)
    expect(prismaMock.diagnosis.findMany).not.toHaveBeenCalled()
  })

  it('rend le résultat complet dans le détail', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue(row)

    await expect(getDiagnosis(USER, PLANT, 'diag_1')).resolves.toMatchObject({
      id: 'diag_1',
      plantInstanceId: PLANT,
      result: expect.objectContaining({ diagnosed: true, recommendations: expect.any(Array) }),
    })
  })

  it('signale un payload devenu illisible plutôt que de rendre du vide', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({ ...row, payload: { diagnosed: true } })

    await expect(getDiagnosis(USER, PLANT, 'diag_1')).rejects.toThrow(/illisible/)
  })
})
