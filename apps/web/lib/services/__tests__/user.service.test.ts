import { LEGAL_VERSION } from '@growi/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => {
  const mock = {
    user: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    garden: { findMany: vi.fn() },
    follow: { findMany: vi.fn() },
    postLike: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    listingThread: { findMany: vi.fn() },
    listingMessage: { findMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
    // La transaction interactive reçoit le même double : on y observe
    // l'ordre des écritures.
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation(async (fn: (tx: typeof mock) => unknown) => fn(mock))
  return mock
})
const storageMock = vi.hoisted(() => ({
  deleteUserFolder: vi.fn(async () => 0),
  deletePhotosByUrl: vi.fn(async () => 0),
}))
const posthogAdminMock = vi.hoisted(() => ({ deletePostHogPerson: vi.fn(async () => 'deleted') }))
const bcryptMock = vi.hoisted(() => ({ hash: vi.fn(async () => 'empreinte'), compare: vi.fn() }))
const analyticsMock = vi.hoisted(() => ({
  rememberConsent: vi.fn(),
  setPersonProperties: vi.fn(),
  trackAnonymous: vi.fn(),
  trackServer: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/analytics/server', () => analyticsMock)
vi.mock('@/lib/storage', () => storageMock)
vi.mock('@/lib/analytics/posthog-admin', () => posthogAdminMock)
vi.mock('@/lib/recommendation/garden-advice-service', () => ({
  invalidateGardenAdviceCache: vi.fn(),
}))
vi.mock('@/lib/services/community/profile.service', () => ({ refreshFuzzyPosition: vi.fn() }))
// bcrypt à 12 tours n'a rien à prouver ici, sinon sa lenteur.
vi.mock('bcryptjs', () => ({ default: bcryptMock }))

const userService = await import('../user.service')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const CREATED_AT = new Date('2026-09-20T08:00:00Z')

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    firstName: 'Dan',
    lastName: null,
    name: 'Dan',
    email: 'dan@growi.fr',
    address: null,
    locationCity: null,
    gardenType: null,
    avatarColor: null,
    alertConfig: null,
    latitude: null,
    longitude: null,
    analyticsConsent: null,
    analyticsConsentAt: null,
    password: 'empreinte',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  )
  for (const model of ['follow', 'postLike', 'comment', 'listingThread', 'listingMessage'] as const) {
    prismaMock[model].findMany.mockResolvedValue([])
  }
})

// ─── Inscription ───────────────────────────────────────────────────────────

describe('createUser', () => {
  it("trace l'acceptation des CGU avec la version en vigueur", async () => {
    prismaMock.user.create.mockResolvedValue({ id: 'u1' })

    await userService.createUser({ email: 'dan@growi.fr', password: 'motdepasse', firstName: 'Dan' })

    const { data } = prismaMock.user.create.mock.calls[0][0]
    expect(data.termsVersion).toBe(LEGAL_VERSION)
    expect(data.termsAcceptedAt).toBeInstanceOf(Date)
    // Le consentement à la mesure n'est pas présumé : la question viendra.
    expect(data.analyticsConsent).toBeUndefined()
  })
})

// ─── Consentement ──────────────────────────────────────────────────────────

