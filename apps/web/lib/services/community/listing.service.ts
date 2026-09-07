import {
  COMMUNITY_RATE_LIMITS,
  LISTING_EXPIRY_DAYS,
  LISTING_EXPIRY_REMINDER_DAYS,
  LISTING_FIRST_MESSAGE,
  LISTINGS_PAGE_SIZE,
  type CreateListingInput,
  type Listing,
  type ListingFilters,
  type ListingMessage,
  type ListingMessagePage,
  type ListingPage,
  type ListingThread,
  type ListingThreadDetail,
  type ListingThreadPage,
  type SendListingMessageInput,
  type UpdateListingInput,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import { deletePhotoByUrl } from '@/lib/storage'

import { decodeCursor, takePage } from './cursor'
import { assertClean } from './moderation.service'
import {
  notifyListingExpiring,
  notifyListingInterest,
  notifyListingMessage,
} from './notification.service'
import { hiddenUserIds } from './profile.service'
import {
  COMMUNITY_USER_SELECT,
  findViewer,
  normalizeRadius,
  toCommunityUser,
  type Viewer,
} from './serializers'

/**
 * Bourse aux graines : annonces, fils de discussion, messages.
 *
 * La bourse est **derrière le login** en v1 : une annonce porte une distance
 * relative à celui qui la lit, et se déclarer intéressé suppose un compte.
 */

const MESSAGES_PAGE_SIZE = 30
const THREADS_PAGE_SIZE = 30

const LISTING_INCLUDE = {
  user: { select: COMMUNITY_USER_SELECT },
} satisfies Prisma.ListingInclude

type ListingRow = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>

/** Les statuts qu'un lecteur autre que l'auteur peut voir. */
const PUBLIC_STATUSES = ['active', 'reserved'] as const

function toListing(
  row: ListingRow,
  viewer: Viewer,
  viewerId: string | null,
  myThreadId: string | null,
): Listing {
  const isMine = viewerId === row.userId

  return {
    id: row.id,
    author: toCommunityUser(row.user, viewer),
    kind: row.kind as Listing['kind'],
    category: row.category as Listing['category'],
    title: row.title,
    description: row.description,
    photoUrl: row.photoUrl,
    catalogPlantId: row.catalogPlantId,
    quantity: row.quantity,
    wants: row.wants,
    status: row.status as Listing['status'],
    // Le nombre d'intéressés ne regarde que l'auteur : ailleurs, il ferait de
    // la concurrence entre lecteurs sur une annonce de don.
    threadCount: isMine ? row.threadCount : null,
    expiresAt: row.expiresAt.toISOString(),
    isMine,
    myThreadId,
    createdAt: row.createdAt.toISOString(),
  }
}

// ─── Écriture d'une annonce ────────────────────────────────────────────────

/**
 * Position publiable de l'auteur, et refus net s'il n'est pas dans la
 * communauté.
 *
 * Même règle que pour les publications : sans profil public, l'annonce ne
 * serait rattachable à personne ; sans position, elle n'apparaîtrait dans
 * aucune bourse.
 */
async function requirePublisher(userId: string): Promise<{ lat: number; lng: number }> {
  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { communityEnabled: true, fuzzyLat: true, fuzzyLng: true },
  })

  if (!author?.communityEnabled || author.fuzzyLat === null || author.fuzzyLng === null) {
    throw new ServiceError(
      'FORBIDDEN',
      'Active ton profil public pour publier une annonce.',
    )
  }

  return { lat: author.fuzzyLat, lng: author.fuzzyLng }
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Publie une annonce.
 *
 * @throws ServiceError('FORBIDDEN') si le profil public n'est pas activé,
 * ServiceError('RATE_LIMITED') au-delà de dix annonces simultanément en ligne.
 */
export async function createListing(
  userId: string,
  input: CreateListingInput,
): Promise<Listing> {
  const position = await requirePublisher(userId)
  assertClean(input.title, input.description, input.quantity, input.wants)

  // Le plafond porte sur les annonces **ouvertes**, pas sur un débit : dix
  // annonces en ligne, c'est déjà beaucoup pour un jardin, et rien n'empêche
  // d'en clore une pour en ouvrir une autre.
  const open = await prisma.listing.count({
    where: { userId, status: { in: ['active', 'reserved'] } },
  })
  if (open >= COMMUNITY_RATE_LIMITS.activeListings) {
    throw new ServiceError(
      'RATE_LIMITED',
      'Tu as déjà dix annonces en ligne — clos-en une pour en publier une autre.',
    )
  }

  const listing = await prisma.listing.create({
    data: {
      userId,
      kind: input.kind,
      category: input.category,
      title: input.title,
      description: input.description ?? null,
      photoUrl: input.photoUrl ?? null,
      catalogPlantId: input.catalogPlantId ?? null,
      quantity: input.quantity ?? null,
      wants: input.wants ?? null,
      lat: position.lat,
      lng: position.lng,
      expiresAt: expiryFrom(new Date()),
    },
    include: LISTING_INCLUDE,
  })

  return toListing(listing, null, userId, null)
}

