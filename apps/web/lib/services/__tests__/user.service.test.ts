import { LEGAL_VERSION } from '@growi/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  garden: { findMany: vi.fn() },
}))
const analyticsMock = vi.hoisted(() => ({
  rememberConsent: vi.fn(),
  setPersonProperties: vi.fn(),
  trackAnonymous: vi.fn(),
  trackServer: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/analytics/server', () => analyticsMock)
vi.mock('@/lib/recommendation/garden-advice-service', () => ({
  invalidateGardenAdviceCache: vi.fn(),
}))
vi.mock('@/lib/services/community/profile.service', () => ({ refreshFuzzyPosition: vi.fn() }))
// bcrypt à 12 tours n'a rien à prouver ici, sinon sa lenteur.
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'empreinte'), compare: vi.fn() } }))

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
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
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