describe('updateProfile — consentement', () => {
  it('date chaque réponse et la répercute sur-le-champ sur cette instance', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      analyticsConsent: true,
      termsAcceptedAt: CREATED_AT,
    })
    prismaMock.user.update.mockResolvedValue(
      profileRow({ analyticsConsent: false, analyticsConsentAt: new Date() }),
    )

    const profile = await userService.updateProfile('u1', { analyticsConsent: false })

    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data.analyticsConsent).toBe(false)
    expect(data.analyticsConsentAt).toBeInstanceOf(Date)
    expect(analyticsMock.rememberConsent).toHaveBeenCalledWith('u1', false)
    expect(profile.analyticsConsent).toBe(false)
    expect(profile.analyticsConsentAt).toEqual(expect.any(String))
    expect(analyticsMock.trackServer).not.toHaveBeenCalled()
  })

  it('ne touche ni au consentement ni à sa date quand le patch ne le porte pas', async () => {
    prismaMock.user.update.mockResolvedValue(profileRow())

    await userService.updateProfile('u1', { firstName: 'Daniel' })

    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data).not.toHaveProperty('analyticsConsent')
    expect(data).not.toHaveProperty('analyticsConsentAt')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(analyticsMock.rememberConsent).not.toHaveBeenCalled()
  })

  it("rejoue l'inscription, datée du jour réel, au premier oui d'un compte neuf", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ analyticsConsent: null, termsAcceptedAt: CREATED_AT })
      .mockResolvedValueOnce({ createdAt: CREATED_AT, password: null, accounts: [{ provider: 'google' }] })
    prismaMock.user.update.mockResolvedValue(profileRow({ analyticsConsent: true }))

    await userService.updateProfile('u1', { analyticsConsent: true })

    expect(analyticsMock.trackServer).toHaveBeenCalledWith(
      'u1',
      'signup_completed',
      { method: 'google' },
      { timestamp: CREATED_AT },
    )
    expect(analyticsMock.setPersonProperties).toHaveBeenCalledWith('u1', {
      signup_method: 'google',
      signup_at: CREATED_AT.toISOString(),
    })
  })

  it("ne rejoue pas l'inscription d'un compte antérieur, qui l'a déjà émise en opt-out", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ analyticsConsent: null, termsAcceptedAt: null })
      .mockResolvedValueOnce({ createdAt: CREATED_AT, password: 'empreinte', accounts: [] })
    prismaMock.user.update.mockResolvedValue(profileRow({ analyticsConsent: true }))

    await userService.updateProfile('u1', { analyticsConsent: true })

    expect(analyticsMock.trackServer).not.toHaveBeenCalled()
    // Les propriétés, elles, sont idempotentes : autant les tenir à jour.
    expect(analyticsMock.setPersonProperties).toHaveBeenCalledWith('u1', {
      signup_method: 'email',
      signup_at: CREATED_AT.toISOString(),
    })
  })

  it("n'envoie pas deux fois l'inscription à qui dit non puis oui", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ analyticsConsent: false, termsAcceptedAt: CREATED_AT })
      .mockResolvedValueOnce({ createdAt: CREATED_AT, password: 'empreinte', accounts: [] })
    prismaMock.user.update.mockResolvedValue(profileRow({ analyticsConsent: true }))

    await userService.updateProfile('u1', { analyticsConsent: true })

    expect(analyticsMock.trackServer).not.toHaveBeenCalled()
  })

  it('ne rejoue rien quand le compte avait déjà dit oui', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      analyticsConsent: true,
      termsAcceptedAt: CREATED_AT,
    })
    prismaMock.user.update.mockResolvedValue(profileRow({ analyticsConsent: true }))

    await userService.updateProfile('u1', { analyticsConsent: true })

    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
    expect(analyticsMock.setPersonProperties).not.toHaveBeenCalled()
    expect(analyticsMock.trackServer).not.toHaveBeenCalled()
  })
})

describe('getAnalyticsConsent', () => {
  it('distingue « jamais demandé » de « refusé », et tient un compte disparu pour refus', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ analyticsConsent: null })
      .mockResolvedValueOnce({ analyticsConsent: true })
      .mockResolvedValueOnce(null)

    expect(await userService.getAnalyticsConsent('u1')).toBeNull()
    expect(await userService.getAnalyticsConsent('u2')).toBe(true)
    expect(await userService.getAnalyticsConsent('disparu')).toBe(false)
  })
})

// ─── Suppression du compte ─────────────────────────────────────────────────

