import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hashRefreshToken, verifyAccessToken } from '@/lib/auth/tokens'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))
const userService = vi.hoisted(() => ({
  createUser: vi.fn(),
  verifyCredentials: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/user.service', () => userService)

const authService = await import('../auth.service')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const USER = { id: 'user_1', email: 'dan@growi.fr', firstName: 'Dan', name: 'Dan' }
const ORIGINAL_SECRET = process.env.JWT_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'secret-de-test-suffisamment-long-pour-hs256'
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops)
  prismaMock.refreshToken.create.mockResolvedValue({})
  prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET
})

function storedToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt_1',
    tokenHash: 'peu-importe',
    userId: USER.id,
    deviceInfo: 'iPhone 15',
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    createdAt: new Date(),
    user: USER,
    ...overrides,
  }
}

// ─── Connexion ─────────────────────────────────────────────────────────────

describe('login', () => {
  it('émet un couple de jetons exploitable', async () => {
    userService.verifyCredentials.mockResolvedValue(USER)

    const tokens = await authService.login({
      email: USER.email,
      password: 'motdepasse',
      deviceInfo: 'iPhone 15',
    })

    expect(tokens.tokenType).toBe('Bearer')
    expect(tokens.expiresIn).toBe(900)
    expect(tokens.user).toEqual({ id: 'user_1', email: 'dan@growi.fr', firstName: 'Dan' })
    await expect(verifyAccessToken(tokens.accessToken)).resolves.toBe('user_1')
  })

  it('ne stocke que l\'empreinte du refresh token', async () => {
    userService.verifyCredentials.mockResolvedValue(USER)

    const tokens = await authService.login({ email: USER.email, password: 'motdepasse' })

    const { data } = prismaMock.refreshToken.create.mock.calls[0][0]
    expect(data.tokenHash).toBe(hashRefreshToken(tokens.refreshToken))
    expect(data.tokenHash).not.toBe(tokens.refreshToken)
    expect(JSON.stringify(data)).not.toContain(tokens.refreshToken)
  })

  it('conserve la description de l\'appareil', async () => {
    userService.verifyCredentials.mockResolvedValue(USER)

    await authService.login({ email: USER.email, password: 'x', deviceInfo: 'Pixel 9' })

    expect(prismaMock.refreshToken.create.mock.calls[0][0].data.deviceInfo).toBe('Pixel 9')
  })

  it('refuse des identifiants faux sans révéler lequel est en cause', async () => {
    userService.verifyCredentials.mockResolvedValue(null)

    await expect(
      authService.login({ email: 'inconnu@growi.fr', password: 'x' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Email ou mot de passe incorrect',
    })
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled()
  })
})

// ─── Inscription ───────────────────────────────────────────────────────────

describe('register', () => {
  it('crée le compte puis ouvre la session', async () => {
    userService.createUser.mockResolvedValue({ id: USER.id })
    prismaMock.user.findUniqueOrThrow.mockResolvedValue(USER)

    const tokens = await authService.register({
      email: USER.email,
      password: 'motdepasse',
      firstName: 'Dan',
    })

    expect(userService.createUser).toHaveBeenCalledWith({
      email: USER.email,
      password: 'motdepasse',
      firstName: 'Dan',
    })
    await expect(verifyAccessToken(tokens.accessToken)).resolves.toBe('user_1')
  })

  it('laisse remonter le conflit d\'email sans créer de jeton', async () => {
    const { ServiceError } = await import('@/lib/services/errors')
    userService.createUser.mockRejectedValue(
      new ServiceError('CONFLICT', 'Un compte existe déjà avec cet email.'),
    )

    await expect(
      authService.register({ email: USER.email, password: 'x', firstName: 'Dan' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled()
  })
})

// ─── Rotation ──────────────────────────────────────────────────────────────

describe('refresh', () => {
  it('révoque l\'ancien jeton et en émet un nouveau, dans la même transaction', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(storedToken())

    const tokens = await authService.refresh('ancien-jeton')

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt_1' },
      data: { revokedAt: expect.any(Date) },
    })
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1)
    expect(tokens.refreshToken).not.toBe('ancien-jeton')
    await expect(verifyAccessToken(tokens.accessToken)).resolves.toBe('user_1')
  })

  it('cherche le jeton par son empreinte, jamais en clair', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(storedToken())

    await authService.refresh('ancien-jeton')

    expect(prismaMock.refreshToken.findUnique.mock.calls[0][0].where).toEqual({
      tokenHash: hashRefreshToken('ancien-jeton'),
    })
  })

  it('reporte la description de l\'appareil si elle n\'est pas fournie', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(storedToken())

    await authService.refresh('ancien-jeton')

    expect(prismaMock.refreshToken.create.mock.calls[0][0].data.deviceInfo).toBe('iPhone 15')
  })

  it('rejette un jeton inconnu', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null)

    await expect(authService.refresh('inventé')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('rejette un jeton expiré', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1000) }),
    )

    await expect(authService.refresh('périmé')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Jeton de rafraîchissement expiré',
    })
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled()
  })

  it('coupe TOUTES les sessions quand un jeton révoqué est rejoué', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(
      storedToken({ revokedAt: new Date(Date.now() - 60_000) }),
    )

    await expect(authService.refresh('jeton-volé')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })

    // La détection de rejeu doit révoquer la famille entière, pas seulement ce jeton.
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled()
  })
})

// ─── Déconnexion ───────────────────────────────────────────────────────────

describe('logout', () => {
  it('révoque le jeton présenté', async () => {
    await authService.logout('mon-jeton')

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashRefreshToken('mon-jeton'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('reste silencieux sur un jeton inconnu', async () => {
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 })
    await expect(authService.logout('inconnu')).resolves.toBeUndefined()
  })
})

describe('révocation globale', () => {
  it('ne touche que les jetons encore actifs de cet utilisateur', async () => {
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 3 })

    await expect(authService.revokeAllForUser('user_1')).resolves.toBe(3)
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
