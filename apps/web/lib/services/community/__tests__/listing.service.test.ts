import { beforeEach, describe, expect, it, vi } from 'vitest'

// La bourse organise des rencontres entre inconnus. Ce qui est vérifié ici :
// qui peut ouvrir un fil et sur quelle annonce, l'unicité de ce fil, et le
// cycle de vie qui décide de ce qu'on voit encore.

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  listing: {
    create: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  listingThread: { create: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  listingMessage: { create: vi.fn(), findMany: vi.fn() },
  block: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const deletePhotoByUrl = vi.hoisted(() => vi.fn())
vi.mock('@/lib/storage', () => ({ deletePhotoByUrl }))

const notifyListingExpiring = vi.hoisted(() => vi.fn())
const notifyListingInterest = vi.hoisted(() => vi.fn())
const notifyListingMessage = vi.hoisted(() => vi.fn())
vi.mock('../notification.service', () => ({
  notifyListingExpiring,
  notifyListingInterest,
  notifyListingMessage,
}))

const {
  createListing,
  expressInterest,
  runListingUpkeep,
  sendMessage,
  updateListing,
} = await import('../listing.service')

const OWNER = 'user_owner'
const SEEKER = 'user_seeker'
const LISTING = 'listing_1'

const PUBLISHER = { communityEnabled: true, fuzzyLat: 47.39, fuzzyLng: 0.69 }

const AUTHOR = {
  id: OWNER,
  handle: 'pierre',
  bio: null,
  image: null,
  avatarColor: null,
  locationCity: 'Tours',
  fuzzyLat: 47.39,
  fuzzyLng: 0.69,
  followerCount: 0,
  followingCount: 0,
  postCount: 0,
  communityEnabled: true,
  communityEnabledAt: null,
  disabledAt: null,
  createdAt: new Date('2026-04-01T10:00:00.000Z'),
}

function listingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LISTING,
    userId: OWNER,
    kind: 'give',
    category: 'seeds',
    title: 'Graines de tomate cœur de bœuf',
    description: null,
    photoUrl: null,
    catalogPlantId: null,
    quantity: '~30 graines',
    wants: null,
    status: 'active',
    lat: 47.39,
    lng: 0.69,
    expiresAt: new Date('2026-11-06T10:00:00.000Z'),
    expiryNotifiedAt: null,
    threadCount: 0,
    createdAt: new Date('2026-09-07T10:00:00.000Z'),
    updatedAt: new Date('2026-09-07T10:00:00.000Z'),
    user: AUTHOR,
    ...overrides,
  } as never
}

function threadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'thread_1',
    listingId: LISTING,
    ownerId: OWNER,
    requesterId: SEEKER,
    lastMessageAt: new Date('2026-09-07T11:00:00.000Z'),
    ownerReadAt: null,
    requesterReadAt: new Date('2026-09-07T11:00:00.000Z'),
    createdAt: new Date('2026-09-07T11:00:00.000Z'),
    listing: { id: LISTING, title: 'Graines', photoUrl: null, status: 'active', userId: OWNER },
    requester: { ...AUTHOR, id: SEEKER, handle: 'marc' },
    messages: [{ body: 'Bonjour, ton annonce m’intéresse !' }],
    ...overrides,
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    typeof fn === 'function' ? fn(prismaMock) : fn,
  )
  prismaMock.block.findMany.mockResolvedValue([])
  prismaMock.user.findUnique.mockResolvedValue(PUBLISHER as never)
  prismaMock.user.findMany.mockResolvedValue([])
})

