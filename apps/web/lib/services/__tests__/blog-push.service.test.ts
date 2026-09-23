import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ALERT_CONFIG } from '@growi/shared'

const prismaMock = vi.hoisted(() => ({
  blogPost: { findFirst: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
  pushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const trackServer = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/server', () => ({ trackServer, setPersonProperties: vi.fn() }))

const sendPushMessages = vi.hoisted(() => vi.fn())
vi.mock('@/lib/push/expo-push', () => ({ sendPushMessages }))

vi.mock('@/lib/services/planning.service', () => ({ getTodayPlanning: vi.fn() }))

const { announceNewArticle, wantsBlogAnnouncement, ANNOUNCEMENT_TITLE } = await import('../blog-push.service')

// Lundi 6 h UTC : 8 h à Paris.
const NOW = new Date('2026-09-28T06:00:00Z')

const ARTICLE = { id: 'post_1', slug: 'feuilles-mortes', title: 'Feuilles mortes : en faire un paillage' }

function user(id: string, alertConfig: Record<string, unknown> | null = null, tokens = [`ExponentPushToken[${id}]`]) {
  return { id, timezone: 'Europe/Paris', alertConfig, pushTokens: tokens.map(token => ({ token })) }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.blogPost.findFirst.mockResolvedValue(ARTICLE)
  prismaMock.blogPost.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findMany.mockResolvedValue([user('u1')])
  prismaMock.pushToken.findMany.mockResolvedValue([])
  sendPushMessages.mockResolvedValue({ sent: 1, failed: 0, invalidTokens: [] })
})

describe('announceNewArticle', () => {
  it('ne fait rien s’il n’y a pas d’article à annoncer', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null)

    expect(await announceNewArticle(NOW)).toMatchObject({ slug: null, notified: 0 })
    expect(sendPushMessages).not.toHaveBeenCalled()
  })

  it('cherche le plus ancien article publié, demandé et pas encore annoncé', async () => {
    await announceNewArticle(NOW)

    expect(prismaMock.blogPost.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'PUBLISHED', pushRequestedAt: { not: null, lte: NOW }, pushSentAt: null },
      orderBy: { pushRequestedAt: 'asc' },
    }))
  })

  it('réserve l’article avant l’envoi, et n’envoie rien si un autre passage l’a pris', async () => {
    prismaMock.blogPost.updateMany.mockResolvedValue({ count: 0 })

    expect(await announceNewArticle(NOW)).toMatchObject({ slug: null })
    expect(prismaMock.blogPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'post_1', pushSentAt: null },
      data: { pushSentAt: NOW },
    })
    expect(sendPushMessages).not.toHaveBeenCalled()
  })

  it('envoie le titre de l’article, avec son slug et sans `kind`', async () => {
    const result = await announceNewArticle(NOW)

    expect(result).toMatchObject({ slug: 'feuilles-mortes', notified: 1, sent: 1 })
    const [messages] = sendPushMessages.mock.calls[0]
    expect(messages).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[u1]',
        title: ANNOUNCEMENT_TITLE,
        body: ARTICLE.title,
        data: { slug: 'feuilles-mortes' },
      }),
    ])
    expect(trackServer).toHaveBeenCalledWith('u1', 'push_sent', { kind: 'blog', tokens_count: 1 })
  })

  it('respecte le canal, les heures calmes et l’interrupteur ; un compte ancien est prévenu', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      user('ancien', { channel: 'push' }), // sans blogArticles : vrai par défaut
      user('coupe', { blogArticles: false }),
      user('sans-push', { channel: 'none' }),
      user('nuit', { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '09:00' }),
    ])

    const result = await announceNewArticle(NOW)

    expect(result.notified).toBe(1)
    expect(sendPushMessages.mock.calls[0][0].map((m: { to: string }) => m.to)).toEqual(['ExponentPushToken[ancien]'])
  })

  it('ne notifie pas une seconde fois : l’article est marqué même si personne n’est joignable', async () => {
    prismaMock.user.findMany.mockResolvedValue([])

    expect(await announceNewArticle(NOW)).toMatchObject({ slug: 'feuilles-mortes', notified: 0 })
    expect(prismaMock.blogPost.updateMany).toHaveBeenCalled()
  })
})

describe('wantsBlogAnnouncement', () => {
  it('suit la configuration par défaut', () => {
    expect(wantsBlogAnnouncement(DEFAULT_ALERT_CONFIG, 8 * 60)).toBe(true)
    expect(wantsBlogAnnouncement({ ...DEFAULT_ALERT_CONFIG, blogArticles: false }, 8 * 60)).toBe(false)
  })
})
