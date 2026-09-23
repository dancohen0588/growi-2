import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique } } }))

const { hasAnalyticsConsent, rememberConsent, resetConsentCache } = await import(
  '@/lib/analytics/server'
)

/**
 * Le consentement est posé sur le compte : c'est le serveur qui doit le lire,
 * pas seulement l'appareil. Seul un oui explicite ouvre l'émission — jamais
 * demandé, refusé, inconnu ou illisible valent silence. Ces tests portent aussi
 * sur la mémoire qui évite de relire la base à chaque événement.
 */
describe('hasAnalyticsConsent', () => {
  beforeEach(() => {
    resetConsentCache()
    findUnique.mockReset()
  })

  it("n'est vrai que pour un oui explicite", async () => {
    findUnique
      .mockResolvedValueOnce({ analyticsConsent: true })
      .mockResolvedValueOnce({ analyticsConsent: false })
      .mockResolvedValueOnce({ analyticsConsent: null })

    expect(await hasAnalyticsConsent('oui')).toBe(true)
    expect(await hasAnalyticsConsent('non')).toBe(false)
    // Jamais demandé n'est pas un accord : rien ne part avant la réponse.
    expect(await hasAnalyticsConsent('jamais')).toBe(false)
  })

  it('lit le choix en base, puis le garde une heure', async () => {
    findUnique.mockResolvedValue({ analyticsConsent: true })

    expect(await hasAnalyticsConsent('u1', 0)).toBe(true)
    expect(await hasAnalyticsConsent('u1', 59 * 60 * 1000)).toBe(true)
    expect(findUnique).toHaveBeenCalledTimes(1)

    // L'heure passée, on relit — un retrait fait depuis une autre instance
    // finit par être vu.
    findUnique.mockResolvedValue({ analyticsConsent: false })
    expect(await hasAnalyticsConsent('u1', 61 * 60 * 1000)).toBe(false)
    expect(findUnique).toHaveBeenCalledTimes(2)
  })

  it('se tait quand le compte est introuvable ou la base muette', async () => {
    findUnique.mockResolvedValue(null)
    expect(await hasAnalyticsConsent('inconnu')).toBe(false)

    resetConsentCache()
    findUnique.mockRejectedValue(new Error('P2024'))
    expect(await hasAnalyticsConsent('u2')).toBe(false)
  })

  it("ne garde pas en mémoire une panne : la base est réinterrogée à l'appel suivant", async () => {
    findUnique.mockRejectedValueOnce(new Error('P2024'))
    findUnique.mockResolvedValue({ analyticsConsent: true })

    expect(await hasAnalyticsConsent('u3')).toBe(false)
    expect(await hasAnalyticsConsent('u3')).toBe(true)
  })

  it("rememberConsent prend le pas sur la base, sur l'instance qui a reçu le réglage", async () => {
    findUnique.mockResolvedValue({ analyticsConsent: true })
    expect(await hasAnalyticsConsent('u4', 0)).toBe(true)

    rememberConsent('u4', false, 1000)
    expect(await hasAnalyticsConsent('u4', 2000)).toBe(false)

    rememberConsent('u5', null, 1000)
    expect(await hasAnalyticsConsent('u5', 2000)).toBe(false)

    // Aucune relecture : les choix viennent d'être écrits ici même.
    expect(findUnique).toHaveBeenCalledTimes(1)
  })

  it('mémorise par compte, pas globalement', async () => {
    findUnique
      .mockResolvedValueOnce({ analyticsConsent: false })
      .mockResolvedValueOnce({ analyticsConsent: true })

    expect(await hasAnalyticsConsent('a')).toBe(false)
    expect(await hasAnalyticsConsent('b')).toBe(true)
  })
})