/**
 * Modifie son annonce — texte, statut, prolongation.
 *
 * Prolonger repart pour soixante jours **à compter de maintenant**, et non de
 * la date d'expiration : quelqu'un qui prolonge une annonce déjà expirée
 * attend qu'elle reparte pour un cycle complet.
 *
 * @throws ServiceError('NOT_FOUND') si l'annonce n'est pas la sienne.
 */
export async function updateListing(
  listingId: string,
  userId: string,
  input: UpdateListingInput,
): Promise<Listing> {
  const existing = await prisma.listing.findFirst({
    where: { id: listingId, userId, status: { not: 'deleted' } },
    select: { id: true },
  })
  if (!existing) throw new ServiceError('NOT_FOUND', 'Annonce introuvable.')

  assertClean(input.title, input.description, input.quantity, input.wants)

  const data: Prisma.ListingUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description || null
  if (input.quantity !== undefined) data.quantity = input.quantity || null
  if (input.wants !== undefined) data.wants = input.wants || null
  if (input.status !== undefined) data.status = input.status

  if (input.extend) {
    data.expiresAt = expiryFrom(new Date())
    // Le rappel repart de zéro, sinon la prochaine échéance passerait sans un
    // mot.
    data.expiryNotifiedAt = null
    // Prolonger une annonce expirée la remet en ligne : c'est ce que veut dire
    // le bouton, et le laisser en `expired` serait incompréhensible.
    if (input.status === undefined) data.status = 'active'
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data,
    include: LISTING_INCLUDE,
  })

  return toListing(updated, null, userId, null)
}

/**
 * Supprime son annonce.
 *
 * La ligne passe en `deleted` mais reste : les fils de discussion qui y sont
 * accrochés doivent rester lisibles pour les deux personnes qui s'y sont
 * parlé. La photo, elle, part du stockage.
 *
 * @throws ServiceError('NOT_FOUND') si l'annonce n'est pas la sienne.
 */
export async function deleteListing(listingId: string, userId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, userId, status: { not: 'deleted' } },
    select: { id: true, photoUrl: true },
  })
  if (!listing) throw new ServiceError('NOT_FOUND', 'Annonce introuvable.')

  await prisma.listing.update({ where: { id: listingId }, data: { status: 'deleted' } })

  // Après l'écriture : un stockage muet ne doit pas empêcher de retirer son
  // annonce.
  await deletePhotoByUrl(listing.photoUrl)
}

// ─── Lecture ───────────────────────────────────────────────────────────────

/** Le fil que ce lecteur a déjà ouvert sur ces annonces. */
async function myThreads(
  viewerId: string | null,
  listingIds: string[],
): Promise<Map<string, string>> {
  if (!viewerId || listingIds.length === 0) return new Map()

  const rows = await prisma.listingThread.findMany({
    where: { requesterId: viewerId, listingId: { in: listingIds } },
    select: { id: true, listingId: true },
  })
  return new Map(rows.map((row) => [row.listingId, row.id]))
}

/**
 * La bourse — annonces autour de soi, filtrées par type et catégorie.
 *
 * Même mécanique géographique que le fil des publications, et le même
 * élargissement automatique : une bourse vide au premier lancement est une
 * bourse qu'on ne rouvre pas.
 *
 * @throws ServiceError('FORBIDDEN') si le profil public n'est pas activé.
 */
