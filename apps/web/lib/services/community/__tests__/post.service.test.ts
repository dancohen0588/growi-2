import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le fil est la première surface de Growi où le contenu de quelqu'un d'autre
// s'affiche. Ce qui est vérifié ici : ce qu'il refuse de publier, ce qu'il
// refuse de montrer, et le fait qu'un rayon élargi ne se rétracte pas d'une
// page à l'autre.

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  post: { create: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  postLike: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  comment: { create: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  plantInstance: { findFirst: vi.fn() },
  block: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const deletePhotoByUrl = vi.hoisted(() => vi.fn())
vi.mock('@/lib/storage', () => ({ deletePhotoByUrl }))

const {
  addComment,
  createPost,
  deletePost,
  getHome,
  getFeed,
  setLike,
} = await import('../post.service')
const { decodeCursor, encodeCursor } = await import('../cursor')

const ME = 'user_me'
const POST = 'post_1'

/** Auteur en règle : profil public activé et position floutée connue. */
const PUBLISHER = { communityEnabled: true, fuzzyLat: 47.39, fuzzyLng: 0.69 }

const AUTHOR = {
  id: ME,
  handle: 'julie',
  bio: null,
  image: null,
  avatarColor: '#B4DD7F',
  locationCity: 'Tours',
  fuzzyLat: 47.39,
  fuzzyLng: 0.69,
  followerCount: 0,
  followingCount: 0,
  postCount: 1,
  communityEnabled: true,
  communityEnabledAt: null,
  disabledAt: null,
  createdAt: new Date('2026-04-01T10:00:00.000Z'),
}

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: POST,
    userId: ME,
    body: 'Mon monstera a doublé de taille',
    photos: ['https://storage/users/user_me/post/a.jpg'],
    plantLabel: 'Monstera',
    plantInstanceId: 'plant_1',
    likeCount: 2,
    commentCount: 0,
    status: 'visible',
    createdAt: new Date('2026-09-07T10:00:00.000Z'),
    updatedAt: new Date('2026-09-07T10:00:00.000Z'),
    user: AUTHOR,
    ...overrides,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    typeof fn === 'function' ? fn(prismaMock) : fn,
  )
  prismaMock.block.findMany.mockResolvedValue([])
  prismaMock.postLike.findMany.mockResolvedValue([])
})

