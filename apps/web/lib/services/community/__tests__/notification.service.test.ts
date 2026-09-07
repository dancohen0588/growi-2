import { beforeEach, describe, expect, it, vi } from 'vitest'

// Une notification est un agrément : ce qui compte ici, c'est qu'elle ne fasse
// jamais échouer le geste qui l'a déclenchée, qu'elle ne se répète pas, et
// qu'elle ne sonne pas quand l'utilisateur a dit non.

const prismaMock = vi.hoisted(() => ({
  notification: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const sendToUser = vi.hoisted(() => vi.fn())
vi.mock('@/lib/services/push.service', () => ({ sendToUser }))

const {
  listNotifications,
  markAllRead,
  notifyComment,
  notifyFollow,
  notifyLike,
  purgeReadNotifications,
} = await import('../notification.service')

const ME = 'user_me'
const THEM = 'user_them'
const ACTOR = { id: THEM, handle: 'pierre' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.notification.create.mockResolvedValue({ id: 'notif_1' })
  prismaMock.user.findUnique.mockResolvedValue({ alertConfig: null })
})

describe('notifyFollow', () => {
  it('écrit la ligne puis pousse', async () => {
    await notifyFollow(ACTOR, ME)

    expect(prismaMock.notification.create).toHaveBeenCalled()
    const { data } = prismaMock.notification.create.mock.calls[0][0]
    expect(data.kind).toBe('follow')
    expect(data.preview).toContain('pierre')
    // La cible porte le pseudo : le tap ouvre le profil de l'acteur.
    expect(data.target).toEqual({ handle: 'pierre', postId: null })
  })

  it('ne pousse pas quand l’utilisateur a coupé les abonnements', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      alertConfig: { community: { comments: true, messages: true, follows: false } },
    })

    await notifyFollow(ACTOR, ME)

    // La ligne est écrite quand même : la cloche la montrera.
    expect(prismaMock.notification.create).toHaveBeenCalled()
    expect(sendToUser).not.toHaveBeenCalled()
  })

  it('ne pousse pas non plus par défaut, faute de réglage enregistré', async () => {
    // `follows` est le seul décoché dans DEFAULT_ALERT_CONFIG : être suivi ne
    // demande aucune réaction.
    await notifyFollow(ACTOR, ME)

    expect(sendToUser).not.toHaveBeenCalled()
  })

  it('ne se notifie pas soi-même', async () => {
    await notifyFollow({ id: ME, handle: 'moi' }, ME)

    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('ne lève pas quand la base refuse', async () => {
    // Un suivi ne doit pas échouer parce que sa notification a échoué.
    prismaMock.notification.create.mockRejectedValue(new Error('base indisponible'))

    await expect(notifyFollow(ACTOR, ME)).resolves.toBeUndefined()
  })
})

describe('notifyComment', () => {
  it('reprend le texte du commentaire, tronqué', async () => {
    const long = 'a'.repeat(200)
    await notifyComment(ACTOR, { id: 'post_1', userId: ME }, long)

    const { data } = prismaMock.notification.create.mock.calls[0][0]
    // C'est l'extrait qui donne envie d'ouvrir, bien plus que « tu as un
    // nouveau commentaire ».
    expect(data.preview.length).toBeLessThan(150)
    expect(data.preview).toContain('…')
    expect(data.target).toEqual({ postId: 'post_1', handle: 'pierre' })
  })

  it('pousse par défaut', async () => {
    await notifyComment(ACTOR, { id: 'post_1', userId: ME }, 'Superbe !')

    expect(sendToUser).toHaveBeenCalledOnce()
    expect(sendToUser.mock.calls[0][1].data).toMatchObject({ kind: 'comment', postId: 'post_1' })
  })
})

describe('notifyLike', () => {
  it('n’envoie jamais de push', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null)

    await notifyLike(ACTOR, { id: 'post_1', userId: ME, likeCount: 1 })

    // Un cœur ne vaut pas qu'un téléphone sonne.
    expect(sendToUser).not.toHaveBeenCalled()
  })

  it('agrège dans l’heure au lieu de doubler la ligne', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: 'notif_1' })

    await notifyLike(ACTOR, { id: 'post_1', userId: ME, likeCount: 5 })

    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    const { data } = prismaMock.notification.update.mock.calls[0][0]
    expect(data.preview).toBe('pierre et 4 autres ont aimé ta publication')
    // Réécrite, donc remise en non-lue : c'est une information nouvelle.
    expect(data.readAt).toBeNull()
  })

  it('accorde le singulier', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: 'notif_1' })

    await notifyLike(ACTOR, { id: 'post_1', userId: ME, likeCount: 2 })

    expect(prismaMock.notification.update.mock.calls[0][0].data.preview).toBe(
      'pierre et 1 autre ont aimé ta publication',
    )
  })

  it('ne se notifie pas d’aimer sa propre publication', async () => {
    await notifyLike({ id: ME, handle: 'moi' }, { id: 'post_1', userId: ME, likeCount: 1 })

    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})

describe('listNotifications', () => {
  it('reste lisible quand l’acteur a disparu', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'notif_1',
        kind: 'follow',
        actorId: 'compte_supprime',
        target: { handle: 'pierre', postId: null },
        preview: 'pierre s’est abonné à ton jardin',
        readAt: null,
        createdAt: new Date('2026-09-07T10:00:00.000Z'),
      },
    ])
    prismaMock.user.findMany.mockResolvedValue([])

    const page = await listNotifications(ME, null)

    // Le texte est figé : c'est ce qui permet à la ligne de survivre à son
    // acteur.
    expect(page.items[0].actor).toBeNull()
    expect(page.items[0].preview).toContain('pierre')
  })

  it('tolère une cible illisible', async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'notif_1',
        kind: 'like',
        actorId: null,
        target: 'pas un objet',
        preview: 'quelqu’un a aimé',
        readAt: null,
        createdAt: new Date(),
      },
    ])
    prismaMock.user.findMany.mockResolvedValue([])

    const page = await listNotifications(ME, null)

    expect(page.items[0].target).toEqual({ postId: null, handle: null })
  })
})

describe('markAllRead', () => {
  it('éteint le badge sans second appel', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 })

    expect(await markAllRead(ME)).toEqual({ unread: 0 })
  })
})

describe('purgeReadNotifications', () => {
  it('n’efface que les notifications lues', async () => {
    // Quelqu'un qui revient après trois mois doit retrouver ce qu'il a manqué.
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 12 })

    await purgeReadNotifications(new Date('2026-09-07T10:00:00.000Z'))

    const { where } = prismaMock.notification.deleteMany.mock.calls[0][0]
    expect(where.readAt.not).toBeNull()
    expect(where.readAt.lt).toEqual(new Date('2026-06-09T10:00:00.000Z'))
  })
})
