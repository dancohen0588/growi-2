import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { demoteAdmin, promoteAdmin } = await import('../roles')
const { ServiceError } = await import('@/lib/services/errors')

const USER = { id: 'user_1', email: 'jules@growi.fr', name: 'Jules', role: 'USER' }
const ADMIN = { id: 'user_2', email: 'dan@growi.fr', name: 'Dan', role: 'ADMIN' }

beforeEach(() => {
  vi.clearAllMocks()
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'AUCUNE_ERREUR'
  } catch (err) {
    return err instanceof ServiceError ? err.code : 'AUTRE_ERREUR'
  }
}

describe('promoteAdmin', () => {
  it('donne le rôle à un compte ordinaire', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, disabledAt: null })
    prismaMock.user.update.mockResolvedValue({ ...USER, role: 'ADMIN' })

    await expect(promoteAdmin(USER.id)).resolves.toMatchObject({ role: 'ADMIN' })
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER.id }, data: { role: 'ADMIN' } }),
    )
  })

  it('est idempotente sur un compte déjà administrateur', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...ADMIN, disabledAt: null })

    await expect(promoteAdmin(ADMIN.id)).resolves.toMatchObject({ role: 'ADMIN' })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await codeOf(promoteAdmin('inconnu'))).toBe('NOT_FOUND')
  })

  it('refuse un compte désactivé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, disabledAt: new Date() })
    expect(await codeOf(promoteAdmin(USER.id))).toBe('CONFLICT')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('demoteAdmin', () => {
  it('retire le rôle quand il reste un autre administrateur', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)
    prismaMock.user.count.mockResolvedValue(2)
    prismaMock.user.update.mockResolvedValue({ ...ADMIN, role: 'USER' })

    await expect(demoteAdmin(ADMIN.id, 'autre_admin')).resolves.toMatchObject({ role: 'USER' })
  })

  it('refuse de retirer le dernier administrateur', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)
    prismaMock.user.count.mockResolvedValue(1)

    expect(await codeOf(demoteAdmin(ADMIN.id, 'autre_admin'))).toBe('CONFLICT')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuse qu’un administrateur se rétrograde lui-même', async () => {
    expect(await codeOf(demoteAdmin(ADMIN.id, ADMIN.id))).toBe('CONFLICT')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('ne compte pas les administrateurs pour un compte qui n’en est pas un', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)

    await expect(demoteAdmin(USER.id, ADMIN.id)).resolves.toMatchObject({ role: 'USER' })
    expect(prismaMock.user.count).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
