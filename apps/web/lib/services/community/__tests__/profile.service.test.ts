import { beforeEach, describe, expect, it, vi } from 'vitest'

// La communauté est la première surface de Growi où les données d'un compte
// sont lues par quelqu'un d'autre. Ce qui est vérifié ici tient en deux
// points : ce qui ne doit pas sortir ne sort pas, et bloquer coupe vraiment.

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  follow: { findUnique: vi.fn(), count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  block: { findUnique: vi.fn(), findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const notifyFollow = vi.hoisted(() => vi.fn())
vi.mock('../notification.service', () => ({ notifyFollow }))

const { block, follow, getProfileByHandle, hiddenUserIds, updateSettings } = await import(
  '../profile.service'
)
const { toCommunityUser } = await import('../serializers')
const { ServiceError } = await import('../../errors')

const ME = 'user_me'
const THEM = 'user_them'

/** Ligne Prisma volontairement polluée de tout ce qui ne doit pas sortir. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: THEM,
    handle: 'pierre',
    bio: 'Potager de 100 m²',
    image: 'https://storage/avatar.jpg',
    avatarColor: '#B4DD7F',
    locationCity: 'Tours',
    fuzzyLat: 47.39,
    fuzzyLng: 0.69,
    followerCount: 12,
    followingCount: 3,
    postCount: 8,
    communityEnabled: true,
    communityEnabledAt: new Date('2026-09-01T10:00:00.000Z'),
    disabledAt: null,
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    // Rien de ce qui suit ne doit apparaître dans une réponse.
    email: 'pierre@exemple.fr',
    name: 'Pierre Durand',
    firstName: 'Pierre',
    lastName: 'Durand',
    address: '12 rue des Lilas, 37000 Tours',
    latitude: 47.3941,
    longitude: 0.6848,
    password: '$2a$10$hash',
    ...overrides,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    typeof fn === 'function' ? fn(prismaMock) : fn,
  )
})

describe('toCommunityUser', () => {
  it('ne laisse passer aucune donnée privée', () => {
    const result = toCommunityUser(row(), null) as Record<string, unknown>

    // Construit champ par champ, jamais par recopie : une colonne ajoutée
    // demain à `User` ne peut pas apparaître toute seule.
    expect(Object.keys(result).sort()).toEqual(
      ['avatarColor', 'avatarUrl', 'city', 'distanceLabel', 'handle', 'id'].sort(),
    )

    const serialized = JSON.stringify(result)
    for (const secret of [
      'pierre@exemple.fr',
      'Durand',
      'rue des Lilas',
      '47.3941',
      '$2a$10$',
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('n’expose la position que sous forme de distance arrondie', () => {
    const result = toCommunityUser(row(), { fuzzyLat: 47.5, fuzzyLng: 0.7 })

    expect(result.distanceLabel).toMatch(/^à /)
    expect(result).not.toHaveProperty('lat')
    expect(result).not.toHaveProperty('fuzzyLat')
  })
})

describe('getProfileByHandle', () => {
  it('répond « introuvable » sur un profil non activé', () => {
    prismaMock.user.findUnique.mockResolvedValue(row({ communityEnabled: false }))

    return expect(getProfileByHandle('pierre', ME)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('répond « introuvable » sur un compte désactivé par un administrateur', () => {
    prismaMock.user.findUnique.mockResolvedValue(row({ disabledAt: new Date() }))

    return expect(getProfileByHandle('pierre', ME)).rejects.toBeInstanceOf(ServiceError)
  })

  it('répond « introuvable », et non « tu es bloqué », à un compte bloqué', async () => {
    // Dire « ce compte t'a bloqué » confirmerait son existence à celui dont il
    // veut se protéger.
    prismaMock.user.findUnique.mockResolvedValue(row())
    prismaMock.block.findUnique.mockResolvedValue({ blockerId: THEM })

    await expect(getProfileByHandle('pierre', ME)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('introuvable'),
    })
  })

  it('rend isFollowing à null pour un lecteur anonyme', async () => {
    prismaMock.user.findUnique.mockResolvedValue(row())

    const profile = await getProfileByHandle('pierre', null)

    // `null` et non `false` : il n'y a personne pour suivre.
    expect(profile.isFollowing).toBeNull()
    expect(profile.isBlocked).toBeNull()
    expect(profile.distanceLabel).toBeNull()
  })
})

describe('follow', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(row())
    prismaMock.block.findUnique.mockResolvedValue(null)
    prismaMock.follow.count.mockResolvedValue(0)
  })

  it('refuse de se suivre soi-même', async () => {
    prismaMock.user.findUnique.mockResolvedValue(row({ id: ME }))

    await expect(follow(ME, 'moi')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('n’incrémente rien quand l’abonnement existe déjà', async () => {
    prismaMock.follow.createMany.mockResolvedValue({ count: 0 })

    const result = await follow(ME, 'pierre')

    // Idempotent : un double tap ne doit pas gonfler le compteur.
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(result).toEqual({ isFollowing: true, followerCount: 12 })
  })

  it('ne notifie pas deux fois le même abonnement', async () => {
    // Un double tap, ou un désabonnement suivi d'un réabonnement, préviendrait
    // sinon la même personne autant de fois.
    prismaMock.follow.createMany.mockResolvedValue({ count: 0 })

    await follow(ME, 'pierre')

    expect(notifyFollow).not.toHaveBeenCalled()
  })

  it('notifie quand l’abonnement vient d’être créé', async () => {
    prismaMock.follow.createMany.mockResolvedValue({ count: 1 })
    prismaMock.user.update.mockResolvedValue({ followerCount: 13 } as never)

    await follow(ME, 'pierre')

    expect(notifyFollow).toHaveBeenCalledOnce()
    expect(notifyFollow.mock.calls[0][1]).toBe(THEM)
  })

  it('refuse de suivre un compte qu’on a soi-même bloqué', async () => {
    // Les deux sens se distinguent : « il m'a bloqué » sort en 404 depuis la
    // lecture du profil, « je l'ai bloqué » se dit franchement.
    prismaMock.block.findUnique.mockImplementation(
      async ({ where }: { where: { blockerId_blockedId: { blockerId: string } } }) =>
        where.blockerId_blockedId.blockerId === ME ? { blockerId: ME } : null,
    )

    await expect(follow(ME, 'pierre')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('freine au-delà du plafond quotidien', async () => {
    prismaMock.follow.count.mockResolvedValue(200)

    await expect(follow(ME, 'pierre')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('block', () => {
  it('rompt les abonnements dans les deux sens', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: THEM })
    prismaMock.block.createMany.mockResolvedValue({ count: 1 })
    prismaMock.follow.deleteMany.mockResolvedValue({ count: 1 })

    await block(ME, 'pierre')

    // Rester abonné à quelqu'un dont on ne verra plus rien laisserait un
    // compteur qui ment et une ligne qui ne mène nulle part.
    expect(prismaMock.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: ME, followingId: THEM },
    })
    expect(prismaMock.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: THEM, followingId: ME },
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: ME },
      data: { followingCount: { decrement: 1 }, followerCount: { decrement: 1 } },
    })
  })

  it('refuse de se bloquer soi-même', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: ME })

    await expect(block(ME, 'moi')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('hiddenUserIds', () => {
  it('écarte les deux sens du blocage', async () => {
    prismaMock.block.findMany.mockResolvedValue([
      { blockerId: ME, blockedId: 'a' },
      { blockerId: 'b', blockedId: ME },
    ])

    // N'en filtrer qu'un laisserait le contenu du bloqueur visible par le
    // bloqué, ce qui vide le blocage de son sens.
    expect((await hiddenUserIds(ME)).sort()).toEqual(['a', 'b'])
  })

  it('ne consulte pas la base pour un lecteur anonyme', async () => {
    expect(await hiddenUserIds(null)).toEqual([])
    expect(prismaMock.block.findMany).not.toHaveBeenCalled()
  })
})

describe('updateSettings', () => {
  const settings = {
    handle: null,
    bio: null,
    communityEnabled: false,
    communityEnabledAt: null,
    communityRadiusKm: 20,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    locationCity: null,
    latitude: null,
    longitude: null,
  }

  it('refuse l’activation sans pseudo', async () => {
    prismaMock.user.findUnique.mockResolvedValue(settings as never)

    await expect(updateSettings(ME, { enabled: true })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('refuse l’activation sans position', async () => {
    // Sans position, ni fil local ni distance : le profil serait activé et
    // invisible.
    prismaMock.user.findUnique.mockResolvedValue({ ...settings, handle: 'julie' } as never)

    await expect(updateSettings(ME, { enabled: true })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: expect.stringContaining('ville'),
    })
  })

  it('calcule la position floutée à l’activation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...settings,
      latitude: 48.8566,
      longitude: 2.3522,
    } as never)
    prismaMock.user.update.mockResolvedValue({
      ...settings,
      handle: 'julie',
      communityEnabled: true,
    } as never)

    await updateSettings(ME, { enabled: true, handle: 'julie' })

    const data = prismaMock.user.update.mock.calls[0][0].data
    expect(data.fuzzyLat).toBeDefined()
    // Jamais la position exacte : c'est toute la raison d'être du flou.
    expect(data.fuzzyLat).not.toBe(48.8566)
    expect(data.communityEnabledAt).toBeInstanceOf(Date)
  })

  it('laisse changer le rayon sans toucher au reste', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...settings,
      handle: 'julie',
      communityEnabled: true,
    } as never)
    prismaMock.user.update.mockResolvedValue({
      ...settings,
      handle: 'julie',
      communityEnabled: true,
      communityRadiusKm: 50,
    } as never)

    await updateSettings(ME, { radiusKm: 50 })

    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ communityRadiusKm: 50 })
  })
})