export async function listListings(
  userId: string,
  filters: ListingFilters,
  rawCursor: string | null,
): Promise<ListingPage> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { communityEnabled: true, communityRadiusKm: true, fuzzyLat: true, fuzzyLng: true },
  })

  if (!me?.communityEnabled || me.fuzzyLat === null || me.fuzzyLng === null) {
    throw new ServiceError('FORBIDDEN', 'Active ton profil public pour voir la bourse.')
  }

  const cursor = decodeCursor(rawCursor)
  const radiusKm = cursor?.radiusKm ?? filters.radiusKm ?? normalizeRadius(me.communityRadiusKm)
  const hidden = await hiddenUserIds(userId)

  const rows = await nearbyListings(
    { lat: me.fuzzyLat, lng: me.fuzzyLng },
    radiusKm,
    filters,
    hidden,
    cursor,
  )

  const page = takePage(rows, LISTINGS_PAGE_SIZE, radiusKm)
  const [viewer, threads] = await Promise.all([
    findViewer(userId),
    myThreads(userId, page.items.map((row) => row.id)),
  ])

  return {
    items: page.items.map((row) => toListing(row, viewer, userId, threads.get(row.id) ?? null)),
    nextCursor: page.nextCursor,
  }
}

/**
 * Les annonces d'une page, en SQL brut pour la partie géographique puis
 * réhydratées par Prisma — même découpage que le fil des publications.
 */
