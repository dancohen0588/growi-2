import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  garden: { findMany: vi.fn() },
  plantTask: { deleteMany: vi.fn() },
  plantInstance: { updateMany: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
  pushToken: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))
const auditMock = vi.hoisted(() => ({
  auditWrite: vi.fn(),
  logAdminAction: vi.fn(),
}))
const adviceMock = vi.hoisted(() => ({ invalidateGardenAdviceCache: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/admin/audit', () => auditMock)
vi.mock('@/lib/recommendation/garden-advice-service', () => adviceMock)

const {
  adminUpdateUserProfile,
  disableUser,
  enableUser,
  resetUserAdvice,
  revokeMobileSessions,
} = await import('../admin-account.service')
const { ServiceError } = await import('@/lib/services/errors')

/** Client transactionnel factice, partagé par `auditWrite`. */
const tx = {
  user: { update: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
  pushToken: { deleteMany: vi.fn() },
}

const ACTOR = 'admin_1'
const TARGET = 'user_2'

beforeEach(() => {
  vi.clearAllMocks()
  tx.user.update.mockReset().mockResolvedValue({ id: TARGET })
  tx.refreshToken.updateMany.mockReset().mockResolvedValue({ count: 0 })
  tx.pushToken.deleteMany.mockReset().mockResolvedValue({ count: 0 })

  // `auditWrite` exécute l'écriture avec le client transactionnel, comme la
  // vraie implémentation, et renvoie son résultat.
  auditMock.auditWrite.mockImplementation(
    async (write: (client: typeof tx) => Promise<unknown>) => write(tx),
  )

  prismaMock.user.count.mockResolvedValue(1)
  prismaMock.garden.findMany.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }])
  prismaMock.plantTask.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.plantInstance.updateMany.mockResolvedValue({ count: 0 })
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'AUCUNE_ERREUR'
  } catch (err) {
    return err instanceof ServiceError ? err.code : 'AUTRE_ERREUR'
  }
}

// ─── Réinitialisations ─────────────────────────────────────────────────────

describe('resetUserAdvice — niveau 1', () => {
  it('vide le cache de tous les jardins et ne touche à rien d’autre', async () => {
    const outcome = await resetUserAdvice(ACTOR, TARGET, 1)

    expect(adviceMock.invalidateGardenAdviceCache).toHaveBeenCalledTimes(2)
    expect(outcome).toMatchObject({ gardensInvalidated: 2, tasksDeleted: 0, plantsReset: 0 })
    expect(prismaMock.plantTask.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.plantInstance.updateMany).not.toHaveBeenCalled()
  })
})

describe('resetUserAdvice — niveau 2', () => {
  it('ne supprime que les tâches ouvertes ; les tâches faites restent', async () => {
    prismaMock.plantTask.deleteMany.mockResolvedValue({ count: 4 })

    const outcome = await resetUserAdvice(ACTOR, TARGET, 2)

    // `doneAt: null` est ce qui distingue une tâche ouverte d'un fait accompli.
    expect(prismaMock.plantTask.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET, doneAt: null },
    })
    expect(outcome.tasksDeleted).toBe(4)
  })

  it('enchaîne sur le niveau 1', async () => {
    // Sans cela, l'effet ne serait visible qu'après expiration du cache, six
    // heures plus tard — et l'admin conclurait que le bouton ne marche pas.
    await resetUserAdvice(ACTOR, TARGET, 2)
    expect(adviceMock.invalidateGardenAdviceCache).toHaveBeenCalledTimes(2)
  })

  it('ne touche pas au suivi d’entretien', async () => {
    await resetUserAdvice(ACTOR, TARGET, 2)
    expect(prismaMock.plantInstance.updateMany).not.toHaveBeenCalled()
  })
})

describe('resetUserAdvice — niveau 3', () => {
  it('efface les cinq dates de dernier geste', async () => {
    prismaMock.plantInstance.updateMany.mockResolvedValue({ count: 7 })

    const outcome = await resetUserAdvice(ACTOR, TARGET, 3)

    expect(prismaMock.plantInstance.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET },
      data: {
        lastWateredAt: null,
        lastFertilizedAt: null,
        lastPrunedAt: null,
        lastRepottedAt: null,
        lastTreatedAt: null,
      },
    })
    expect(outcome.plantsReset).toBe(7)
  })

  it('conserve les gestes notés — aucun CareLog n’est touché', async () => {
    // Les colonnes `last*At` sont des dérivés ; les CareLog sont les faits.
    // Le service n'a même pas accès à `prisma.careLog`.
    await resetUserAdvice(ACTOR, TARGET, 3)
    expect(prismaMock).not.toHaveProperty('careLog')
  })

  it('ne purge pas les tâches : les niveaux ne s’emboîtent pas', async () => {
    await resetUserAdvice(ACTOR, TARGET, 3)
    expect(prismaMock.plantTask.deleteMany).not.toHaveBeenCalled()
  })

  it('se restreint à une sélection de plantes quand on lui en donne une', async () => {
    await resetUserAdvice(ACTOR, TARGET, 3, ['p1', 'p2'])

    expect(prismaMock.plantInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET, id: { in: ['p1', 'p2'] } } }),
    )
  })

  it('vise toutes les plantes quand la sélection est vide', async () => {
    // Une liste vide veut dire « pas de sélection », pas « aucune plante » —
    // sinon le bouton ne ferait rien sans le dire.
    await resetUserAdvice(ACTOR, TARGET, 3, [])
    expect(prismaMock.plantInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TARGET } }),
    )
  })
})