describe('createListing', () => {
  beforeEach(() => {
    prismaMock.listing.count.mockResolvedValue(0)
    prismaMock.listing.create.mockResolvedValue(listingRow())
  })

  it('refuse sans profil public activé', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...PUBLISHER, communityEnabled: false } as never)

    await expect(
      createListing(OWNER, { kind: 'give', category: 'seeds', title: 'Graines' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('pose une expiration à soixante jours', async () => {
    await createListing(OWNER, { kind: 'give', category: 'seeds', title: 'Graines' })

    const { expiresAt } = prismaMock.listing.create.mock.calls[0][0].data
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000
    expect(Math.round(days)).toBe(60)
  })

  it('recopie la position floutée de l’auteur', async () => {
    await createListing(OWNER, { kind: 'give', category: 'seeds', title: 'Graines' })

    expect(prismaMock.listing.create.mock.calls[0][0].data).toMatchObject({
      lat: PUBLISHER.fuzzyLat,
      lng: PUBLISHER.fuzzyLng,
    })
  })

  it('plafonne les annonces ouvertes, pas le débit', async () => {
    // Dix annonces en ligne, c'est déjà beaucoup pour un jardin ; rien
    // n'empêche d'en clore une pour en ouvrir une autre.
    prismaMock.listing.count.mockResolvedValue(10)

    await expect(
      createListing(OWNER, { kind: 'give', category: 'seeds', title: 'Graines' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })

    expect(prismaMock.listing.count.mock.calls[0][0].where.status).toEqual({
      in: ['active', 'reserved'],
    })
  })
})

describe('updateListing', () => {
  beforeEach(() => {
    prismaMock.listing.findFirst.mockResolvedValue({ id: LISTING } as never)
    prismaMock.listing.update.mockResolvedValue(listingRow())
  })

  it('remet une annonce expirée en ligne quand on la prolonge', async () => {
    // C'est ce que veut dire le bouton ; la laisser en `expired` serait
    // incompréhensible.
    await updateListing(LISTING, OWNER, { extend: true })

    const { data } = prismaMock.listing.update.mock.calls[0][0]
    expect(data.status).toBe('active')
    expect(data.expiryNotifiedAt).toBeNull()
    expect(data.expiresAt).toBeInstanceOf(Date)
  })

  it('refuse de modifier l’annonce d’un autre', async () => {
    prismaMock.listing.findFirst.mockResolvedValue(null)

    await expect(updateListing(LISTING, SEEKER, { title: 'À moi' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('expressInterest', () => {
  beforeEach(() => {
    prismaMock.listing.findFirst.mockResolvedValue(listingRow())
    prismaMock.listingThread.findUnique.mockResolvedValue(null)
    prismaMock.listingThread.count.mockResolvedValue(0)
    prismaMock.listingThread.create.mockResolvedValue(threadRow())
    prismaMock.listingThread.findMany.mockResolvedValue([])
  })

  it('refuse sur sa propre annonce', async () => {
    await expect(expressInterest(LISTING, OWNER)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('refuse sur une annonce réservée', async () => {
    prismaMock.listing.findFirst.mockResolvedValue(listingRow({ status: 'reserved' }))

    await expect(expressInterest(LISTING, SEEKER)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('écrit le premier message côté serveur', async () => {
    await expressInterest(LISTING, SEEKER)

    // L'auteur reçoit toujours quelque chose de lisible, même si l'intéressé
    // ne trouve pas ses mots.
    const { data } = prismaMock.listingThread.create.mock.calls[0][0]
    expect(data.messages.create.body).toContain('intéresse')
    expect(data.requesterReadAt).toBeInstanceOf(Date)
  })

  it('rouvre le fil existant au lieu d’en empiler un second', async () => {
    prismaMock.listingThread.findUnique.mockResolvedValue(threadRow())

    const thread = await expressInterest(LISTING, SEEKER)

    expect(prismaMock.listingThread.create).not.toHaveBeenCalled()
    expect(thread.id).toBe('thread_1')
  })

  it('freine au-delà du plafond quotidien', async () => {
    prismaMock.listingThread.count.mockResolvedValue(30)

    await expect(expressInterest(LISTING, SEEKER)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
  })

  it('prévient l’auteur', async () => {
    await expressInterest(LISTING, SEEKER)

    expect(notifyListingInterest).toHaveBeenCalledOnce()
  })
})

describe('sendMessage', () => {
  beforeEach(() => {
    prismaMock.listingThread.findFirst.mockResolvedValue(threadRow())
    prismaMock.listingMessage.create.mockResolvedValue({
      id: 'msg_1',
      threadId: 'thread_1',
      userId: SEEKER,
      body: 'À quelle heure ?',
      photoUrl: null,
      createdAt: new Date('2026-09-07T12:00:00.000Z'),
    } as never)
  })

  it('marque son propre message comme lu', async () => {
    await sendMessage('thread_1', SEEKER, { body: 'À quelle heure ?' })

    // Sinon son propre message rendrait le fil non lu pour son auteur.
    const { data } = prismaMock.listingThread.update.mock.calls[0][0]
    expect(data.requesterReadAt).toBeInstanceOf(Date)
    expect(data.ownerReadAt).toBeUndefined()
  })

  it('prévient l’autre partie, jamais soi-même', async () => {
    await sendMessage('thread_1', SEEKER, { body: 'À quelle heure ?' })

    expect(notifyListingMessage.mock.calls[0][1]).toBe(OWNER)
  })

  it('refuse à un tiers', async () => {
    // Un fil n'a que deux lecteurs légitimes ; un 403 confirmerait son
    // existence à un tiers.
    prismaMock.listingThread.findFirst.mockResolvedValue(null)

    await expect(
      sendMessage('thread_1', 'user_tiers', { body: 'Coucou' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('runListingUpkeep', () => {
  it('expire d’abord, rappelle ensuite', async () => {
    // Rappeler qu'une annonce expire dans sept jours juste après l'avoir
    // expirée serait absurde.
    prismaMock.listing.updateMany.mockResolvedValue({ count: 2 })
    prismaMock.listing.findMany.mockResolvedValue([
      { id: LISTING, userId: OWNER, title: 'Graines' },
    ] as never)
    prismaMock.listing.update.mockResolvedValue(listingRow())

    const result = await runListingUpkeep(new Date('2026-09-07T06:00:00.000Z'))

    expect(result).toEqual({ expired: 2, reminded: 1 })
    expect(notifyListingExpiring).toHaveBeenCalledOnce()
  })

  it('ne rappelle qu’une fois par échéance', async () => {
    prismaMock.listing.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.listing.findMany.mockResolvedValue([
      { id: LISTING, userId: OWNER, title: 'Graines' },
    ] as never)
    prismaMock.listing.update.mockResolvedValue(listingRow())

    await runListingUpkeep(new Date('2026-09-07T06:00:00.000Z'))

    // La date d'envoi est notée, et la requête n'examine que les annonces qui
    // ne l'ont pas.
    expect(prismaMock.listing.findMany.mock.calls[0][0].where.expiryNotifiedAt).toBeNull()
    expect(prismaMock.listing.update.mock.calls[0][0].data.expiryNotifiedAt).toBeInstanceOf(Date)
  })
})
