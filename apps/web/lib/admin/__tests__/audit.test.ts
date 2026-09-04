import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  adminAuditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { ADMIN_ACTIONS, adminActionLabel, auditTargetLabel, auditWrite, logAdminAction } =
  await import('../audit')

/** Client transactionnel factice, avec le même `adminAuditLog` que le mock. */
const tx = { adminAuditLog: { create: vi.fn() } }

beforeEach(() => {
  vi.clearAllMocks()
  tx.adminAuditLog.create.mockReset()
  prismaMock.$transaction.mockImplementation(
    async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  )
})

describe('libellés', () => {
  it('traduit les actions connues', () => {
    expect(adminActionLabel('user.disable')).toBe(ADMIN_ACTIONS['user.disable'])
    expect(auditTargetLabel('user')).toBe('Utilisateur')
  })

  it('affiche la valeur brute pour une action inconnue plutôt que rien', () => {
    // Une entrée écrite par une version antérieure doit rester lisible.
    expect(adminActionLabel('user.something_old')).toBe('user.something_old')
    expect(auditTargetLabel('widget')).toBe('widget')
  })
})

describe('logAdminAction', () => {
  it('écrit une entrée', async () => {
    await logAdminAction({
      actorId: 'admin_1',
      action: 'user.disable',
      targetType: 'user',
      targetId: 'user_2',
      details: { raison: 'abus' },
    })

    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin_1',
        action: 'user.disable',
        targetType: 'user',
        targetId: 'user_2',
        details: { raison: 'abus' },
      },
    })
  })

  it('refuse un détail portant un secret', async () => {
    await expect(
      logAdminAction({
        actorId: 'admin_1',
        action: 'user.update',
        targetType: 'user',
        targetId: 'user_2',
        details: { password: '$2a$12$...' },
      }),
    ).rejects.toThrow(/password/)

    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled()
  })

  it('trouve un secret enfoui dans un objet imbriqué', async () => {
    await expect(
      logAdminAction({
        actorId: 'admin_1',
        action: 'user.update',
        targetType: 'user',
        targetId: 'user_2',
        details: { avant: { profil: { tokenHash: 'empreinte' } } },
      }),
    ).rejects.toThrow(/tokenHash/)
  })
})

describe('auditWrite', () => {
  it('écrit l’action et sa trace dans la même transaction', async () => {
    // Typée par l'implémentation plutôt que par `mockResolvedValue` : sans
    // cela, `auditWrite` infère `unknown` et le callback ne se relit pas.
    const write = vi.fn(async () => ({ id: 'user_2', role: 'ADMIN' }))

    const result = await auditWrite(write, (updated) => ({
      actorId: 'admin_1',
      action: 'admin.promote',
      targetType: 'user',
      targetId: updated.id,
      details: { role: updated.role },
    }))

    expect(result).toEqual({ id: 'user_2', role: 'ADMIN' })
    // L'écriture a reçu le client transactionnel, pas le client global : c'est
    // ce qui garantit qu'un échec du journal annule l'action.
    expect(write).toHaveBeenCalledWith(tx)
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin_1',
        action: 'admin.promote',
        targetType: 'user',
        targetId: 'user_2',
        details: { role: 'ADMIN' },
      },
    })
    expect(prismaMock.adminAuditLog.create).not.toHaveBeenCalled()
  })

  it('laisse remonter l’échec de l’écriture, sans journaliser', async () => {
    const write = vi.fn().mockRejectedValue(new Error('conflit'))

    await expect(
      auditWrite(write, {
        actorId: 'admin_1',
        action: 'user.disable',
        targetType: 'user',
        targetId: 'user_2',
      }),
    ).rejects.toThrow('conflit')

    expect(tx.adminAuditLog.create).not.toHaveBeenCalled()
  })

  it('rejette avant d’écrire quoi que ce soit si le détail porte un secret', async () => {
    const write = vi.fn().mockResolvedValue({ id: 'user_2' })

    await expect(
      auditWrite(write, {
        actorId: 'admin_1',
        action: 'user.update',
        targetType: 'user',
        targetId: 'user_2',
        details: { apres: { password: 'x' } },
      }),
    ).rejects.toThrow(/password/)

    expect(tx.adminAuditLog.create).not.toHaveBeenCalled()
  })
})
