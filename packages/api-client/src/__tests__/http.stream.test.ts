import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '@growi/shared'

import { createGrowiApiClient } from '../client'
import { ApiError } from '../errors'

// Le découpage du réseau n'a rien à voir avec celui des événements : un paquet
// peut couper une ligne en deux ou en apporter cinq d'un coup. Ces tests
// fragmentent volontairement le flux à des frontières absurdes — c'est là que
// se cassent les lecteurs SSE écrits à la légère.

const fetchMock = vi.fn<typeof fetch>()

function makeClient(overrides: Partial<Parameters<typeof createGrowiApiClient>[0]> = {}) {
  return createGrowiApiClient({ baseUrl: 'https://growi.test', fetch: fetchMock, ...overrides })
}

/**
 * Une réponse SSE dont le corps arrive dans les morceaux donnés.
 *
 * Les morceaux peuvent être des octets bruts : c'est le seul moyen de couper
 * au milieu d'un caractère, ce qu'une découpe de chaîne ne permet pas.
 */
function sseResponse(chunks: Array<string | Uint8Array>): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const MESSAGE = {
  id: 'msg_1',
  conversationId: 'conv_1',
  role: 'user',
  content: 'Bonjour',
  photoUrl: null,
  proposals: null,
  createdAt: '2026-09-01T10:00:00.000Z',
}

const META = `event: meta\ndata: ${JSON.stringify({ conversationId: 'conv_1', userMessage: MESSAGE })}\n\n`
const TEXT = (delta: string) => `event: text\ndata: ${JSON.stringify({ delta })}\n\n`
const DONE = `event: done\ndata: ${JSON.stringify({
  assistantMessage: { ...MESSAGE, id: 'msg_2', role: 'assistant' },
  quota: { limit: 20, used: 1, remaining: 19, resetsAt: '2026-09-02T00:00:00.000Z' },
})}\n\n`

async function collect(stream: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('lecture du flux', () => {
  it('rend les événements d’un flux bien découpé', async () => {
    fetchMock.mockResolvedValue(sseResponse([META, TEXT('Arrose '), TEXT('ce soir.'), DONE]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events.map((e) => e.event)).toEqual(['meta', 'text', 'text', 'done'])
  })

  it('recolle un événement coupé en deux paquets', async () => {
    const whole = TEXT('Arrose ce soir.')
    fetchMock.mockResolvedValue(sseResponse([whole.slice(0, 12), whole.slice(12), DONE]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events[0]).toEqual({ event: 'text', data: { delta: 'Arrose ce soir.' } })
  })

  it('sépare deux événements arrivés dans le même paquet', async () => {
    fetchMock.mockResolvedValue(sseResponse([META + TEXT('Salut.') + DONE]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events.map((e) => e.event)).toEqual(['meta', 'text', 'done'])
  })

  it('recolle un caractère accentué coupé au milieu de ses octets', async () => {
    // Un « é » pèse deux octets. Coupés entre deux paquets, un décodage naïf
    // en rendrait deux caractères de remplacement — et le JSON deviendrait
    // illisible. Le flux est donc découpé ici sur le premier octet du « é ».
    const bytes = new TextEncoder().encode(TEXT('Arrose été'))
    const cut = bytes.indexOf(0xc3) + 1

    fetchMock.mockResolvedValue(sseResponse([bytes.slice(0, cut), bytes.slice(cut)]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events[0]).toEqual({ event: 'text', data: { delta: 'Arrose été' } })
  })

  it('accepte un dernier bloc sans ligne vide finale', async () => {
    fetchMock.mockResolvedValue(sseResponse([META, DONE.trimEnd()]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events.map((e) => e.event)).toEqual(['meta', 'done'])
  })

  it('ignore les commentaires que certains proxys insèrent', async () => {
    fetchMock.mockResolvedValue(sseResponse([': ping\n\n', META, ': ping\n\n', DONE]))

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events.map((e) => e.event)).toEqual(['meta', 'done'])
  })

  it('ignore un événement que cette version ne connaît pas', async () => {
    // Un serveur plus récent doit pouvoir en ajouter sans casser les apps
    // déjà installées.
    fetchMock.mockResolvedValue(
      sseResponse([META, 'event: thinking\ndata: {"step":1}\n\n', DONE]),
    )

    const events = await collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))

    expect(events.map((e) => e.event)).toEqual(['meta', 'done'])
  })

  it('lève quand un événement connu est illisible', async () => {
    fetchMock.mockResolvedValue(sseResponse(['event: done\ndata: {"quota":"vingt"}\n\n']))

    await expect(collect(makeClient().chat.send('conv_1', { content: 'Bonjour' }))).rejects.toThrow(
      /illisible/,
    )
  })
})

describe('requête', () => {
  it('annonce qu’elle attend un flux et poste le message', async () => {
    fetchMock.mockResolvedValue(sseResponse([DONE]))

    await collect(makeClient().chat.send('conv 1', { content: 'Bonjour' }))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://growi.test/api/v1/conversations/conv%201/messages')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).accept).toBe('text/event-stream')
    expect(init.body).toBe(JSON.stringify({ content: 'Bonjour' }))
  })

  it('porte le jeton d’accès', async () => {
    fetchMock.mockResolvedValue(sseResponse([DONE]))

    await collect(
      makeClient({ getAccessToken: () => 'jeton' }).chat.send('conv_1', { content: 'Bonjour' }),
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer jeton')
  })
})

describe('erreurs', () => {
  it('lève le 429 du quota avant tout événement', async () => {
    // C'est la seule fenêtre où le serveur peut encore donner un statut :
    // l'appelant doit pouvoir l'attraper autour de sa boucle.
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'QUOTA_EXCEEDED', message: 'Tu as utilisé tes 20 messages du jour.' } },
        429,
      ),
    )

    const stream = makeClient().chat.send('conv_1', { content: 'Bonjour' })

    await expect(collect(stream)).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
      status: 429,
    })
  })

  it('rafraîchit le jeton et rejoue une fois sur 401', async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(true)
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401))
      .mockResolvedValueOnce(sseResponse([META, DONE]))

    const events = await collect(
      makeClient({ onUnauthorized }).chat.send('conv_1', { content: 'Bonjour' }),
    )

    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(events.map((e) => e.event)).toEqual(['meta', 'done'])
  })

  it('laisse remonter le 401 quand le rafraîchissement échoue', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401))

    const stream = makeClient({ onUnauthorized: async () => false }).chat.send('conv_1', {
      content: 'Bonjour',
    })

    await expect(collect(stream)).rejects.toMatchObject({ status: 401 })
  })

  it('rend une panne réseau en ApiError, comme les autres appels', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      collect(makeClient().chat.send('conv_1', { content: 'Bonjour' })),
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('signale une coupure survenue en cours de flux', async () => {
    // À la demande, et non d'un bloc : `controller.error()` vide la file, un
    // morceau déjà mis en attente ne serait donc jamais lu.
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(new TextEncoder().encode(META))
        else controller.error(new Error('connexion perdue'))
      },
    })
    fetchMock.mockResolvedValue(
      new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    )

    const events: ChatStreamEvent[] = []
    await expect(async () => {
      for await (const event of makeClient().chat.send('conv_1', { content: 'Bonjour' })) {
        events.push(event)
      }
    }).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    // Ce qui était arrivé avant la coupure reste acquis.
    expect(events.map((e) => e.event)).toEqual(['meta'])
  })

  it('lève quand le serveur répond 200 sans flux', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    await expect(
      collect(makeClient().chat.send('conv_1', { content: 'Bonjour' })),
    ).rejects.toThrow(/flux/)
  })
})
