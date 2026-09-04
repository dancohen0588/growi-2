import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))
const authMock = vi.hoisted(() => ({ auth: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/auth', () => authMock)

const { isAdminRole, isUserRole, requireAdmin } = await import('../auth')
const { ServiceError } = await import('@/lib/services/errors')

const ADMIN = {
  id: 'user_admin',
  email: 'dan@growi-garden.fr',
  name: 'Dan',
  role: 'ADMIN',
  disabledAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

function sessionOf(userId: string | null, role = 'ADMIN') {
  return userId ? { user: { id: userId, role } } : null
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'AUCUNE_ERREUR'
  } catch (err) {
    return err instanceof ServiceError ? err.code : 'AUTRE_ERREUR'
  }
}

describe('isUserRole / isAdminRole', () => {
  it('ne reconnaît que les valeurs du domaine', () => {
    expect(isUserRole('ADMIN')).toBe(true)
    expect(isUserRole('USER')).toBe(true)
    expect(isUserRole('admin')).toBe(false)
    expect(isUserRole('SUPPORT')).toBe(false)
    expect(isUserRole(undefined)).toBe(false)
  })

  it('ne tient pour administrateur que la valeur exacte', () => {
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('admin')).toBe(false)
    expect(isAdminRole('USER')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })
})

describe('requireAdmin', () => {
  it('renvoie l’identité de l’administrateur', async () => {
    authMock.auth.mockResolvedValue(sessionOf(ADMIN.id))
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)

    await expect(requireAdmin()).resolves.toEqual({
      id: ADMIN.id,
      email: ADMIN.email,
      name: ADMIN.name,
    })
  })

  it('refuse une requête anonyme', async () => {
    authMock.auth.mockResolvedValue(null)

    expect(await codeOf(requireAdmin())).toBe('UNAUTHENTICATED')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un compte sans le rôle', async () => {
    authMock.auth.mockResolvedValue(sessionOf('user_1', 'USER'))
    prismaMock.user.findUnique.mockResolvedValue({ ...ADMIN, id: 'user_1', role: 'USER' })

    expect(await codeOf(requireAdmin())).toBe('FORBIDDEN')
  })

  it('refuse un administrateur désactivé', async () => {
    authMock.auth.mockResolvedValue(sessionOf(ADMIN.id))
    prismaMock.user.findUnique.mockResolvedValue({ ...ADMIN, disabledAt: new Date() })

    expect(await codeOf(requireAdmin())).toBe('FORBIDDEN')
  })

  it('refuse un compte supprimé dont la session court encore', async () => {
    authMock.auth.mockResolvedValue(sessionOf(ADMIN.id))
    prismaMock.user.findUnique.mockResolvedValue(null)

    expect(await codeOf(requireAdmin())).toBe('FORBIDDEN')
  })

  it("relit le rôle en base et ignore celui du JWT", async () => {
    // Le cas qui justifie la requête : le jeton dit ADMIN, la base dit USER.
    // Sans relecture, une rétrogradation resterait sans effet jusqu'à la
    // prochaine connexion.
    authMock.auth.mockResolvedValue(sessionOf(ADMIN.id, 'ADMIN'))
    prismaMock.user.findUnique.mockResolvedValue({ ...ADMIN, role: 'USER' })

    expect(await codeOf(requireAdmin())).toBe('FORBIDDEN')
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: ADMIN.id },
      select: { id: true, email: true, name: true, role: true, disabledAt: true },
    })
  })
})
