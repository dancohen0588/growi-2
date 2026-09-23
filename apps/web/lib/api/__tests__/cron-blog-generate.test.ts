import { beforeEach, describe, expect, it, vi } from 'vitest'

// La route ne fait qu'orchestrer : tous ses services sont doublés.

const settings = vi.hoisted(() => ({
  acquireGenerationLock: vi.fn(),
  releaseGenerationLock: vi.fn(),
  getBlogCadence: vi.fn(),
  getLastGenerationAt: vi.fn(),
  setLastGenerationAt: vi.fn(),
  isGenerationDue: vi.fn(),
}))
vi.mock('@/lib/services/app-settings.service', () => settings)

const generator = vi.hoisted(() => ({ generateArticle: vi.fn(), countPendingDrafts: vi.fn() }))
vi.mock('@/lib/services/blog-generator.service', () => generator)

const covers = vi.hoisted(() => ({ findPendingCover: vi.fn(), generateCover: vi.fn(), MIN_COVER_BUDGET_MS: 20_000 }))
vi.mock('@/lib/services/blog-cover.service', () => covers)

const { GET } = await import('@/app/api/cron/blog-generate/route')
const { ServiceError } = await import('@/lib/services/errors')

const call = (authorization?: string) =>
  GET(new Request('http://localhost/api/cron/blog-generate', {
    headers: authorization ? { authorization } : {},
  }))

const authorized = () => call('Bearer secret-cron')
const body = async (response: Response) => (await response.json()).data

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'secret-cron')
  settings.acquireGenerationLock.mockResolvedValue(true)
  settings.releaseGenerationLock.mockResolvedValue(undefined)
  settings.getBlogCadence.mockResolvedValue('biweekly')
  settings.getLastGenerationAt.mockResolvedValue(null)
  settings.isGenerationDue.mockReturnValue(true)
  generator.countPendingDrafts.mockResolvedValue(0)
  generator.generateArticle.mockResolvedValue({ ok: true, post: { slug: 'ail-et-fraisiers' }, attempts: 1, cover: null, remainingMs: 10_000 })
  covers.findPendingCover.mockResolvedValue(null)
})

describe('authentification', () => {
  it('répond 401, sans rien dire, sans le bon secret', async () => {
    for (const header of [undefined, 'Bearer mauvais']) {
      const response = await call(header)
      expect(response.status).toBe(401)
      expect((await response.json()).error.code).toBe('UNAUTHENTICATED')
    }
    expect(settings.acquireGenerationLock).not.toHaveBeenCalled()
  })

  it('répond 503 si CRON_SECRET n\'est pas configuré', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await authorized()).status).toBe(503)
  })
})

describe('déroulé', () => {
  it('s\'arrête si un passage tient déjà le verrou, sans le rendre', async () => {
    settings.acquireGenerationLock.mockResolvedValue(false)

    expect(await body(await authorized())).toEqual({ skipped: 'locked' })
    expect(generator.generateArticle).not.toHaveBeenCalled()
    expect(settings.releaseGenerationLock).not.toHaveBeenCalled()
  })

  it('ne génère pas si la cadence ne le prévoit pas', async () => {
    settings.isGenerationDue.mockReturnValue(false)

    expect(await body(await authorized())).toMatchObject({ skipped: 'not_due' })
    expect(generator.generateArticle).not.toHaveBeenCalled()
    expect(settings.releaseGenerationLock).toHaveBeenCalled()
  })

  it('ne génère pas au-delà de deux brouillons en attente', async () => {
    generator.countPendingDrafts.mockResolvedValue(2)

    expect(await body(await authorized())).toMatchObject({ skipped: 'drafts_limit' })
    expect(generator.generateArticle).not.toHaveBeenCalled()
  })

  it('génère, note la date, et rend le verrou', async () => {
    const data = await body(await authorized())

    expect(data).toMatchObject({ generated: 'ail-et-fraisiers' })
    expect(generator.generateArticle).toHaveBeenCalledWith(expect.objectContaining({ origin: 'cron' }))
    expect(generator.generateArticle.mock.calls[0][0].timeBudgetMs).toBeLessThanOrEqual(55_000)
    expect(settings.setLastGenerationAt).toHaveBeenCalled()
    expect(settings.releaseGenerationLock).toHaveBeenCalled()
  })

  it('un échec de génération ne note pas la date : le lundi suivant retentera', async () => {
    generator.generateArticle.mockResolvedValue({ ok: false, stage: 'check', reason: 'refusé' })

    expect(await body(await authorized())).toMatchObject({ skipped: 'failed', reason: 'check : refusé' })
    expect(settings.setLastGenerationAt).not.toHaveBeenCalled()
  })

  it('un brouillon créé entre-temps depuis l\'admin vaut plafond atteint', async () => {
    generator.generateArticle.mockRejectedValue(new ServiceError('CONFLICT', 'plafond'))

    expect(await body(await authorized())).toMatchObject({ skipped: 'drafts_limit' })
  })

  it('rend le verrou même quand le passage casse', async () => {
    generator.generateArticle.mockRejectedValue(new Error('base injoignable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await authorized()).status).toBe(500)
    expect(settings.releaseGenerationLock).toHaveBeenCalled()
  })
})

describe('rattrapage des couvertures', () => {
  it('produit une couverture en attente même sans génération due', async () => {
    settings.isGenerationDue.mockReturnValue(false)
    covers.findPendingCover.mockResolvedValue({ id: 'post_old', slug: 'rentrer-ses-plantes' })
    covers.generateCover.mockResolvedValue({ ok: true, url: 'https://…', imageMs: 12_000 })

    expect(await body(await authorized())).toMatchObject({ skipped: 'not_due', coverCaughtUp: 'rentrer-ses-plantes' })
    expect(covers.generateCover).toHaveBeenCalledWith('post_old', expect.objectContaining({ budgetMs: expect.any(Number) }))
  })

  it('ne retente pas la couverture de l\'article qu\'il vient de générer', async () => {
    covers.findPendingCover.mockResolvedValue({ id: 'post_new', slug: 'ail-et-fraisiers' })

    await authorized()

    expect(covers.generateCover).not.toHaveBeenCalled()
  })
})
