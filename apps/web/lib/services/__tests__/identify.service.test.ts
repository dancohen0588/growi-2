import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ces tests n'existaient pas avant l'extraction de `gemini.ts` : ils fixent le
// comportement observable de l'identification pour que la factorisation, puis
// le diagnostic qui s'y greffe, ne le déplacent pas à notre insu.

const generateContent = vi.hoisted(() => vi.fn())

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent }
    }
  },
}))

const plantService = vi.hoisted(() => ({ findCatalogMatch: vi.fn() }))
vi.mock('@/lib/services/plant.service', () => plantService)

const { identifyPlant } = await import('../identify.service')
const { ServiceError } = await import('../errors')

const IMAGE = 'data:image/jpeg;base64,QUJD'

const SUCCESS = {
  identified: true,
  confidence: 'high',
  commonName: 'Basilic',
  scientificName: 'Ocimum basilicum',
  family: 'Lamiaceae',
  emoji: '🌿',
  shortDescription: 'Une aromatique généreuse.',
  careGuide: {
    watering: 'Régulier',
    light: 'Plein soleil',
    soil: 'Drainant',
    temperature: '15-30 °C',
    difficulty: 'easy',
  },
  funFact: 'Son parfum change selon l’heure de la cueillette.',
  warnings: [],
  tags: ['aromatique'],
}

function reply(payload: unknown) {
  return {
    response: { text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.GEMINI_API_KEY = 'clé-de-test'
  plantService.findCatalogMatch.mockResolvedValue(null)
})

it('exige la clé API avant même de regarder l’image', async () => {
  delete process.env.GEMINI_API_KEY

  await expect(identifyPlant(IMAGE)).rejects.toThrow(ServiceError)
  expect(generateContent).not.toHaveBeenCalled()
})

it('refuse une image invalide sans appeler le modèle', async () => {
  await expect(identifyPlant('pas-une-image')).rejects.toThrow(/Image invalide/)
  expect(generateContent).not.toHaveBeenCalled()
})

it('envoie le prompt système puis l’image', async () => {
  generateContent.mockResolvedValueOnce(reply(SUCCESS))
  await identifyPlant(IMAGE)

  const parts = generateContent.mock.calls[0][0]
  expect(parts[0].text).toContain('expert botaniste')
  expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })
})

describe('résultat', () => {
  it('rapproche l’identification d’une fiche de l’encyclopédie', async () => {
    generateContent.mockResolvedValueOnce(reply(SUCCESS))
    plantService.findCatalogMatch.mockResolvedValue({ slug: 'basilic', commonName: 'Basilic' })

    await expect(identifyPlant(IMAGE)).resolves.toMatchObject({
      identified: true,
      commonName: 'Basilic',
      encyclopediaSlug: 'basilic',
      encyclopediaName: 'Basilic',
    })
    expect(plantService.findCatalogMatch).toHaveBeenCalledWith('Basilic', 'Ocimum basilicum')
  })

  it('accepte une réponse enveloppée dans une clôture markdown', async () => {
    generateContent.mockResolvedValueOnce(reply(`\`\`\`json\n${JSON.stringify(SUCCESS)}\n\`\`\``))

    await expect(identifyPlant(IMAGE)).resolves.toMatchObject({ identified: true })
  })

  it('reste exploitable quand l’encyclopédie est en panne', async () => {
    generateContent.mockResolvedValueOnce(reply(SUCCESS))
    plantService.findCatalogMatch.mockRejectedValue(new Error('base injoignable'))

    await expect(identifyPlant(IMAGE)).resolves.toMatchObject({
      identified: true,
      encyclopediaSlug: null,
      encyclopediaName: null,
    })
  })

  it('ne cherche pas de fiche quand le modèle n’a pas identifié', async () => {
    generateContent.mockResolvedValueOnce(reply({ identified: false, reason: 'Photo floue' }))

    await expect(identifyPlant(IMAGE)).resolves.toEqual({
      identified: false,
      reason: 'Photo floue',
      encyclopediaSlug: null,
      encyclopediaName: null,
    })
    expect(plantService.findCatalogMatch).not.toHaveBeenCalled()
  })
})

describe('échecs du modèle', () => {
  it('rend un échec explicatif sur un JSON cassé, sans lever', async () => {
    generateContent.mockResolvedValueOnce(reply('{ ceci n’est pas du JSON'))

    await expect(identifyPlant(IMAGE)).resolves.toEqual({
      identified: false,
      reason: "Erreur d'analyse, veuillez réessayer.",
      encyclopediaSlug: null,
      encyclopediaName: null,
    })
  })

  it('rend le message de surcharge quand Gemini est saturé', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 503 }))

    await expect(identifyPlant(IMAGE)).resolves.toMatchObject({
      identified: false,
      reason: expect.stringContaining('surchargé'),
    })
  })
})
