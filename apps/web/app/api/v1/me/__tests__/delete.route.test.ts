import { beforeEach, describe, expect, it, vi } from 'vitest'

// La route ne décide rien : elle authentifie, valide le corps et transmet au
// service la date de connexion du jeton. Ces tests vérifient ce passage, et
// les statuts que le mobile lit.

const authContext = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  bearerAuthenticatedAt: vi.fn(),
}))
const userService = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/lib/api/auth-context', () => authContext)
vi.mock('@/lib/services/user.service', () => userService)

const { DELETE } = await import('../route')
const { ServiceError } = await import('@/lib/services/errors')

function request(body: unknown) {
  return new Request('https://growi.test/api/v1/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const LOGGED_IN_AT = new Date('2026-09-24T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  authContext.requireUserId.mockResolvedValue('u1')
  authContext.bearerAuthenticatedAt.mockResolvedValue(LOGGED_IN_AT)
  userService.deleteAccount.mockResolvedValue(undefined)
})

describe('DELETE /api/v1/me', () => {
  it('répond 204 et transmet la date de connexion du jeton', async () => {
    const response = await DELETE(request({ confirmation: 'SUPPRIMER', password: 'secret' }))

    expect(response.status).toBe(204)
    expect(userService.deleteAccount).toHaveBeenCalledWith(
      'u1',
      { confirmation: 'SUPPRIMER', password: 'secret' },
      { authenticatedAt: LOGGED_IN_AT },
    )
  })

  it('répond 400 sans le mot de confirmation, sans rien supprimer', async () => {
    const response = await DELETE(request({ confirmation: 'oui' }))

    expect(response.status).toBe(400)
    expect(userService.deleteAccount).not.toHaveBeenCalled()
  })

  it('répond 401 avec le message à afficher quand la connexion est trop ancienne', async () => {
    userService.deleteAccount.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Reconnecte-toi pour supprimer ton compte.'),
    )

    const response = await DELETE(request({ confirmation: 'SUPPRIMER' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: 'Reconnecte-toi pour supprimer ton compte.' },
    })
  })

  it('répond 401 sans session, avant de lire le corps', async () => {
    authContext.requireUserId.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Authentification requise'),
    )

    const response = await DELETE(request({ confirmation: 'SUPPRIMER' }))

    expect(response.status).toBe(401)
    expect(userService.deleteAccount).not.toHaveBeenCalled()
  })

  it('répond 403 pour le dernier administrateur', async () => {
    userService.deleteAccount.mockRejectedValue(
      new ServiceError('FORBIDDEN', 'Nomme un autre administrateur avant de supprimer ce compte.'),
    )

    const response = await DELETE(request({ confirmation: 'SUPPRIMER', password: 'x' }))

    expect(response.status).toBe(403)
  })
})
