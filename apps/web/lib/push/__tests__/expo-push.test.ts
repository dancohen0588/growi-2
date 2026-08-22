import { describe, expect, it, vi } from 'vitest'

import { MAX_MESSAGES_PER_REQUEST, sendPushMessages } from '@/lib/push/expo-push'

// Deux règles d'Expo qu'on ne peut pas se permettre d'enfreindre : cent
// messages par requête, et un jeton mort qu'on supprime.

function message(to: string) {
  return { to, title: 'Titre', body: 'Corps' }
}

function ticketsResponse(tickets: unknown[]) {
  return new Response(JSON.stringify({ data: tickets }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('sendPushMessages', () => {
  it('ne fait aucun appel quand il n\'y a rien à envoyer', async () => {
    const fetchMock = vi.fn()

    const result = await sendPushMessages([], fetchMock as unknown as typeof fetch)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({ sent: 0, invalidTokens: [], failed: 0 })
  })

  it('découpe en lots de cent', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(init.body as string) as unknown[]
      return ticketsResponse(batch.map(() => ({ status: 'ok' })))
    })

    const messages = Array.from({ length: 250 }, (_, i) => message(`token-${i}`))
    const result = await sendPushMessages(messages, fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const sizes = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).length,
    )
    expect(sizes).toEqual([MAX_MESSAGES_PER_REQUEST, MAX_MESSAGES_PER_REQUEST, 50])
    expect(result.sent).toBe(250)
  })

  it('signale les jetons d\'appareils désinstallés', async () => {
    const fetchMock = vi.fn(async () =>
      ticketsResponse([
        { status: 'ok' },
        {
          status: 'error',
          message: 'not registered',
          details: { error: 'DeviceNotRegistered', expoPushToken: 'token-mort' },
        },
      ]),
    )

    const result = await sendPushMessages(
      [message('token-vivant'), message('token-mort')],
      fetchMock as unknown as typeof fetch,
    )

    expect(result.sent).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.invalidTokens).toEqual(['token-mort'])
  })

  it('ne supprime pas un jeton pour une erreur passagère', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () =>
      ticketsResponse([
        { status: 'error', message: 'trop de messages', details: { error: 'MessageRateExceeded' } },
      ]),
    )

    const result = await sendPushMessages([message('t1')], fetchMock as unknown as typeof fetch)

    expect(result.failed).toBe(1)
    expect(result.invalidTokens).toEqual([])
    consoleError.mockRestore()
  })

  it('survit à une panne réseau sans lever', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => {
      throw new Error('réseau coupé')
    })

    const result = await sendPushMessages(
      [message('t1'), message('t2')],
      fetchMock as unknown as typeof fetch,
    )

    expect(result).toEqual({ sent: 0, invalidTokens: [], failed: 2 })
    consoleError.mockRestore()
  })

  it('compte un lot refusé sans le confondre avec des jetons morts', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => new Response('nope', { status: 429 }))

    const result = await sendPushMessages([message('t1')], fetchMock as unknown as typeof fetch)

    expect(result.failed).toBe(1)
    expect(result.invalidTokens).toEqual([])
    consoleError.mockRestore()
  })
})
