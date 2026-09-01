import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '../gemini'

// Socle partagé par l'identification et le diagnostic : ce qu'il refuse (image
// trop lourde, format inconnu) et son repli d'un modèle à l'autre valent pour
// les deux features à la fois.

const generateContent = vi.hoisted(() => vi.fn())
const sendMessageStream = vi.hoisted(() => vi.fn())
const startChat = vi.hoisted(() => vi.fn(() => ({ sendMessageStream })))
const getGenerativeModel = vi.hoisted(() => vi.fn(() => ({ generateContent, startChat })))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel
  },
}))

const {
  CHAT_TEMPERATURE,
  GEMINI_MODELS,
  MAX_IMAGE_BYTES,
  estimateBase64Bytes,
  generateJson,
  parseDataUrl,
  parseImagePayload,
  streamChat,
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

    await generateJson(parts, options)

    expect(generateContent).toHaveBeenCalledOnce()
  })

  it('dit que la photo est illisible sur un 400, plutôt que « réessayez »', async () => {
    // Un 400 porte sur l'image : réessayer avec la même donnera le même
    // résultat, autant dire quoi changer.
    generateContent.mockRejectedValue(httpError(400))

    await expect(generateJson(parts, options)).resolves.toEqual({
      ok: false,
      reason: "Cette photo n'a pas pu être lue. Essaie une autre image, en JPEG ou PNG.",
    })
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

describe('streamChat', () => {
  const input = {
    apiKey: 'clé',
    systemInstruction: 'Tu es Growi.',
    history: [{ role: 'user' as const, parts: [{ text: 'bonjour' }] }],
    message: [{ text: 'et pour l’arrosage ?' }],
    maxOutputTokens: 700,
    logLabel: 'chat',
  }

  /** Un morceau de flux tel que le SDK le rend. */
  function chunk(text: string, calls?: Array<{ name: string; args: unknown }>) {
    return { text: () => text, functionCalls: () => calls }
  }

  /** Un flux qui rend ses morceaux, puis lève éventuellement. */
  function streamOf(chunks: Array<ReturnType<typeof chunk>>, thrown?: unknown) {
    return {
      stream: (async function* () {
        for (const c of chunks) yield c
        if (thrown) throw thrown
      })(),
    }
  }

  async function collect(events: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
    const out: ChatStreamEvent[] = []
    for await (const event of events) out.push(event)
    return out
  }

  it('rend les morceaux au fil de l’eau, puis le modèle qui a répondu', async () => {
    sendMessageStream.mockResolvedValueOnce(streamOf([chunk('Arrose '), chunk('ce soir.')]))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'text', delta: 'Arrose ' },
      { type: 'text', delta: 'ce soir.' },
      { type: 'done', model: GEMINI_MODELS[0] },
    ])
    expect(startChat).toHaveBeenCalledWith({ history: input.history })
    expect(sendMessageStream).toHaveBeenCalledWith(input.message)
  })

  it('converse au lieu d’extraire : température relevée, aucun format imposé', async () => {
    sendMessageStream.mockResolvedValueOnce(streamOf([chunk('ok')]))
    await collect(streamChat(input))

    // L'égalité est stricte, et c'est le point : `responseMimeType:
    // 'application/json'` rendrait du JSON là où le fil attend du texte.
    expect(getGenerativeModel).toHaveBeenCalledWith({
      model: GEMINI_MODELS[0],
      generationConfig: {
        temperature: CHAT_TEMPERATURE,
        maxOutputTokens: 700,
        thinkingConfig: { thinkingBudget: 0 },
      },
      systemInstruction: 'Tu es Growi.',
    })
  })

  it('déclare les outils au modèle et remonte leurs appels', async () => {
    const tools = [{ name: 'proposePlanTask', description: 'Propose une tâche' }]
    sendMessageStream.mockResolvedValueOnce(
      streamOf([
        chunk('Je te propose ça.'),
        chunk('', [{ name: 'proposePlanTask', args: { dueInDays: 1 } }]),
      ]),
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = await collect(streamChat({ ...input, tools: tools as any }))

    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ tools: [{ functionDeclarations: tools }] }),
    )
    expect(events).toContainEqual({
      type: 'functionCall',
      name: 'proposePlanTask',
      args: { dueInDays: 1 },
    })
  })

  it('passe au modèle suivant tant qu’aucun mot n’est parti', async () => {
    sendMessageStream
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(streamOf([chunk('Bonjour.')]))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'text', delta: 'Bonjour.' },
      { type: 'done', model: GEMINI_MODELS[1] },
    ])
  })

  it('ne rejoue pas un flux déjà commencé', async () => {
    // L'utilisateur a lu ces mots : les faire remplacer par ceux d'un autre
    // modèle donnerait une réponse qui se contredit sous ses yeux.
    sendMessageStream.mockResolvedValueOnce(streamOf([chunk('Arrose ')], httpError(503)))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'text', delta: 'Arrose ' },
      {
        type: 'error',
        reason: 'Service Gemini momentanément surchargé. Veuillez réessayer dans quelques instants.',
      },
    ])
    expect(sendMessageStream).toHaveBeenCalledOnce()
  })

  it('traite une réponse bloquée comme un échec', async () => {
    // `text()` lève quand la réponse est coupée pour sécurité ou récitation.
    const blocked = {
      text: () => {
        throw new Error('blocked: SAFETY')
      },
      functionCalls: () => undefined,
    }
    sendMessageStream.mockResolvedValue(streamOf([blocked]))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'error', reason: "Erreur d'analyse, veuillez réessayer." },
    ])
    // Une réponse bloquée le sera pareillement sur le modèle suivant.
    expect(sendMessageStream).toHaveBeenCalledOnce()
  })

  it('rend le message de quota quand tous les modèles sont saturés', async () => {
    sendMessageStream.mockRejectedValue(httpError(429))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'error', reason: 'Quota Gemini dépassé pour le moment. Veuillez réessayer plus tard.' },
    ])
    expect(sendMessageStream).toHaveBeenCalledTimes(GEMINI_MODELS.length)
  })

  it('ne lève jamais, même sur une erreur sans statut', async () => {
    sendMessageStream.mockRejectedValue(new Error('réseau coupé'))

    await expect(collect(streamChat(input))).resolves.toEqual([
      { type: 'error', reason: "Erreur d'analyse, veuillez réessayer." },
    ])
  })
})
