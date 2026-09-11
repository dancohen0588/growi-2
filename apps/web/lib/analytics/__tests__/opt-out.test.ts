import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique } } }))

const { isOptedOut, rememberOptOut, resetOptOutCache } = await import('@/lib/analytics/server')

/**
 * Le refus est posé sur le compte : c'est le serveur qui doit le lire, pas
 * seulement l'interrupteur de l'appareil. Ces tests portent sur la mémoire qui
 * évite de relire la base à chaque événement, et sur son repli en cas de doute.
 */
describe('isOptedOut', () => {
  beforeEach(() => {
    resetOptOutCache()
    findUnique.mockReset()
  })

  it('lit le choix en base, puis le garde une heure', async () => {
    findUnique.mockResolvedValue({ analyticsOptOut: false })

    expect(await isOptedOut('u1', 0)).toBe(false)
    expect(await isOptedOut('u1', 59 * 60 * 1000)).toBe(false)
    expect(findUnique).toHaveBeenCalledTimes(1)

    // L'heure passée, on relit — un changement fait depuis une autre instance
    // finit par être vu.
    findUnique.mockResolvedValue({ analyticsOptOut: true })
    expect(await isOptedOut('u1', 61 * 60 * 1000)).toBe(true)
    expect(findUnique).toHaveBeenCalledTimes(2)
  })

  it('répond « refuse » quand le compte est introuvable ou la base muette', async () => {
    findUnique.mockResolvedValue(null)
    expect(await isOptedOut('inconnu')).toBe(true)

    resetOptOutCache()
    findUnique.mockRejectedValue(new Error('P2024'))
    expect(await isOptedOut('u2')).toBe(true)
  })

  it("ne garde pas en mémoire une panne : la base est réinterrogée à l'appel suivant", async () => {
    findUnique.mockRejectedValueOnce(new Error('P2024'))
    findUnique.mockResolvedValue({ analyticsOptOut: false })

    expect(await isOptedOut('u3')).toBe(true)
    expect(await isOptedOut('u3')).toBe(false)
  })

  it("rememberOptOut prend le pas sur la base, sur l'instance qui a reçu le réglage", async () => {
    findUnique.mockResolvedValue({ analyticsOptOut: false })
    expect(await isOptedOut('u4', 0)).toBe(false)

    rememberOptOut('u4', true, 1000)
    expect(await isOptedOut('u4', 2000)).toBe(true)
    // Aucune relecture : le choix vient d'être écrit ici même.
    expect(findUnique).toHaveBeenCalledTimes(1)
  })

  it('mémorise par compte, pas globalement', async () => {
    findUnique
      .mockResolvedValueOnce({ analyticsOptOut: true })
      .mockResolvedValueOnce({ analyticsOptOut: false })

    expect(await isOptedOut('a')).toBe(true)
    expect(await isOptedOut('b')).toBe(false)
  })
})
