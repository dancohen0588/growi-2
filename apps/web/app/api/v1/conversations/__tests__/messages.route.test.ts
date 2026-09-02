import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '@growi/shared'

// La route SSE : ce qui se joue ici est le cadrage des événements, les en-têtes
// qui empêchent un proxy de tout accumuler, et le fait qu'un refus (quota,
// image illisible) sorte encore en JSON — après l'ouverture du flux, il serait
// trop tard pour changer le statut.

const chatService = vi.hoisted(() => ({ sendMessage: vi.fn() }))
const authContext = vi.hoisted(() => ({ requireUserId: vi.fn() }))

vi.mock('@/lib/services/chat.service', () => chatService)
vi.mock('@/lib/api/auth-context', () => authContext)

const { POST } = await import('../[id]/messages/route')
const { ServiceError } = await import('@/lib/services/errors')

const CONV = 'conv_1'
const CONTEXT = { params: { id: CONV } }

function request(body: unknown) {
  return new Request('https://growi.test/api/v1/conversations/conv_1/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function streamOf(events: ChatStreamEvent[]) {
  return {
    conversationId: CONV,
    stream: () =>
      (async function* () {
        for (const event of events) yield event
      })(),
  }
}

const MESSAGE = {
  id: 'msg_1',
  conversationId: CONV,
  role: 'user' as const,
  content: 'Bonjour',
  photoUrl: null,
  proposals: null,
  createdAt: '2026-09-01T10:00:00.000Z',
}

/** Les événements SSE relus depuis le corps de la réponse. */
async function readEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text()
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n')
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')),
      }
    })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  authContext.requireUserId.mockResolvedValue('user_1')
})

describe('POST /api/v1/conversations/[id]/messages', () => {
  it('rend les événements dans l’ordre du protocole', async () => {
    chatService.sendMessage.mockResolvedValue(
      streamOf([
        { event: 'meta', data: { conversationId: CONV, userMessage: MESSAGE } },
        { event: 'text', data: { delta: 'Arrose ' } },
        { event: 'text', data: { delta: 'ce soir.' } },
        {
          event: 'done',
          data: {
            assistantMessage: { ...MESSAGE, id: 'msg_2', role: 'assistant' as const },
            quota: { limit: 20, used: 1, remaining: 19, resetsAt: '2026-09-02T00:00:00.000Z' },
          },
        },
      ]),
    )

    const response = await POST(request({ content: 'Bonjour' }), CONTEXT)
    const events = await readEvents(response)

    expect(response.status).toBe(200)
    expect(events.map((e) => e.event)).toEqual(['meta', 'text', 'text', 'done'])
    expect(events[1].data).toEqual({ delta: 'Arrose ' })
  })

  it('pose les en-têtes qui empêchent un proxy de tout accumuler', async () => {
    chatService.sendMessage.mockResolvedValue(streamOf([]))

    const response = await POST(request({ content: 'Bonjour' }), CONTEXT)

    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    expect(response.headers.get('cache-control')).toContain('no-transform')
    expect(response.headers.get('x-accel-buffering')).toBe('no')
  })

  it('répond 429 en JSON quand le quota est atteint', async () => {
    // Le refus arrive avant l'ouverture du flux : c'est la seule fenêtre où on
    // peut encore donner un statut au client.
    chatService.sendMessage.mockRejectedValue(
      new ServiceError('QUOTA_EXCEEDED', 'Tu as utilisé tes 20 messages du jour.'),
    )

    const response = await POST(request({ content: 'Bonjour' }), CONTEXT)

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'QUOTA_EXCEEDED' },
    })
  })

  it('refuse un message vide sans appeler le service', async () => {
    const response = await POST(request({ content: '   ' }), CONTEXT)

    expect(response.status).toBe(400)
    expect(chatService.sendMessage).not.toHaveBeenCalled()
  })

  it('exige une authentification', async () => {
    authContext.requireUserId.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Authentification requise'),
    )

    const response = await POST(request({ content: 'Bonjour' }), CONTEXT)

    expect(response.status).toBe(401)
  })
})
