import { afterEach, describe, expect, it, vi } from 'vitest'

// La route remonte volontairement une erreur : on double Sentry pour que rien
// ne parte, et pour vérifier au passage qu'elle est bien capturée.
const { captureException, getClient } = vi.hoisted(() => ({
  captureException: vi.fn(),
  getClient: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException, getClient }))

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

  it("rend l'état du SDK serveur sur ?check=1, sans révéler le DSN", async () => {
    process.env.DEBUG_TOKEN = 'le-bon'
    getClient.mockReturnValue({
      getOptions: () => ({
        dsn: 'https://clé@o1.ingest.de.sentry.io/2',
        enabled: true,
        environment: 'preview',
        release: 'abc1234',
      }),
    })

    const response = await GET(
      new Request('https://growi-garden.fr/api/v1/debug/sentry?check=1', {
        headers: { 'x-debug-token': 'le-bon' },
      }),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Record<string, unknown> }
    expect(body.data).toEqual({
      initialized: true,
      dsnConfigured: true,
      enabled: true,
      environment: 'preview',
      release: 'abc1234',
    })
    // Le DSN dit l'organisation et le projet : il n'a rien à faire dans une
    // réponse, fût-elle protégée par un jeton.
    expect(JSON.stringify(body)).not.toContain('ingest')
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
