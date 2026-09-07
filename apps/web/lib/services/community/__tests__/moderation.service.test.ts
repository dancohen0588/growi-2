import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le masquage automatique tranche à la place d'un humain : ce qui compte, c'est
// qu'il ne se déclenche ni trop tôt, ni sur la foi d'un seul signaleur, ni sur
// un contenu que son auteur a déjà retiré.

const prismaMock = vi.hoisted(() => ({
  report: { createMany: vi.fn(), count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  notification: { create: vi.fn() },
  post: { findUnique: vi.fn(), update: vi.fn() },
  comment: { findUnique: vi.fn(), update: vi.fn() },
  listing: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/services/contact.service', () => ({
  addresses: () => ({ from: 'a@b.fr', to: 'info@growi-garden.fr' }),
  getResendClient: () => ({ emails: { send } }),
}))

const {
  assertClean,
  countOpenReports,
  listOpenReports,
  report,
  sendOpenReportsAlert,
  setModerationStatus,
} = await import('../moderation.service')

const ME = 'user_me'
const POST = 'post_1'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.report.createMany.mockResolvedValue({ count: 1 })
  prismaMock.report.count.mockResolvedValue(1)
  prismaMock.post.findUnique.mockResolvedValue({ userId: 'user_author', status: 'visible' })
})

describe('assertClean', () => {
  it('laisse passer un texte ordinaire', () => {
    expect(() => assertClean('Mon monstera a doublé de taille')).not.toThrow()
  })

  it('refuse un texte contenant une insulte, sans la citer', () => {
    // Répéter l'insulte à son auteur n'aiderait personne.
    try {
      assertClean('espèce de connard')
      throw new Error('aurait dû lever')
    } catch (error) {
      expect((error as { code: string }).code).toBe('INVALID_INPUT')
      expect((error as Error).message).not.toContain('connard')
    }
  })

  it('ignore les valeurs absentes', () => {
    expect(() => assertClean(null, undefined, '')).not.toThrow()
  })
})