describe('createPost', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(PUBLISHER as never)
    prismaMock.post.count.mockResolvedValue(0)
    prismaMock.post.create.mockResolvedValue(postRow())
  })

  it('refuse de publier sans profil public activé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...PUBLISHER, communityEnabled: false } as never)

    await expect(
      createPost(ME, { body: 'Coucou', photos: ['https://storage/a.jpg'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('refuse de publier sans position floutée', async () => {
    // Sans position, la publication n'irait dans le fil de personne.
    prismaMock.user.findUnique.mockResolvedValue({ ...PUBLISHER, fuzzyLat: null } as never)

    await expect(
      createPost(ME, { body: 'Coucou', photos: ['https://storage/a.jpg'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('recopie la position floutée de l’auteur, jamais sa position réelle', async () => {
    await createPost(ME, { body: 'Coucou', photos: ['https://storage/a.jpg'] })

    // Recopiée et non jointe : déménager ne doit pas déplacer après coup une
    // photo prise dans l'ancien jardin.
    expect(prismaMock.post.create.mock.calls[0][0].data).toMatchObject({
      lat: PUBLISHER.fuzzyLat,
      lng: PUBLISHER.fuzzyLng,
    })
  })

  it('fige le nom de la plante au moment de la publication', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue({
      id: 'plant_1',
      customName: 'Mon monstera',
      catalogPlant: { commonName: 'Monstera deliciosa' },
    } as never)

    await createPost(ME, {
      body: 'Coucou',
      photos: ['https://storage/a.jpg'],
      plantInstanceId: 'plant_1',
    })

    expect(prismaMock.post.create.mock.calls[0][0].data.plantLabel).toBe('Mon monstera')
  })

  it('ignore une plante qui n’est pas la sienne', async () => {
    // On ne met pas en avant le monstera d'un autre.
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await createPost(ME, {
      body: 'Coucou',
      photos: ['https://storage/a.jpg'],
      plantInstanceId: 'plant_autrui',
    })

    const { data } = prismaMock.post.create.mock.calls[0][0]
    expect(data.plantInstanceId).toBeNull()
    expect(data.plantLabel).toBeNull()
  })

  it('freine au-delà du plafond quotidien', async () => {
    prismaMock.post.count.mockResolvedValue(20)

    await expect(
      createPost(ME, { body: 'Coucou', photos: ['https://storage/a.jpg'] }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('incrémente le compteur de l’auteur dans la même transaction', async () => {
    await createPost(ME, { body: 'Coucou', photos: ['https://storage/a.jpg'] })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: ME },
      data: { postCount: { increment: 1 } },
    })
  })
})

describe('deletePost', () => {
  it('retire les photos du stockage', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      id: POST,
      photos: ['https://storage/a.jpg', 'https://storage/b.jpg'],
    } as never)

    await deletePost(POST, ME)

    // Le stockage est le premier poste de coût, et une image abandonnée
    // resterait servie par une URL publique.
    expect(deletePhotoByUrl).toHaveBeenCalledTimes(2)
    // La ligne, elle, survit : commentaires et cœurs y sont accrochés.
    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: POST },
      data: { status: 'deleted' },
    })
  })

  it('refuse de supprimer la publication d’un autre', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null)

    await expect(deletePost(POST, ME)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('setLike', () => {
  beforeEach(() => {
    prismaMock.post.findFirst.mockResolvedValue(postRow())
  })

  it('n’incrémente rien quand le cœur est déjà donné', async () => {
    prismaMock.postLike.createMany.mockResolvedValue({ count: 0 })

    const result = await setLike(POST, ME, true)

    expect(prismaMock.post.update).not.toHaveBeenCalled()
    expect(result).toEqual({ liked: true, likeCount: 2 })
  })

  it('décrémente une seule fois au retrait', async () => {
    prismaMock.postLike.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.post.update.mockResolvedValue({ likeCount: 1 } as never)

    expect(await setLike(POST, ME, false)).toEqual({ liked: false, likeCount: 1 })
  })

  it('refuse d’aimer la publication d’un compte bloqué', async () => {
    prismaMock.block.findMany.mockResolvedValue([{ blockerId: ME, blockedId: 'user_them' }])
    prismaMock.post.findFirst.mockResolvedValue(postRow({ userId: 'user_them' }))

    await expect(setLike(POST, ME, true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('addComment', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(PUBLISHER as never)
    prismaMock.post.findFirst.mockResolvedValue(postRow())
    prismaMock.comment.count.mockResolvedValue(0)
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment_1',
      userId: ME,
      body: 'Superbe !',
      createdAt: new Date('2026-09-07T11:00:00.000Z'),
      user: AUTHOR,
    } as never)
  })

  it('freine au-delà de soixante commentaires dans l’heure', async () => {
    prismaMock.comment.count.mockResolvedValue(60)

    await expect(addComment(POST, ME, { body: 'Superbe !' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
  })

  it('incrémente le compteur de la publication', async () => {
    await addComment(POST, ME, { body: 'Superbe !' })

    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: POST },
      data: { commentCount: { increment: 1 } },
    })
  })
})

describe('getFeed — autour de moi', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...PUBLISHER,
      communityRadiusKm: 5,
    } as never)
    prismaMock.post.findMany.mockResolvedValue([])
  })

  it('refuse le fil sans profil public activé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...PUBLISHER,
      communityEnabled: false,
      communityRadiusKm: 20,
    } as never)

    await expect(getFeed(ME, 'nearby', null, null)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('élargit le rayon quand le voisinage immédiat est vide', async () => {
    // Un fil qui répond « personne autour de toi » au premier lancement est un
    // fil qu'on ne rouvre pas.
    prismaMock.$queryRaw.mockResolvedValue([])

    const feed = await getFeed(ME, 'nearby', 5, null)

    expect(feed.requestedRadiusKm).toBe(5)
    expect(feed.appliedRadiusKm).toBe(50)
    expect(feed.widened).toBe(true)
  })

  it('n’élargit pas quand le rayon demandé suffit', async () => {
    prismaMock.$queryRaw.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ id: `post_${i}` })),
    )
    prismaMock.post.findMany.mockResolvedValue([])

    const feed = await getFeed(ME, 'nearby', 5, null)

    expect(feed.appliedRadiusKm).toBe(5)
    expect(feed.widened).toBe(false)
  })

  it('n’élargit jamais au milieu d’un défilement', async () => {
    // Le rayon voyage dans le curseur : sans cela, la page 2 repartirait du
    // rayon d'origine et répéterait le vide de la page 1.
    prismaMock.$queryRaw.mockResolvedValue([])
    const cursor = encodeCursor({
      createdAt: new Date('2026-09-07T10:00:00.000Z'),
      id: POST,
      radiusKm: 50,
    })

    const feed = await getFeed(ME, 'nearby', 5, cursor)

    expect(feed.appliedRadiusKm).toBe(50)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('getHome', () => {
  it('reste muet plutôt que d’échouer quand le profil n’est pas activé', async () => {
    // L'accueil ne doit pas afficher d'erreur pour une fonctionnalité que
    // l'utilisateur n'a pas demandée.
    prismaMock.user.findUnique.mockResolvedValue({
      communityEnabled: false,
      communityRadiusKm: 20,
      fuzzyLat: null,
      fuzzyLng: null,
    } as never)

    expect(await getHome(ME)).toEqual({ enabled: false, posts: [] })
  })
})

describe('curseur', () => {
  it('fait un aller-retour sans perdre le rayon', () => {
    const cursor = { createdAt: new Date('2026-09-07T10:00:00.000Z'), id: POST, radiusKm: 50 }

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('traite un curseur illisible comme une première page', () => {
    // Tolérant plutôt qu'en erreur : un curseur tronqué ramène le début du
    // fil, pas un écran rouge au milieu d'un défilement.
    expect(decodeCursor('n’importe quoi')).toBeNull()
    expect(decodeCursor(null)).toBeNull()
  })
})