describe('resetUserAdvice — garde-fous', () => {
  it('refuse un compte introuvable', async () => {
    prismaMock.user.count.mockResolvedValue(0)
    expect(await codeOf(resetUserAdvice(ACTOR, TARGET, 1))).toBe('NOT_FOUND')
  })

  it('journalise ce qui a été fait', async () => {
    prismaMock.plantTask.deleteMany.mockResolvedValue({ count: 3 })
    await resetUserAdvice(ACTOR, TARGET, 2)

    expect(auditMock.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR,
        action: 'user.reset_advice',
        targetId: TARGET,
        details: expect.objectContaining({ niveau: 2, tachesSupprimees: 3 }),
      }),
    )
  })
})

// ─── Désactivation ─────────────────────────────────────────────────────────

describe('disableUser', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({ id: TARGET, disabledAt: null })
  })

  it('pose la date, coupe les jetons et débranche les appareils', async () => {
    tx.refreshToken.updateMany.mockResolvedValue({ count: 2 })
    tx.pushToken.deleteMany.mockResolvedValue({ count: 3 })

    const outcome = await disableUser(ACTOR, TARGET)

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: TARGET },
      data: { disabledAt: expect.any(Date) },
    })
    // Poser `disabledAt` ne suffit pas : un refresh token vit soixante jours.
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(tx.pushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET } })
    expect(outcome).toEqual({ sessionsRevoked: 2, pushTokensRemoved: 3 })
  })

  it('refuse qu’un administrateur se désactive lui-même', async () => {
    expect(await codeOf(disableUser(ACTOR, ACTOR))).toBe('CONFLICT')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un compte déjà désactivé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: TARGET, disabledAt: new Date() })
    expect(await codeOf(disableUser(ACTOR, TARGET))).toBe('CONFLICT')
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await codeOf(disableUser(ACTOR, TARGET))).toBe('NOT_FOUND')
  })
})

describe('enableUser', () => {
  it('lève la désactivation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: TARGET, disabledAt: new Date() })
    await enableUser(ACTOR, TARGET)

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: TARGET },
      data: { disabledAt: null },
    })
  })

  it('refuse un compte déjà actif', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: TARGET, disabledAt: null })
    expect(await codeOf(enableUser(ACTOR, TARGET))).toBe('CONFLICT')
  })
})

describe('revokeMobileSessions', () => {
  it('révoque les jetons actifs et renvoie leur nombre', async () => {
    tx.refreshToken.updateMany.mockResolvedValue({ count: 5 })
    await expect(revokeMobileSessions(ACTOR, TARGET)).resolves.toBe(5)
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.count.mockResolvedValue(0)
    expect(await codeOf(revokeMobileSessions(ACTOR, TARGET))).toBe('NOT_FOUND')
  })
})

// ─── Modification du profil ────────────────────────────────────────────────

describe('adminUpdateUserProfile', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: TARGET,
      firstName: 'Ancien',
      locationCity: 'Lyon',
      plan: 'FREE',
      password: '$2a$12$condensat',
    })
  })

  it('n’écrit que les colonnes de la liste blanche', async () => {
    await adminUpdateUserProfile(ACTOR, TARGET, {
      firstName: 'Nouveau',
      // Ces deux-là n'ont pas leur place et ne doivent pas ressortir.
      role: 'ADMIN',
      password: 'x',
    } as never)

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: TARGET },
      data: { firstName: 'Nouveau' },
    })
  })

  it('traduit `city` en `locationCity`', async () => {
    await adminUpdateUserProfile(ACTOR, TARGET, { city: 'Bordeaux' })

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: TARGET },
      data: { locationCity: 'Bordeaux' },
    })
  })

  it('refuse un patch qui ne touche aucun champ', async () => {
    expect(await codeOf(adminUpdateUserProfile(ACTOR, TARGET, {}))).toBe('INVALID_INPUT')
  })

  it('refuse un compte introuvable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await codeOf(adminUpdateUserProfile(ACTOR, TARGET, { firstName: 'X' }))).toBe(
      'NOT_FOUND',
    )
  })

  it('vide le cache de conseils quand les coordonnées changent', async () => {
    // Les conseils sont calculés avec la météo du lieu : déménager un compte
    // sans vider son cache lui laisserait six heures de recommandations
    // calées sur l'ancienne adresse.
    await adminUpdateUserProfile(ACTOR, TARGET, { latitude: 44.8, longitude: -0.6 })
    expect(adviceMock.invalidateGardenAdviceCache).toHaveBeenCalledTimes(2)
  })

  it('ne le vide pas pour un simple changement de prénom', async () => {
    await adminUpdateUserProfile(ACTOR, TARGET, { firstName: 'Nouveau' })
    expect(adviceMock.invalidateGardenAdviceCache).not.toHaveBeenCalled()
  })

  it('journalise l’avant et l’après, sans le mot de passe', async () => {
    await adminUpdateUserProfile(ACTOR, TARGET, { firstName: 'Nouveau' })

    const entry = auditMock.auditWrite.mock.calls[0][1]
    expect(entry.details).toEqual({
      avant: { firstName: 'Ancien' },
      apres: { firstName: 'Nouveau' },
    })
    expect(JSON.stringify(entry.details)).not.toContain('condensat')
  })
})
