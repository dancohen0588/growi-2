import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  adminAuditLog: { findMany: vi.fn() },
}))
const auditMock = vi.hoisted(() => ({ auditWrite: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/admin/audit', () => auditMock)

const { demoteAdmin, findAccountByEmail, listAdminsWithPromotion, promoteAdmin } = await import(
  '../roles'
)
const { ServiceError } = await import('@/lib/services/errors')

/** Client transactionnel factice, comme celui que passe le vrai `auditWrite`. */
const tx = { user: { update: vi.fn() } }

const ACTOR = 'admin_1'
const USER = {
  id: 'user_1',
  email: 'jules@growi.fr',
  name: 'Jules',
  firstName: 'Jules',
  lastName: null,
  role: 'USER',
  disabledAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}
const ADMIN = { ...USER, id: 'user_2', email: 'dan@growi.fr', name: 'Dan', role: 'ADMIN' }

beforeEach(() => {
  vi.clearAllMocks()
  tx.user.update.mockReset().mockImplementation(async ({ data }: { data: { role: string } }) => ({
    ...USER,
    role: data.role,
  }))
  auditMock.auditWrite.mockImplementation(
    async (write: (client: typeof tx) => Promise<unknown>) => write(tx),
  )
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
  it('donne le rôle et le journalise dans la même transaction', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)

    await expect(promoteAdmin(ACTOR, USER.id)).resolves.toMatchObject({ role: 'ADMIN' })

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER.id }, data: { role: 'ADMIN' } }),
    )
    expect(auditMock.auditWrite.mock.calls[0][1]).toMatchObject({
      actorId: ACTOR,
      action: 'admin.promote',
      targetId: USER.id,
    })
  })

  it('est idempotente sur un compte déjà administrateur, sans nouvelle trace', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)

    await expect(promoteAdmin(ACTOR, ADMIN.id)).resolves.toMatchObject({ role: 'ADMIN' })
    expect(auditMock.auditWrite).not.toHaveBeenCalled()
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await codeOf(promoteAdmin(ACTOR, 'inconnu'))).toBe('NOT_FOUND')
  })

  it('refuse un compte désactivé', async () => {
    // Des droits qu'on ne peut pas exercer n'égarent que celui qui les lit.
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, disabledAt: new Date() })
    expect(await codeOf(promoteAdmin(ACTOR, USER.id))).toBe('CONFLICT')
    expect(auditMock.auditWrite).not.toHaveBeenCalled()
  })
})

describe('demoteAdmin', () => {
  it('retire le rôle quand il reste un autre administrateur', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)
    prismaMock.user.count.mockResolvedValue(2)

    await expect(demoteAdmin(ACTOR, ADMIN.id)).resolves.toMatchObject({ role: 'USER' })
    expect(auditMock.auditWrite.mock.calls[0][1]).toMatchObject({ action: 'admin.demote' })
  })

  it('refuse de retirer le dernier administrateur', async () => {
    prismaMock.user.findUnique.mockResolvedValue(ADMIN)
    prismaMock.user.count.mockResolvedValue(1)

    expect(await codeOf(demoteAdmin(ACTOR, ADMIN.id))).toBe('CONFLICT')
    expect(auditMock.auditWrite).not.toHaveBeenCalled()
  })

  it('refuse qu’un administrateur se rétrograde lui-même', async () => {
    expect(await codeOf(demoteAdmin(ACTOR, ACTOR))).toBe('CONFLICT')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('ne compte pas les administrateurs pour un compte qui n’en est pas un', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)

    await expect(demoteAdmin(ACTOR, USER.id)).resolves.toMatchObject({ role: 'USER' })
    expect(prismaMock.user.count).not.toHaveBeenCalled()
    expect(auditMock.auditWrite).not.toHaveBeenCalled()
  })
})

describe('findAccountByEmail', () => {
  it('cherche sans tenir compte de la casse', async () => {
    prismaMock.user.findFirst.mockResolvedValue(USER)

    await findAccountByEmail('  Jules@Growi.fr ')

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'Jules@Growi.fr', mode: 'insensitive' } },
      }),
    )
  })

  it('ne cherche rien pour une chaîne vide', async () => {
    await expect(findAccountByEmail('   ')).resolves.toBeNull()
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })
})

describe('listAdminsWithPromotion', () => {
  it('rattache la promotion la plus récente à chaque administrateur', async () => {
    prismaMock.user.findMany.mockResolvedValue([ADMIN])
    prismaMock.adminAuditLog.findMany.mockResolvedValue([
      {
        targetId: ADMIN.id,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
        actor: { id: ACTOR, email: 'dan@growi.fr' },
      },
      // Plus ancienne : un compte peut avoir été rétrogradé puis repromu.
      {
        targetId: ADMIN.id,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        actor: { id: 'autre', email: 'autre@growi.fr' },
      },
    ])

    const [admin] = await listAdminsWithPromotion()
    expect(admin.promotedAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
    expect(admin.promotedBy?.email).toBe('dan@growi.fr')
  })

  it('laisse la promotion inconnue quand le journal n’en garde pas trace', async () => {
    // Le cas du premier administrateur, promu par le script d'amorçage.
    prismaMock.user.findMany.mockResolvedValue([ADMIN])
    prismaMock.adminAuditLog.findMany.mockResolvedValue([])

    const [admin] = await listAdminsWithPromotion()
    expect(admin.promotedAt).toBeNull()
    expect(admin.promotedBy).toBeNull()
  })

  it('n’interroge pas le journal quand il n’y a aucun administrateur', async () => {
    prismaMock.user.findMany.mockResolvedValue([])

    await expect(listAdminsWithPromotion()).resolves.toEqual([])
    expect(prismaMock.adminAuditLog.findMany).not.toHaveBeenCalled()
  })
})
