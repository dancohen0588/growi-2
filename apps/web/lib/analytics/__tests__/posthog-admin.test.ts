import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)

const { deletePostHogPerson } = await import('@/lib/analytics/posthog-admin')

// L'effacement de la personne PostHog suit la suppression du compte : il ne
// doit jamais la faire échouer, et chaque échec doit laisser de quoi le
// rattraper à la main.

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_test')
  vi.stubEnv('POSTHOG_PROJECT_ID', '270416')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('deletePostHogPerson', () => {
  it('retrouve la personne par son identifiant, puis la supprime avec ses événements', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ results: [{ id: 'person-uuid' }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    expect(await deletePostHogPerson('user_1')).toBe('deleted')

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://eu.posthog.com/api/projects/270416/persons/?distinct_id=user_1',
    )
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer phx_test' })
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1]
    expect(deleteUrl).toBe(
      'https://eu.posthog.com/api/projects/270416/persons/person-uuid/?delete_events=true',
    )
    expect(deleteInit.method).toBe('DELETE')
  })

  it("ne fait rien pour un compte qui n'a jamais été mesuré", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ results: [] }))

    expect(await deletePostHogPerson('user_1')).toBe('not_found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('saute sans clé, sans appel réseau', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '')

    expect(await deletePostHogPerson('user_1')).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("remonte l'échec à Sentry avec l'identifiant, sans lever", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(deletePostHogPerson('user_1')).resolves.toBe('failed')
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      'account_deletion_posthog_failed',
      expect.objectContaining({ extra: expect.objectContaining({ userId: 'user_1' }) }),
    )
  })

  it('ne lève pas non plus sur une panne réseau', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(deletePostHogPerson('user_1')).resolves.toBe('failed')
  })
})
