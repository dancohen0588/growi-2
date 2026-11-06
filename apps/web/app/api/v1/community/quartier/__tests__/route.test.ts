import { beforeEach, describe, expect, it, vi } from 'vitest'

const authContext = vi.hoisted(() => ({ requireUserId: vi.fn() }))
const quartierService = vi.hoisted(() => ({ getQuartier: vi.fn() }))
vi.mock('@/lib/api/auth-context', () => authContext)
vi.mock('@/lib/services/community/quartier.service', () => quartierService)

const route = await import('../route')
const { ServiceError } = await import('@/lib/services/errors')

beforeEach(() => {
  vi.clearAllMocks()
  authContext.requireUserId.mockResolvedValue('u1')
})

describe('GET /api/v1/community/quartier', () => {
  it('rend le quartier du compte, jamais en cache', async () => {
    quartierService.getQuartier.mockResolvedValue({ radiusKm: 20, gardeners: 9 })
    const response = await route.GET()
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ radiusKm: 20, gardeners: 9 })
    expect(quartierService.getQuartier).toHaveBeenCalledWith('u1')
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
  })

  it('403 sans profil public', async () => {
    quartierService.getQuartier.mockRejectedValue(new ServiceError('FORBIDDEN', 'Active ton profil public pour voir ton quartier.'))
    const response = await route.GET()
    expect(response.status).toBe(403)
  })
})
