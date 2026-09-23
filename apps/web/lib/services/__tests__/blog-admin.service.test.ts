import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validMdx } from '@/lib/__tests__/fixtures/blog-article'

// `auditWrite` est doublé pour exécuter l'écriture sur la doublure Prisma et
// garder l'entrée de journal qu'elle aurait écrite.

const prismaMock = vi.hoisted(() => ({
  blogPost: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), groupBy: vi.fn() },
  appSetting: { upsert: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const journal = vi.hoisted(() => [] as unknown[])
vi.mock('@/lib/admin/audit', () => ({
  auditWrite: async (write: (tx: unknown) => Promise<unknown>, entry: unknown) => {
    const result = await write(prismaMock)
    journal.push(typeof entry === 'function' ? entry(result) : entry)
    return result
  },
}))

const storage = vi.hoisted(() => ({ deleteCoverByUrl: vi.fn() }))
vi.mock('@/lib/storage', () => storage)

const service = await import('../blog-admin.service')
const { ServiceError } = await import('../errors')

const COVER = 'https://ref.supabase.co/storage/v1/object/public/blog-covers/pailler/cover-1.jpg'
const FIRST_PUBLICATION = new Date('2026-09-01T08:00:00Z')

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post_1',
    slug: 'pailler-ses-massifs',
    title: 'Pailler ses massifs avant l’hiver',
    excerpt: 'Paille, feuilles ou broyat : lequel poser et quand, pour protéger tes vivaces du gel.',
    source: validMdx(),
    tags: ['entretien', 'saison'],
    status: 'DRAFT',
    coverImage: COVER,
    coverImageAlt: null,
    coverPrompt: null,
    publishedAt: null,
    ...overrides,
  }
}

const edit = (overrides: Record<string, unknown> = {}) => ({
  title: 'Pailler ses massifs avant l’hiver',
  excerpt: 'Paille, feuilles ou broyat : lequel poser et quand, pour protéger tes vivaces du gel.',
  tags: ['entretien', 'saison'] as ('entretien' | 'saison')[],
  source: validMdx(),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  journal.length = 0
  prismaMock.blogPost.findUnique.mockResolvedValue(post())
  prismaMock.blogPost.update.mockImplementation(async ({ data }) => ({ ...post(), ...data }))
  prismaMock.blogPost.delete.mockResolvedValue(post())
})

describe('publication', () => {
  it('publie, pose la date et l’auteur, sans toucher au slug', async () => {
    await service.publishBlogPost('admin_1', 'post_1')

    const { data } = prismaMock.blogPost.update.mock.calls[0][0]
    expect(data).toMatchObject({ status: 'PUBLISHED', publishedById: 'admin_1', publishedAt: expect.any(Date) })
    expect(data).not.toHaveProperty('slug')
    expect(journal[0]).toMatchObject({ action: 'blog.publish', targetType: 'blog_post', details: { premiere: true } })
  })

  it('republier un article dépublié garde sa date de première publication', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue(post({ status: 'ARCHIVED', publishedAt: FIRST_PUBLICATION }))

    await service.publishBlogPost('admin_1', 'post_1')

    expect(prismaMock.blogPost.update.mock.calls[0][0].data).not.toHaveProperty('publishedAt')
  })

  it('refuse un corps qui ne compile pas, ou qui trahit le procédé de rédaction', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValueOnce(post({ source: validMdx('<Callout>Sans fin') }))
    await expect(service.publishBlogPost('admin_1', 'post_1')).rejects.toThrow(/ne compile pas/)

    prismaMock.blogPost.findUnique.mockResolvedValueOnce(post({ title: 'Ce que l’IA sait du paillage' }))
    await expect(service.publishBlogPost('admin_1', 'post_1')).rejects.toThrow(/termes interdits/)

    expect(prismaMock.blogPost.update).not.toHaveBeenCalled()
  })

  it('ne republie pas un article déjà publié, et ne dépublie que ce qui l’est', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValueOnce(post({ status: 'PUBLISHED' }))
    await expect(service.publishBlogPost('admin_1', 'post_1')).rejects.toMatchObject({ code: 'CONFLICT' })

    await expect(service.unpublishBlogPost('admin_1', 'post_1')).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('suppression', () => {
  it('refuse un article publié : il faut le dépublier d’abord', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue(post({ status: 'PUBLISHED' }))

    await expect(service.deleteBlogPost('admin_1', 'post_1')).rejects.toBeInstanceOf(ServiceError)
    expect(prismaMock.blogPost.delete).not.toHaveBeenCalled()
    expect(storage.deleteCoverByUrl).not.toHaveBeenCalled()
  })

  it('supprime un brouillon, puis sa couverture, et le journal garde le titre', async () => {
    const order: string[] = []
    prismaMock.blogPost.delete.mockImplementation(async () => { order.push('delete'); return post() })
    storage.deleteCoverByUrl.mockImplementation(async () => { order.push('cover') })

    await service.deleteBlogPost('admin_1', 'post_1')

    expect(order).toEqual(['delete', 'cover'])
    expect(storage.deleteCoverByUrl).toHaveBeenCalledWith(COVER)
    expect(journal[0]).toMatchObject({ action: 'blog.delete', details: { titre: post().title } })
  })
})

describe('édition', () => {
  it('refuse une édition qui contient « IA », sans rien écrire', async () => {
    await expect(service.updateBlogPost('admin_1', 'post_1', edit({ source: validMdx('Écrit par une IA.') })))
      .rejects.toThrow(/Termes interdits/)
    expect(prismaMock.blogPost.update).not.toHaveBeenCalled()
  })

  it('la longueur n’est qu’un avertissement', async () => {
    const short = 'Tu tailles ton rosier, ta haie, tes arbustes, toi seul décides.\n\n## Un\n\n## Deux\n\n## Trois\n\n<Callout>Court.</Callout>'

    const { warnings } = await service.updateBlogPost('admin_1', 'post_1', edit({ source: short }))

    expect(warnings.join()).toMatch(/Trop court/)
    expect(prismaMock.blogPost.update).toHaveBeenCalled()
  })

  it('ne journalise que les champs réellement changés, fins de ligne Windows comprises', async () => {
    const windows = `${validMdx().replace(/\n/g, '\r\n')}\r\n`

    await service.updateBlogPost('admin_1', 'post_1', edit({ title: 'Pailler ses massifs, sans étouffer le sol', source: windows }))

    const { data } = prismaMock.blogPost.update.mock.calls[0][0]
    expect(data.source).not.toContain('\r')
    expect(journal[0]).toMatchObject({ action: 'blog.update', details: { champs: ['title'] } })
  })

  it('garde l’ordre des tags : le premier est l’étiquette de la carte', () => {
    expect(service.keepTagOrder(['entretien', 'saison'], ['saison', 'entretien'])).toEqual(['entretien', 'saison'])
    expect(service.keepTagOrder(['entretien', 'saison'], ['potager', 'saison'])).toEqual(['saison', 'potager'])
  })
})

describe('cadence', () => {
  it('s’enregistre avec sa trace, et refuse une valeur inconnue', async () => {
    await service.setCadence('admin_1', 'monthly')
    expect(journal[0]).toMatchObject({ action: 'blog.cadence', targetType: 'app_setting', targetId: 'blog.cadence' })

    await expect(service.setCadence('admin_1', 'daily' as never)).rejects.toThrow()
  })
})
