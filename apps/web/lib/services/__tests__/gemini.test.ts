import { beforeEach, describe, expect, it, vi } from 'vitest'

// Socle partagé par l'identification et le diagnostic : ce qu'il refuse (image
// trop lourde, format inconnu) et son repli d'un modèle à l'autre valent pour
// les deux features à la fois.

const generateContent = vi.hoisted(() => vi.fn())
const getGenerativeModel = vi.hoisted(() => vi.fn(() => ({ generateContent })))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel
  },
}))

const {
  GEMINI_MODELS,
  MAX_IMAGE_BYTES,
  estimateBase64Bytes,
  generateJson,
  parseDataUrl,
  parseImagePayload,
  stripFence,
} = await import('../gemini')

const { ServiceError } = await import('../errors')

/** Un data URL dont la charge base64 pèse approximativement `bytes` octets. */
function imageOf(bytes: number): string {
  return `data:image/jpeg;base64,${'A'.repeat(Math.ceil((bytes * 4) / 3))}`
}

function reply(text: string, finishReason = 'STOP') {
  return { response: { text: () => text, candidates: [{ finishReason }] } }
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('parseDataUrl', () => {
  it('sépare le type MIME de la charge base64', () => {
    expect(parseDataUrl('data:image/png;base64,QUJD')).toEqual({
      mimeType: 'image/png',
      data: 'QUJD',
    })
  })

  it("rend null sur un data URL qui n'est pas une image", () => {
    expect(parseDataUrl('data:application/pdf;base64,QUJD')).toBeNull()
    expect(parseDataUrl('data:image/png;base64,')).toBeNull()
  })
})

describe('estimateBase64Bytes', () => {
  it('tient compte du padding', () => {
    expect(estimateBase64Bytes('QUJD')).toBe(3) // "ABC"
    expect(estimateBase64Bytes('QUI=')).toBe(2) // "AB"
    expect(estimateBase64Bytes('QQ==')).toBe(1) // "A"
  })
})

describe('parseImagePayload', () => {
  it('accepte un data URL image valide', () => {
    expect(parseImagePayload('data:image/webp;base64,QUJD')).toEqual({
      mimeType: 'image/webp',
      data: 'QUJD',
    })
  })

  it('refuse ce qui n’est pas une chaîne data:image/', () => {
    for (const bad of [null, 42, {}, 'QUJD', 'https://exemple.fr/photo.jpg']) {
      expect(() => parseImagePayload(bad)).toThrow(ServiceError)
    }
  })

  it('refuse un data URL image malformé', () => {
    expect(() => parseImagePayload('data:image/jpeg,pas-de-base64')).toThrow(
      /Format d'image non reconnu/,
    )
  })

  it('refuse une image au-delà de 4 Mo', () => {
    expect(() => parseImagePayload(imageOf(MAX_IMAGE_BYTES + 1024))).toThrow(/trop volumineuse/)
    expect(() => parseImagePayload(imageOf(MAX_IMAGE_BYTES - 1024))).not.toThrow()
  })
})

describe('stripFence', () => {
  it('retire la clôture markdown que le modèle ajoute parfois', () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('laisse intact un JSON déjà nu', () => {
    expect(stripFence('  {"a":1}  ')).toBe('{"a":1}')
  })
})

describe('generateJson', () => {
  const parts = [{ text: 'prompt' }]
  const options = { apiKey: 'clé', maxOutputTokens: 1500, logLabel: 'test' }

  it('rend le texte brut et le modèle qui a répondu', async () => {
    generateContent.mockResolvedValueOnce(reply('{"ok":true}'))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: true,
      raw: '{"ok":true}',
      model: GEMINI_MODELS[0],
    })
    expect(generateContent).toHaveBeenCalledOnce()
    expect(generateContent).toHaveBeenCalledWith(parts)
  })

  it('demande du JSON à température nulle, sans laisser le modèle penser', async () => {
    generateContent.mockResolvedValueOnce(reply('{}'))
    await generateJson(parts, options)

    expect(getGenerativeModel).toHaveBeenCalledWith({
      model: GEMINI_MODELS[0],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
        // Les jetons de réflexion s'imputent sur `maxOutputTokens` : les
        // laisser courir faisait revenir la réponse tronquée en plein JSON.
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  })

  it('rejette une réponse tronquée et tente le modèle suivant', async () => {
    generateContent
      .mockResolvedValueOnce(reply('{"summary":"coupé au mil', 'MAX_TOKENS'))
      .mockResolvedValueOnce(reply('{"ok":1}'))

    // Le SDK ne lève pas sur une troncature : sans contrôle explicite, ce JSON
    // coupé partait tel quel à l'appelant et le repli ne jouait jamais.
    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: true,
      raw: '{"ok":1}',
      model: GEMINI_MODELS[1],
    })
  })

  it('échoue proprement quand tous les modèles tronquent', async () => {
    generateContent.mockResolvedValue(reply('{"a":', 'MAX_TOKENS'))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: false,
      reason: "Erreur d'analyse, veuillez réessayer.",
    })
    expect(generateContent).toHaveBeenCalledTimes(GEMINI_MODELS.length)
  })

  it('passe au modèle suivant quand le premier est saturé (503)', async () => {
    generateContent.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(reply('{"ok":1}'))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: true,
      raw: '{"ok":1}',
      model: GEMINI_MODELS[1],
    })
  })

  it('passe au modèle suivant sur un quota dépassé (429)', async () => {
    generateContent.mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce(reply('{}'))

    await expect(generateJson(parts, options)).resolves.toMatchObject({
      ok: true,
      model: GEMINI_MODELS[1],
    })
  })

  it("n'insiste pas sur une erreur non transitoire", async () => {
    generateContent.mockRejectedValue(httpError(400))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: false,
      reason: "Erreur d'analyse, veuillez réessayer.",
    })
    expect(generateContent).toHaveBeenCalledOnce()
  })

  it('rend le message de surcharge quand tous les modèles sont saturés', async () => {
    generateContent.mockRejectedValue(httpError(503))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: false,
      reason: 'Service Gemini momentanément surchargé. Veuillez réessayer dans quelques instants.',
    })
    expect(generateContent).toHaveBeenCalledTimes(GEMINI_MODELS.length)
  })

  it('rend le message de quota quand le dernier échec est un 429', async () => {
    generateContent.mockRejectedValue(httpError(429))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: false,
      reason: 'Quota Gemini dépassé pour le moment. Veuillez réessayer plus tard.',
    })
  })

  it('ne lève jamais, même sur une erreur sans statut', async () => {
    generateContent.mockRejectedValue(new Error('réseau coupé'))

    await expect(generateJson(parts, options)).resolves.toMatchObject({ ok: false })
  })
})