describe('report', () => {
  it('refuse de se signaler soi-même', async () => {
    await expect(
      report(ME, { targetType: 'user', targetId: ME, reason: 'spam' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('ne masque rien en deçà du seuil', async () => {
    prismaMock.report.count.mockResolvedValue(2)

    await report(ME, { targetType: 'post', targetId: POST, reason: 'spam' })

    expect(prismaMock.post.update).not.toHaveBeenCalled()
  })

  it('masque au troisième signalement distinct et prévient l’auteur', async () => {
    prismaMock.report.count.mockResolvedValue(3)

    await report(ME, { targetType: 'post', targetId: POST, reason: 'inappropriate' })

    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: POST },
      data: { status: 'hidden' },
    })
    const { data } = prismaMock.notification.create.mock.calls[0][0]
    expect(data.userId).toBe('user_author')
    expect(data.kind).toBe('moderation')
    // Sans acteur : ce n'est personne en particulier, c'est un seuil.
    expect(data.actorId).toBeNull()
  })

  it('ne réévalue rien quand le signalement existait déjà', async () => {
    // Le seuil ne peut pas être franchi par un signalement qui n'a pas été
    // écrit — c'est ce qui empêche un signaleur acharné de le pousser seul.
    prismaMock.report.createMany.mockResolvedValue({ count: 0 })
    prismaMock.report.count.mockResolvedValue(3)

    await report(ME, { targetType: 'post', targetId: POST, reason: 'spam' })

    expect(prismaMock.post.update).not.toHaveBeenCalled()
  })

  it('ne masque pas un contenu que son auteur a déjà supprimé', async () => {
    prismaMock.report.count.mockResolvedValue(5)
    prismaMock.post.findUnique.mockResolvedValue({ userId: 'user_author', status: 'deleted' })

    await report(ME, { targetType: 'post', targetId: POST, reason: 'spam' })

    expect(prismaMock.post.update).not.toHaveBeenCalled()
  })

  it('ne masque pas deux fois, ni ne renotifie', async () => {
    prismaMock.report.count.mockResolvedValue(9)
    prismaMock.post.findUnique.mockResolvedValue({ userId: 'user_author', status: 'hidden' })

    await report(ME, { targetType: 'post', targetId: POST, reason: 'spam' })

    expect(prismaMock.post.update).not.toHaveBeenCalled()
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('ne masque jamais un compte', async () => {
    // Un compte se désactive depuis sa fiche, après lecture — pas par un seuil.
    prismaMock.report.count.mockResolvedValue(9)
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user_them' })

    await report(ME, { targetType: 'user', targetId: 'user_them', reason: 'spam' })

    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})

describe('setModerationStatus', () => {
  it('rétablit une annonce en `active`, pas en `visible`', async () => {
    // Le vocabulaire de statut d'une annonce lui est propre.
    prismaMock.listing.findUnique.mockResolvedValue({ userId: 'user_author', status: 'hidden' })

    await setModerationStatus('listing', 'listing_1', false)

    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing_1' },
      data: { status: 'active' },
    })
  })

  it('refuse de masquer un compte', async () => {
    await expect(setModerationStatus('user', 'user_them', true)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('refuse quand le contenu est déjà dans cet état', async () => {
    prismaMock.post.findUnique.mockResolvedValue({ userId: 'user_author', status: 'hidden' })

    await expect(setModerationStatus('post', POST, true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('listOpenReports', () => {
  it('groupe par contenu et trie par nombre de signalements', async () => {
    // Trois personnes qui signalent la même photo, c'est une décision à
    // prendre, pas trois.
    prismaMock.report.findMany.mockResolvedValue([
      { targetType: 'comment', targetId: 'c1', reason: 'spam', note: null, createdAt: new Date('2026-09-01') },
      { targetType: 'post', targetId: 'p1', reason: 'spam', note: 'insultant', createdAt: new Date('2026-09-02') },
      { targetType: 'post', targetId: 'p1', reason: 'inappropriate', note: null, createdAt: new Date('2026-09-03') },
    ])
    prismaMock.post.findUnique.mockResolvedValue(null)
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const groups = await listOpenReports()

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ targetId: 'p1', count: 2 })
    expect(groups[0].notes).toEqual(['insultant'])
    expect(groups[1]).toMatchObject({ targetId: 'c1', count: 1 })
  })

  it('reste lisible quand le contenu a disparu', async () => {
    prismaMock.report.findMany.mockResolvedValue([
      { targetType: 'post', targetId: 'p1', reason: 'spam', note: null, createdAt: new Date() },
    ])
    prismaMock.post.findUnique.mockResolvedValue(null)

    const [group] = await listOpenReports()

    expect(group.preview).toBeNull()
    expect(group.author).toBeNull()
  })
})

describe('sendOpenReportsAlert', () => {
  it('n’écrit pas tant que la file reste courte', async () => {
    prismaMock.report.count.mockResolvedValue(5)

    expect(await sendOpenReportsAlert()).toEqual({ open: 5, sent: false })
    expect(send).not.toHaveBeenCalled()
  })

  it('alerte au-delà du seuil', async () => {
    prismaMock.report.count.mockResolvedValue(6)

    expect(await sendOpenReportsAlert()).toEqual({ open: 6, sent: true })
    expect(send.mock.calls[0][0].subject).toContain('6')
  })

  it('ne lève pas quand l’envoi échoue', async () => {
    // Une alerte manquée est un email en moins, pas une raison de faire
    // échouer les rappels du matin.
    prismaMock.report.count.mockResolvedValue(20)
    send.mockRejectedValue(new Error('Resend indisponible'))

    expect(await sendOpenReportsAlert()).toEqual({ open: 20, sent: false })
  })
})

describe('countOpenReports', () => {
  it('ne compte que les signalements ouverts', async () => {
    prismaMock.report.count.mockResolvedValue(4)

    expect(await countOpenReports()).toBe(4)
    expect(prismaMock.report.count).toHaveBeenCalledWith({ where: { status: 'open' } })
  })
})
