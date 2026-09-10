import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  plantCatalog: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { PRERENDER_LIMIT, prerenderedPlantSlugs, shouldPrerender } = await import(
  '@/lib/encyclopedie/prerender'
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('shouldPrerender', () => {
  it('ne prérend qu’en production', () => {
    expect(shouldPrerender({ VERCEL_ENV: 'production' })).toBe(true)
    expect(shouldPrerender({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(shouldPrerender({ VERCEL_ENV: 'development' })).toBe(false)
    // Hors Vercel — un build local, un `next build` dans un test — il n'y a
    // pas de variable du tout.
    expect(shouldPrerender({})).toBe(false)
  })
})

describe('prerenderedPlantSlugs', () => {
  it('en production, prend les cinquante premières fiches', async () => {
    prismaMock.plantCatalog.findMany.mockResolvedValue([
      { slug: 'monstera' },
      { slug: 'basilic' },
    ])

    const slugs = await prerenderedPlantSlugs({ VERCEL_ENV: 'production' })

    expect(slugs).toEqual([{ slug: 'monstera' }, { slug: 'basilic' }])
    expect(prismaMock.plantCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: PRERENDER_LIMIT }),
    )
  })

  it("classe par nombre de plantes possédées, puis par nom", async () => {
    prismaMock.plantCatalog.findMany.mockResolvedValue([])

    await prerenderedPlantSlugs({ VERCEL_ENV: 'production' })

    // L'ordre alphabétique n'est pas un ornement : tant que la base compte peu
    // de plantes, toutes les espèces sont à égalité à zéro et c'est lui qui
    // tranche. Sans lui, deux builds successifs prérendraient deux jeux de
    // fiches différents.
    expect(prismaMock.plantCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ plantInstances: { _count: 'desc' } }, { commonName: 'asc' }],
      }),
    )
  })

  it("en preview, ne prérend rien — et ne demande rien à la base", async () => {
    // C'est le cas qui fait tomber le build de vingt-deux minutes à trois : la
    // requête elle-même ne doit pas partir.
    await expect(prerenderedPlantSlugs({ VERCEL_ENV: 'preview' })).resolves.toEqual([])
    expect(prismaMock.plantCatalog.findMany).not.toHaveBeenCalled()
  })

  it('en local non plus', async () => {
    await expect(prerenderedPlantSlugs({})).resolves.toEqual([])
    expect(prismaMock.plantCatalog.findMany).not.toHaveBeenCalled()
  })

  it('écarte une fiche sans slug plutôt que de bâtir une URL cassée', async () => {
    prismaMock.plantCatalog.findMany.mockResolvedValue([
      { slug: 'monstera' },
      { slug: null },
      { slug: '' },
    ])

    await expect(prerenderedPlantSlugs({ VERCEL_ENV: 'production' })).resolves.toEqual([
      { slug: 'monstera' },
    ])
  })
})