async function nearbyListings(
  origin: { lat: number; lng: number },
  radiusKm: number,
  filters: ListingFilters,
  hidden: string[],
  cursor: { createdAt: Date; id: string } | null,
): Promise<ListingRow[]> {
  const radiusM = radiusKm * 1000

  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT l.id
    FROM listings l
    JOIN users u ON u.id = l."userId"
    WHERE l.status IN ('active', 'reserved')
      AND u."disabledAt" IS NULL
      AND u."communityEnabled" = true
      ${filters.kind ? Prisma.sql`AND l.kind = ${filters.kind}` : Prisma.empty}
      ${filters.category ? Prisma.sql`AND l.category = ${filters.category}` : Prisma.empty}
      ${
        hidden.length > 0
          ? Prisma.sql`AND l."userId" <> ALL(${hidden}::text[])`
          : Prisma.empty
      }
      AND earth_box(ll_to_earth(${origin.lat}::float8, ${origin.lng}::float8), ${radiusM}::float8)
          @> ll_to_earth(l.lat, l.lng)
      AND earth_distance(
            ll_to_earth(${origin.lat}::float8, ${origin.lng}::float8),
            ll_to_earth(l.lat, l.lng)
          ) <= ${radiusM}::float8
      ${
        cursor
          ? Prisma.sql`AND (l."createdAt", l.id) < (${cursor.createdAt}::timestamptz, ${cursor.id})`
          : Prisma.empty
      }
    ORDER BY l."createdAt" DESC, l.id DESC
    LIMIT ${LISTINGS_PAGE_SIZE + 1}::int
  `

  if (ids.length === 0) return []

  const rows = await prisma.listing.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: LISTING_INCLUDE,
  })

  // `IN` ne garantit aucun ordre : on remet celui de la bourse.
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids
    .map(({ id }) => byId.get(id))
    .filter((row): row is ListingRow => row !== undefined)
}

/** Mes annonces, tous statuts sauf supprimées. */
export async function listMyListings(userId: string, rawCursor: string | null): Promise<ListingPage> {
  const cursor = decodeCursor(rawCursor)

  const rows = await prisma.listing.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: LISTINGS_PAGE_SIZE + 1,
    include: LISTING_INCLUDE,
  })

  const page = takePage(rows, LISTINGS_PAGE_SIZE)
  return {
    items: page.items.map((row) => toListing(row, null, userId, null)),
    nextCursor: page.nextCursor,
  }
}

/**
 * Une annonce visible par ce lecteur.
 *
 * L'auteur voit la sienne dans tous les états ; les autres n'y ont accès que
 * tant qu'elle est `active` ou `reserved` — une annonce terminée, expirée ou
 * masquée n'a plus à être ouverte par un lien.
 */
async function findVisibleListing(listingId: string, viewerId: string): Promise<ListingRow> {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      user: { disabledAt: null, communityEnabled: true },
      OR: [{ userId: viewerId }, { status: { in: [...PUBLIC_STATUSES] } }],
    },
    include: LISTING_INCLUDE,
  })
  if (!listing || listing.status === 'deleted') {
    throw new ServiceError('NOT_FOUND', 'Annonce introuvable.')
  }

  const hidden = await hiddenUserIds(viewerId)
  if (hidden.includes(listing.userId)) {
    throw new ServiceError('NOT_FOUND', 'Annonce introuvable.')
  }

  return listing
}

/** @throws ServiceError('NOT_FOUND') si l'annonce n'est pas visible par ce lecteur. */
export async function getListing(listingId: string, viewerId: string): Promise<Listing> {
  const listing = await findVisibleListing(listingId, viewerId)
  const [viewer, threads] = await Promise.all([
    findViewer(viewerId),
    myThreads(viewerId, [listingId]),
  ])

  return toListing(listing, viewer, viewerId, threads.get(listingId) ?? null)
}

/**
 * L'aperçu **public** d'une annonce, pour un lien partagé hors de l'app.
 *
 * Volontairement pauvre : ni distance — elle n'a de sens que rapportée à
 * quelqu'un — ni description, ni auteur, ni moyen d'agir. Juste de quoi
 * comprendre de quoi il s'agit, et décider de créer un compte.
 *
 * Seules les annonces `active` y répondent : partager le lien d'une annonce
 * réservée ou terminée mènerait à une déception.
 */
export async function getPublicListingTeaser(listingId: string): Promise<{
  id: string
  kind: Listing['kind']
  category: Listing['category']
  title: string
  photoUrl: string | null
  city: string | null
} | null> {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      status: 'active',
      user: { disabledAt: null, communityEnabled: true },
    },
    select: {
      id: true,
      kind: true,
      category: true,
      title: true,
      photoUrl: true,
      user: { select: { locationCity: true } },
    },
  })
  if (!listing) return null

  return {
    id: listing.id,
    kind: listing.kind as Listing['kind'],
    category: listing.category as Listing['category'],
    title: listing.title,
    photoUrl: listing.photoUrl,
    city: listing.user.locationCity,
  }
}

// ─── Fils de discussion ────────────────────────────────────────────────────

const THREAD_INCLUDE = {
  listing: { select: { id: true, title: true, photoUrl: true, status: true, userId: true } },
  requester: { select: COMMUNITY_USER_SELECT },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true } },
} satisfies Prisma.ListingThreadInclude

type ThreadRow = Prisma.ListingThreadGetPayload<{ include: typeof THREAD_INCLUDE }>

function toThread(row: ThreadRow, viewerId: string, other: Parameters<typeof toCommunityUser>[0]): ListingThread {
  const isOwner = row.ownerId === viewerId
  const readAt = isOwner ? row.ownerReadAt : row.requesterReadAt

  return {
    id: row.id,
    listingId: row.listing.id,
    listingTitle: row.listing.title,
    listingPhotoUrl: row.listing.photoUrl,
    listingStatus: row.listing.status as ListingThread['listingStatus'],
    other: toCommunityUser(other, null),
    isOwner,
    lastMessage: row.messages[0]?.body ?? null,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    // Jamais lu et déjà un message ⇒ non lu.
    unread: Boolean(row.lastMessageAt) && (!readAt || readAt < row.lastMessageAt!),
    createdAt: row.createdAt.toISOString(),
  }
}

/** Les propriétaires d'annonces, pour les fils où le lecteur est l'intéressé. */
async function ownersOf(rows: ThreadRow[]): Promise<Map<string, Parameters<typeof toCommunityUser>[0]>> {
  const ids = [...new Set(rows.map((row) => row.ownerId))]
  if (ids.length === 0) return new Map()

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: COMMUNITY_USER_SELECT,
  })
  return new Map(users.map((user) => [user.id, user]))
}

/**
 * « Je suis intéressé » — ouvre le fil, ou rouvre le sien.
 *
 * Le premier message est **écrit par le serveur** : l'auteur reçoit ainsi
 * toujours quelque chose de lisible, même si l'intéressé ne trouve pas ses
 * mots. Rappeler son intérêt sur une annonce où l'on s'est déjà manifesté
 * rouvre le fil existant plutôt que d'en empiler un second.
 *
 * @throws ServiceError('INVALID_INPUT') sur sa propre annonce,
 * ServiceError('RATE_LIMITED') au-delà de trente marques d'intérêt par jour.
 */
export async function expressInterest(listingId: string, userId: string): Promise<ListingThread> {
  await requirePublisher(userId)
  const listing = await findVisibleListing(listingId, userId)

  if (listing.userId === userId) {
    throw new ServiceError('INVALID_INPUT', 'C’est ta propre annonce.')
  }
  if (listing.status !== 'active') {
    throw new ServiceError('CONFLICT', 'Cette annonce n’est plus disponible.')
  }

  const existing = await prisma.listingThread.findUnique({
    where: { listingId_requesterId: { listingId, requesterId: userId } },
    include: THREAD_INCLUDE,
  })

  if (existing) {
    const owners = await ownersOf([existing])
    return toThread(existing, userId, owners.get(existing.ownerId) ?? listing.user)
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await prisma.listingThread.count({
    where: { requesterId: userId, createdAt: { gte: since } },
  })
  if (recent >= COMMUNITY_RATE_LIMITS.listingInterestsPerDay) {
    throw new ServiceError('RATE_LIMITED', 'Tu t’es manifesté sur beaucoup d’annonces aujourd’hui.')
  }

  const now = new Date()
  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.listingThread.create({
      data: {
        listingId,
        ownerId: listing.userId,
        requesterId: userId,
        lastMessageAt: now,
        // L'intéressé a « lu » le message qu'il vient d'envoyer.
        requesterReadAt: now,
        messages: { create: { userId, body: LISTING_FIRST_MESSAGE } },
      },
      include: THREAD_INCLUDE,
    })

    await tx.listing.update({
      where: { id: listingId },
      data: { threadCount: { increment: 1 } },
    })

    return created
  })

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } })
  void notifyListingInterest(
    { id: userId, handle: me?.handle ?? null },
    { id: listingId, userId: listing.userId, title: listing.title },
    thread.id,
  )

  return toThread(thread, userId, listing.user)
}

/** Mes fils, les deux rôles confondus, du plus récemment animé au plus ancien. */
export async function listThreads(
  userId: string,
  rawCursor: string | null,
): Promise<ListingThreadPage> {
  const cursor = decodeCursor(rawCursor)
  const hidden = await hiddenUserIds(userId)

  const rows = await prisma.listingThread.findMany({
    where: {
      OR: [{ ownerId: userId }, { requesterId: userId }],
      ...(hidden.length > 0
        ? { AND: [{ ownerId: { notIn: hidden } }, { requesterId: { notIn: hidden } }] }
        : {}),
      ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
    },
    // `lastMessageAt` d'abord : un fil se retrouve par sa dernière activité.
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    take: THREADS_PAGE_SIZE + 1,
    include: THREAD_INCLUDE,
  })

  const page = takePage(rows, THREADS_PAGE_SIZE)
  const owners = await ownersOf(page.items)

  return {
    items: page.items.map((row) =>
      toThread(
        row,
        userId,
        // L'autre personne : l'auteur si je suis l'intéressé, et l'inverse.
        row.ownerId === userId ? row.requester : (owners.get(row.ownerId) ?? row.requester),
      ),
    ),
    nextCursor: page.nextCursor,
  }
}

/** Les intéressés d'une annonce — vue de son auteur. */
export async function listListingThreads(
  listingId: string,
  userId: string,
): Promise<ListingThread[]> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, userId },
    select: { id: true },
  })
  if (!listing) throw new ServiceError('NOT_FOUND', 'Annonce introuvable.')

  const rows = await prisma.listingThread.findMany({
    where: { listingId },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    include: THREAD_INCLUDE,
  })

  return rows.map((row) => toThread(row, userId, row.requester))
}

/**
 * Un fil dont le lecteur est l'une des deux parties.
 *
 * @throws ServiceError('NOT_FOUND') sinon — un fil n'a que deux lecteurs
 * légitimes, et répondre « interdit » confirmerait son existence à un tiers.
 */
async function findMyThread(threadId: string, userId: string): Promise<ThreadRow> {
  const thread = await prisma.listingThread.findFirst({
    where: { id: threadId, OR: [{ ownerId: userId }, { requesterId: userId }] },
    include: THREAD_INCLUDE,
  })
  if (!thread) throw new ServiceError('NOT_FOUND', 'Discussion introuvable.')

  const hidden = await hiddenUserIds(userId)
  const other = thread.ownerId === userId ? thread.requesterId : thread.ownerId
  if (hidden.includes(other)) throw new ServiceError('NOT_FOUND', 'Discussion introuvable.')

  return thread
}

function toMessage(
  row: { id: string; threadId: string; userId: string; body: string; photoUrl: string | null; createdAt: Date },
  viewerId: string,
): ListingMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    isMine: row.userId === viewerId,
    body: row.body,
    photoUrl: row.photoUrl,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Ouvre un fil et **marque la lecture** au passage.
 *
 * Le marquage est ici plutôt que dans une route à part : ouvrir un fil, c'est
 * le lire, et demander un second appel pour l'admettre laisserait le badge
 * allumé sur un écran qu'on a sous les yeux.
 */
export async function getThread(threadId: string, userId: string): Promise<ListingThreadDetail> {
  const thread = await findMyThread(threadId, userId)
  const messages = await listMessages(threadId, userId, null)

  const isOwner = thread.ownerId === userId
  await prisma.listingThread.update({
    where: { id: threadId },
    data: isOwner ? { ownerReadAt: new Date() } : { requesterReadAt: new Date() },
  })

  const owners = await ownersOf([thread])
  const other = isOwner ? thread.requester : (owners.get(thread.ownerId) ?? thread.requester)

  // Le fil est rendu **avant** le marquage de lecture pour que le badge soit
  // encore visible sur la carte d'où l'on vient — la liste, elle, se
  // rafraîchira.
  return { ...toThread(thread, userId, other), unread: false, messages }
}

export async function listMessages(
  threadId: string,
  userId: string,
  rawCursor: string | null,
): Promise<ListingMessagePage> {
  await findMyThread(threadId, userId)
  const cursor = decodeCursor(rawCursor)

  const rows = await prisma.listingMessage.findMany({
    where: {
      threadId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MESSAGES_PAGE_SIZE + 1,
  })

  const page = takePage(rows, MESSAGES_PAGE_SIZE)
  return {
    items: page.items.map((row) => toMessage(row, userId)),
    nextCursor: page.nextCursor,
  }
}

/**
 * Écrit dans un fil.
 *
 * Un fil reste ouvert quel que soit l'état de l'annonce : convenir d'un
 * rendez-vous se fait souvent après l'avoir marquée réservée, et la fermer
 * couperait la conversation au pire moment.
 */
export async function sendMessage(
  threadId: string,
  userId: string,
  input: SendListingMessageInput,
): Promise<ListingMessage> {
  const thread = await findMyThread(threadId, userId)
  assertClean(input.body)
  const now = new Date()
  const isOwner = thread.ownerId === userId

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.listingMessage.create({
      data: { threadId, userId, body: input.body, photoUrl: input.photoUrl ?? null },
    })

    await tx.listingThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: now,
        // Écrire, c'est avoir lu : sinon son propre message rendrait le fil
        // non lu pour son auteur.
        ...(isOwner ? { ownerReadAt: now } : { requesterReadAt: now }),
      },
    })

    return created
  })

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } })
  void notifyListingMessage(
    { id: userId, handle: me?.handle ?? null },
    isOwner ? thread.requesterId : thread.ownerId,
    { threadId, listingId: thread.listing.id, listingTitle: thread.listing.title },
    input.body,
  )

  return toMessage(message, userId)
}

// ─── Expiration ────────────────────────────────────────────────────────────

export interface ListingUpkeepResult {
  /** Annonces passées en `expired`. */
  expired: number
  /** Auteurs prévenus que leur annonce expire bientôt. */
  reminded: number
}

/**
 * Entretien quotidien de la bourse : expiration, puis rappel J‑7.
 *
 * Dans cet ordre, et pas l'inverse : rappeler qu'une annonce expire dans sept
 * jours juste après l'avoir expirée serait absurde.
 *
 * Ne lève pas — appelée depuis la tournée des rappels, qu'elle ne doit pas
 * faire échouer.
 */
export async function runListingUpkeep(now = new Date()): Promise<ListingUpkeepResult> {
  const { count: expired } = await prisma.listing.updateMany({
    where: { status: { in: ['active', 'reserved'] }, expiresAt: { lte: now } },
    data: { status: 'expired' },
  })

  // Fenêtre J‑7 : les annonces qui expirent dans la semaine et dont l'auteur
  // n'a pas déjà été prévenu pour cette échéance-ci. `expiryNotifiedAt` est
  // remis à zéro par une prolongation, ce qui rouvre le droit à un rappel.
  const horizon = new Date(now.getTime() + LISTING_EXPIRY_REMINDER_DAYS * 24 * 60 * 60 * 1000)
  const expiring = await prisma.listing.findMany({
    where: {
      status: 'active',
      expiresAt: { gt: now, lte: horizon },
      expiryNotifiedAt: null,
    },
    select: { id: true, userId: true, title: true },
  })

  for (const listing of expiring) {
    // Un rappel raté ne doit pas empêcher les suivants, ni faire retenter
    // celui-ci indéfiniment : on note l'envoi dans tous les cas.
    await notifyListingExpiring(listing)
    await prisma.listing.update({
      where: { id: listing.id },
      data: { expiryNotifiedAt: now },
    })
  }

  return { expired, reminded: expiring.length }
}