describe('deleteAccount', () => {
  const NOW = new Date('2026-09-24T10:00:00Z')
  const CONFIRM = { confirmation: 'SUPPRIMER' as const }

  function account(overrides: Record<string, unknown> = {}) {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      password: 'empreinte',
      role: 'USER',
      ...overrides,
    })
  }

  it('refuse sans le mot de confirmation, avant toute lecture', async () => {
    await expect(
      userService.deleteAccount('u1', { confirmation: 'supprimer' } as never),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe faux ou absent sur un compte qui en a un', async () => {
    account()
    bcryptMock.compare.mockResolvedValueOnce(false)
    await expect(
      userService.deleteAccount('u1', { ...CONFIRM, password: 'faux' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'Mot de passe incorrect.' })

    // Une connexion récente ne remplace pas le mot de passe d'un compte qui en a un.
    account()
    await expect(
      userService.deleteAccount('u1', CONFIRM, { authenticatedAt: NOW, now: NOW }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })

    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('exige une connexion de moins de dix minutes pour un compte Apple/Google', async () => {
    account({ password: null })
    await expect(userService.deleteAccount('u1', CONFIRM)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Reconnecte-toi pour supprimer ton compte.',
    })

    account({ password: null })
    await expect(
      userService.deleteAccount('u1', CONFIRM, {
        authenticatedAt: new Date(NOW.getTime() - 11 * 60 * 1000),
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })

    account({ password: null })
    await userService.deleteAccount('u1', CONFIRM, {
      authenticatedAt: new Date(NOW.getTime() - 9 * 60 * 1000),
      now: NOW,
    })
    expect(prismaMock.user.delete).toHaveBeenCalledTimes(1)
  })

  it('refuse de supprimer le dernier administrateur', async () => {
    account({ role: 'ADMIN' })
    bcryptMock.compare.mockResolvedValueOnce(true)
    prismaMock.user.count.mockResolvedValueOnce(1)

    await expect(
      userService.deleteAccount('u1', { ...CONFIRM, password: 'bon' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Nomme un autre administrateur avant de supprimer ce compte.',
    })
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it("laisse partir un administrateur qui n'est pas le dernier", async () => {
    account({ role: 'ADMIN' })
    bcryptMock.compare.mockResolvedValueOnce(true)
    prismaMock.user.count.mockResolvedValueOnce(2)

    await userService.deleteAccount('u1', { ...CONFIRM, password: 'bon' })

    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })

  it('efface, recompte chez les autres, puis vide les fichiers et PostHog', async () => {
    account()
    bcryptMock.compare.mockResolvedValueOnce(true)
    prismaMock.follow.findMany
      .mockResolvedValueOnce([{ followingId: 'suivi' }])
      .mockResolvedValueOnce([{ followerId: 'abonne' }])
    prismaMock.postLike.findMany.mockResolvedValueOnce([{ postId: 'p1' }])
    prismaMock.comment.findMany.mockResolvedValueOnce([{ postId: 'p1' }, { postId: 'p2' }])
    prismaMock.listingThread.findMany.mockResolvedValueOnce([{ listingId: 'l1' }])
    prismaMock.listingMessage.findMany.mockResolvedValueOnce([
      { photoUrl: 'https://x.supabase.co/storage/v1/object/public/plant-photos/users/autre/chat/a.jpg' },
    ])

    const order: string[] = []
    prismaMock.notification.deleteMany.mockImplementation(async () => void order.push('notifications'))
    prismaMock.user.delete.mockImplementation(async () => void order.push('user'))
    prismaMock.$executeRaw.mockImplementation(async () => void order.push('recount'))

    await userService.deleteAccount('u1', { ...CONFIRM, password: 'bon' })

    // Les notifications qu'il a déclenchées portent son pseudo, figé.
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({ where: { actorId: 'u1' } })
    // Relevé avant, recompté après : quatre compteurs touchés, quatre requêtes.
    expect(order).toEqual(['notifications', 'user', 'recount', 'recount', 'recount', 'recount'])
    const recountIds = prismaMock.$executeRaw.mock.calls.map((call) => call.slice(1))
    expect(recountIds).toEqual([[['suivi']], [['abonne']], [['p1', 'p2']], [['l1']]])

    expect(storageMock.deleteUserFolder).toHaveBeenCalledWith('u1')
    expect(storageMock.deletePhotosByUrl).toHaveBeenCalledWith([
      'https://x.supabase.co/storage/v1/object/public/plant-photos/users/autre/chat/a.jpg',
    ])
    expect(posthogAdminMock.deletePostHogPerson).toHaveBeenCalledWith('u1')
  })

  it('ne recompte rien quand le compte ne touchait personne', async () => {
    account()
    bcryptMock.compare.mockResolvedValueOnce(true)

    await userService.deleteAccount('u1', { ...CONFIRM, password: 'bon' })

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
    expect(prismaMock.user.delete).toHaveBeenCalledTimes(1)
  })

  it("n'efface aucun fichier si la base a refusé la suppression", async () => {
    account()
    bcryptMock.compare.mockResolvedValueOnce(true)
    prismaMock.user.delete.mockRejectedValueOnce(new Error('P1001'))

    await expect(userService.deleteAccount('u1', { ...CONFIRM, password: 'bon' })).rejects.toThrow()

    expect(storageMock.deleteUserFolder).not.toHaveBeenCalled()
    expect(posthogAdminMock.deletePostHogPerson).not.toHaveBeenCalled()
  })
})
