import { afterEach, describe, expect, it, vi } from 'vitest'

// La route remonte volontairement une erreur : on double Sentry pour que rien
// ne parte, et pour vérifier au passage qu'elle est bien capturée.
const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException }))

const { GET } = await import('@/app/api/v1/debug/sentry/route')

const request = (token?: string) =>
  new Request('https://growi-garden.fr/api/v1/debug/sentry', {
    headers: token ? { 'x-debug-token': token } : {},
  })

afterEach(() => {
  delete process.env.DEBUG_TOKEN
  captureException.mockReset()
  vi.restoreAllMocks()
})

describe('GET /api/v1/debug/sentry', () => {
  it("répond 404 tant que DEBUG_TOKEN n'est pas posé", async () => {
    const response = await GET(request('peu importe'))
    expect(response.status).toBe(404)
  })

  it('répond 404, et non 401, sur un mauvais jeton', async () => {
    process.env.DEBUG_TOKEN = 'le-bon'

    // Un 401 dirait qu'il y a quelque chose à cette adresse.
    expect((await GET(request('le-mauvais'))).status).toBe(404)
    expect((await GET(request())).status).toBe(404)
    expect(captureException).not.toHaveBeenCalled()
  })

  it('lève, et remonte à Sentry, avec le bon jeton', async () => {
    process.env.DEBUG_TOKEN = 'le-bon'
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET(request('le-bon'))

    expect(response.status).toBe(500)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][1]).toEqual({
      tags: { route: '/api/v1/debug/sentry' },
    })
  })
})
