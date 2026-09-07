import {
  COMMUNITY_RADII_KM,
  COMMUNITY_RATE_LIMITS,
  FEED_PAGE_SIZE,
  FEED_WIDEN_BELOW,
  POST_MAX_PHOTOS,
  type CommunityComment,
  type CommunityFeed,
  type CommunityHome,
  type CommunityPost,
  type CommunityPostDetail,
  type CommunityRadiusKm,
  type CreateCommentInput,
  type CreatePostInput,
  type LikeResult,
  type UpdatePostInput,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import { deletePhotoByUrl } from '@/lib/storage'

import { decodeCursor, encodeCursor, takePage } from './cursor'
import {
  COMMUNITY_USER_SELECT,
  findViewer,
  hiddenUserIds,
  normalizeRadius,
  toCommunityUser,
  type Viewer,
} from './profile.service'

/**
 * Publications, cœurs et commentaires.
 *
 * Le fil est **local** : ce qu'on y voit dépend d'où l'on est, jamais d'un
 * algorithme. Il est donc lu en SQL brut — Prisma ne sait pas exprimer
 * `earth_box` — puis réhydraté par Prisma pour que la mise en forme reste au
 * même endroit que partout ailleurs.
 */

/** Commentaires par page, et commentaires servis avec le détail d'une publication. */
const COMMENTS_PAGE_SIZE = 20

const POST_INCLUDE = {
  user: { select: COMMUNITY_USER_SELECT },
} satisfies Prisma.PostInclude

type PostRow = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>

const COMMENT_INCLUDE = {
  user: { select: COMMUNITY_USER_SELECT },
} satisfies Prisma.CommentInclude

type CommentRow = Prisma.CommentGetPayload<{ include: typeof COMMENT_INCLUDE }>

/**
 * `Post.photos` est une colonne Json : ce qui en sort n'est typé par rien.
 * On ne rend que des chaînes, et une valeur abîmée donne une publication sans
 * photo plutôt qu'une page en erreur.
 */
function readPhotos(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toPost(row: PostRow, viewer: Viewer, viewerId: string | null, liked: Set<string>): CommunityPost {
  return {
    id: row.id,
    author: toCommunityUser(row.user, viewer),
    body: row.body,
    photos: readPhotos(row.photos),
    plantLabel: row.plantLabel,
    plantInstanceId: row.plantInstanceId,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    // `null` et non `false` pour un lecteur anonyme : personne n'est là pour aimer.
    likedByMe: viewerId ? liked.has(row.id) : null,
    isMine: viewerId === row.userId,
    createdAt: row.createdAt.toISOString(),
  }
}

function toComment(row: CommentRow, viewer: Viewer, canDelete: boolean): CommunityComment {
  return {
    id: row.id,
    author: toCommunityUser(row.user, viewer),
    body: row.body,
    canDelete,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Les publications de cet ensemble que le lecteur a déjà aimées. */
async function likedAmong(viewerId: string | null, postIds: string[]): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set()

  const rows = await prisma.postLike.findMany({
    where: { userId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  })
  return new Set(rows.map((row) => row.postId))
}

// ─── Écriture ──────────────────────────────────────────────────────────────

/**
 * Position publiable de l'auteur, et refus net s'il n'est pas dans la
 * communauté.
 *
 * Publier sans profil public créerait un contenu que personne ne peut relier à
 * quelqu'un, et sans position il n'irait dans le fil de personne.
 */
async function requirePublisher(userId: string): Promise<{ lat: number; lng: number }> {
  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { communityEnabled: true, fuzzyLat: true, fuzzyLng: true },
  })

  if (!author?.communityEnabled || author.fuzzyLat === null || author.fuzzyLng === null) {
    throw new ServiceError(
      'FORBIDDEN',
      'Active ton profil public pour partager avec la communauté.',
    )
  }

  return { lat: author.fuzzyLat, lng: author.fuzzyLng }
}

/** Nombre de contenus écrits par ce compte depuis `since`. */
async function countSince(
  model: 'post' | 'comment',
  userId: string,
  windowMs: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMs)
  const where = { userId, createdAt: { gte: since }, status: { not: 'deleted' } }

  return model === 'post' ? prisma.post.count({ where }) : prisma.comment.count({ where })
}

/**
 * Nom de la plante mise en avant, **figé**.
 *
 * Lu ici et recopié dans la publication : la plante peut être renommée ou
 * supprimée, ce que les gens ont lu ne doit pas changer sous leurs yeux.
 * Une plante qui n'est pas la sienne est simplement ignorée — on ne met pas en
 * avant le monstera d'un autre.
 */
async function freezePlantLabel(
  userId: string,
  plantInstanceId: string,
): Promise<{ plantInstanceId: string; plantLabel: string } | null> {
  const plant = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    select: { id: true, customName: true, catalogPlant: { select: { commonName: true } } },
  })
  if (!plant) return null

  return {
    plantInstanceId: plant.id,
    plantLabel: plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante',
  }
}

/**
 * Publie.
 *
 * Les photos ont déjà été déposées par `/api/v1/uploads` (kind `post`) : on ne
 * reçoit que leurs URLs. Le compteur `postCount` de l'auteur est incrémenté
 * dans la même transaction — un compteur qui dérive d'une écriture partielle
 * ne se rattrape jamais.
 *
 * @throws ServiceError('FORBIDDEN') si le profil public n'est pas activé,
 * ServiceError('RATE_LIMITED') au-delà du plafond quotidien.
 */
export async function createPost(
  userId: string,
  input: CreatePostInput,
): Promise<CommunityPost> {
  const position = await requirePublisher(userId)

  if ((await countSince('post', userId, 24 * 60 * 60 * 1000)) >= COMMUNITY_RATE_LIMITS.postsPerDay) {
    throw new ServiceError(
      'RATE_LIMITED',
      'Tu as beaucoup publié aujourd’hui — la suite demain 🌱',
    )
  }

  const plant = input.plantInstanceId
    ? await freezePlantLabel(userId, input.plantInstanceId)
    : null

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        userId,
        body: input.body,
        photos: input.photos.slice(0, POST_MAX_PHOTOS),
        lat: position.lat,
        lng: position.lng,
        plantInstanceId: plant?.plantInstanceId ?? null,
        plantLabel: plant?.plantLabel ?? null,
      },
      include: POST_INCLUDE,
    })

    await tx.user.update({ where: { id: userId }, data: { postCount: { increment: 1 } } })

    return created
  })

  return toPost(post, null, userId, new Set())
}

/**
 * Modifie le texte d'une publication — et lui seul.
 *
 * Les photos ne se remplacent pas : un cœur donné sous une image ne voudrait
 * plus rien dire si l'image pouvait changer après coup.
 *
 * @throws ServiceError('NOT_FOUND') si la publication n'est pas la sienne.
 */
export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
): Promise<CommunityPost> {
  const existing = await prisma.post.findFirst({
    where: { id: postId, userId, status: { not: 'deleted' } },
    select: { id: true },
  })
  if (!existing) throw new ServiceError('NOT_FOUND', 'Publication introuvable.')

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { body: input.body },
    include: POST_INCLUDE,
  })

  return toPost(updated, null, userId, await likedAmong(userId, [postId]))
}

/**
 * Supprime sa publication.
 *
 * La ligne passe en `deleted` mais reste : ses commentaires et son compteur de
 * cœurs perdraient sinon leur point d'ancrage. Les **photos**, elles, sont
 * bien retirées du Storage — c'est le premier poste de coût, et une image
 * abandonnée resterait servie par une URL publique.
 *
 * @throws ServiceError('NOT_FOUND') si la publication n'est pas la sienne.
 */
export async function deletePost(postId: string, userId: string): Promise<void> {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId, status: { not: 'deleted' } },
    select: { id: true, photos: true },
  })
  if (!post) throw new ServiceError('NOT_FOUND', 'Publication introuvable.')

  await prisma.$transaction(async (tx) => {
    await tx.post.update({ where: { id: postId }, data: { status: 'deleted' } })
    await tx.user.update({ where: { id: userId }, data: { postCount: { decrement: 1 } } })
  })

  // Après la transaction : un stockage qui ne répond pas ne doit pas empêcher
  // quelqu'un de retirer sa publication.
  await Promise.all(readPhotos(post.photos).map((url) => deletePhotoByUrl(url)))
}

// ─── Lecture d'une publication ─────────────────────────────────────────────

/**
 * Une publication visible par ce lecteur.
 *
 * Mêmes exclusions que le fil : masquée, supprimée, auteur désactivé, auteur
 * sorti de la communauté, ou blocage dans l'un des deux sens.
 */
async function findVisiblePost(postId: string, viewerId: string | null): Promise<PostRow> {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      status: 'visible',
      user: { disabledAt: null, communityEnabled: true },
    },
    include: POST_INCLUDE,
  })
  if (!post) throw new ServiceError('NOT_FOUND', 'Publication introuvable.')

  const hidden = await hiddenUserIds(viewerId)
  if (hidden.includes(post.userId)) {
    throw new ServiceError('NOT_FOUND', 'Publication introuvable.')
  }

  return post
}

/** @throws ServiceError('NOT_FOUND') si la publication n'est pas visible par ce lecteur. */
export async function getPost(
  postId: string,
  viewerId: string | null,
): Promise<CommunityPostDetail> {
  const post = await findVisiblePost(postId, viewerId)

  const [viewer, liked, comments] = await Promise.all([
    findViewer(viewerId),
    likedAmong(viewerId, [postId]),
    listComments(postId, viewerId, null),
  ])

  return { ...toPost(post, viewer, viewerId, liked), comments }
}

// ─── Cœurs ─────────────────────────────────────────────────────────────────

/**
 * Aimer / ne plus aimer. **Idempotent** dans les deux sens : la clé primaire
 * de `PostLike` est la paire (publication, compte), et le compteur ne bouge
 * que si une ligne a réellement été écrite ou retirée.
 */
export async function setLike(
  postId: string,
  userId: string,
  liked: boolean,
): Promise<LikeResult> {
  const post = await findVisiblePost(postId, userId)

  const likeCount = await prisma.$transaction(async (tx) => {
    const changed = liked
      ? (await tx.postLike.createMany({ data: { postId, userId }, skipDuplicates: true })).count
      : (await tx.postLike.deleteMany({ where: { postId, userId } })).count

    if (changed === 0) return post.likeCount

    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: liked ? { increment: 1 } : { decrement: 1 } },
      select: { likeCount: true },
    })
    return updated.likeCount
  })

  return { liked, likeCount }
}

// ─── Commentaires ──────────────────────────────────────────────────────────

/** Une page de commentaires, du plus récent au plus ancien. */
export async function listComments(
  postId: string,
  viewerId: string | null,
  rawCursor: string | null,
): Promise<CommunityPostDetail['comments']> {
  const cursor = decodeCursor(rawCursor)
  const hidden = await hiddenUserIds(viewerId)

  const rows = await prisma.comment.findMany({
    where: {
      postId,
      status: 'visible',
      user: { disabledAt: null, communityEnabled: true },
      ...(hidden.length > 0 ? { userId: { notIn: hidden } } : {}),
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
    take: COMMENTS_PAGE_SIZE + 1,
    include: COMMENT_INCLUDE,
  })

  const page = takePage(rows, COMMENTS_PAGE_SIZE)
  const viewer = await findViewer(viewerId)

  // L'auteur de la publication peut retirer un commentaire chez lui : c'est sa
  // page, et il est le premier exposé à ce qu'on y écrit.
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } })

  return {
    items: page.items.map((row) =>
      toComment(row, viewer, Boolean(viewerId) && (row.userId === viewerId || post?.userId === viewerId)),
    ),
    nextCursor: page.nextCursor,
  }
}

/**
 * Commenter.
 *
 * @throws ServiceError('FORBIDDEN') si le profil public n'est pas activé,
 * ServiceError('RATE_LIMITED') au-delà de soixante commentaires dans l'heure.
 */
export async function addComment(
  postId: string,
  userId: string,
  input: CreateCommentInput,
): Promise<CommunityComment> {
  await requirePublisher(userId)
  await findVisiblePost(postId, userId)

  if (
    (await countSince('comment', userId, 60 * 60 * 1000)) >=
    COMMUNITY_RATE_LIMITS.commentsPerHour
  ) {
    throw new ServiceError('RATE_LIMITED', 'Doucement — reprends dans quelques minutes.')
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { postId, userId, body: input.body },
      include: COMMENT_INCLUDE,
    })
    await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } })
    return created
  })

  return toComment(comment, null, true)
}

/**
 * Supprime un commentaire — le sien, ou n'importe lequel sur sa propre
 * publication.
 *
 * @throws ServiceError('NOT_FOUND') si le commentaire n'existe pas ou n'est ni
 * l'un ni l'autre. Un 404 plutôt qu'un 403 : répondre « interdit » confirmerait
 * l'existence d'un commentaire qu'on ne peut de toute façon pas voir ici.
 */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      status: 'visible',
      OR: [{ userId }, { post: { userId } }],
    },
    select: { id: true, postId: true },
  })
  if (!comment) throw new ServiceError('NOT_FOUND', 'Commentaire introuvable.')

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { status: 'deleted' } })
    await tx.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    })
  })
}

// ─── Fil « Autour de moi » ─────────────────────────────────────────────────

/** Le palier au-dessus, ou `null` si l'on est déjà au plus large. */
function widerRadius(km: number): number | null {
  return COMMUNITY_RADII_KM.find((palier) => palier > km) ?? null
}

/**
 * Les identifiants des publications d'une page, dans l'ordre du fil.
 *
 * En SQL brut parce que `earth_box` n'a pas d'équivalent Prisma. On n'y lit
 * que des identifiants : la mise en forme reste ensuite entièrement du côté
 * typé, avec les mêmes sérialiseurs que partout ailleurs.
 */
async function nearbyPostIds(
  origin: { lat: number; lng: number },
  radiusKm: number,
  hidden: string[],
  cursor: { createdAt: Date; id: string } | null,
  take: number,
): Promise<string[]> {
  const radiusM = radiusKm * 1000

  // `earth_box` élimine grossièrement grâce à l'index GiST ; `earth_distance`
  // découpe ensuite le vrai cercle dans ce carré.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM posts p
    JOIN users u ON u.id = p."userId"
    WHERE p.status = 'visible'
      AND u."disabledAt" IS NULL
      AND u."communityEnabled" = true
      ${
        hidden.length > 0
          ? Prisma.sql`AND p."userId" <> ALL(${hidden}::text[])`
          : Prisma.empty
      }
      AND earth_box(ll_to_earth(${origin.lat}::float8, ${origin.lng}::float8), ${radiusM}::float8)
          @> ll_to_earth(p.lat, p.lng)
      AND earth_distance(
            ll_to_earth(${origin.lat}::float8, ${origin.lng}::float8),
            ll_to_earth(p.lat, p.lng)
          ) <= ${radiusM}::float8
      ${
        cursor
          ? Prisma.sql`AND (p."createdAt", p.id) < (${cursor.createdAt}::timestamptz, ${cursor.id})`
          : Prisma.empty
      }
    ORDER BY p."createdAt" DESC, p.id DESC
    LIMIT ${take}::int
  `

  return rows.map((row) => row.id)
}

/** Réhydrate des identifiants en publications, dans l'ordre demandé. */
async function hydrate(
  ids: string[],
  viewerId: string | null,
  viewer: Viewer,
): Promise<CommunityPost[]> {
  if (ids.length === 0) return []

  const [rows, liked] = await Promise.all([
    prisma.post.findMany({ where: { id: { in: ids } }, include: POST_INCLUDE }),
    likedAmong(viewerId, ids),
  ])

  // `IN` ne garantit aucun ordre : on remet celui du fil.
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is PostRow => row !== undefined)
    .map((row) => toPost(row, viewer, viewerId, liked))
}

/**
 * Le fil « Autour de moi ».
 *
 * **L'élargissement automatique n'a lieu que sur la première page.** Le réseau
 * démarre vide, et un fil qui répond « personne autour de toi » au premier
 * lancement est un fil qu'on ne rouvre pas — alors que la même personne a des
 * voisins à 50 km. Le rayon retenu voyage ensuite dans le curseur : sans cela,
 * la page 2 repartirait du rayon d'origine et répéterait le vide.
 *
 * @throws ServiceError('FORBIDDEN') si le profil public n'est pas activé.
 */
export async function getNearbyFeed(
  userId: string,
  requestedRadiusKm: CommunityRadiusKm | null,
  rawCursor: string | null,
): Promise<CommunityFeed> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { communityEnabled: true, communityRadiusKm: true, fuzzyLat: true, fuzzyLng: true },
  })

  if (!me?.communityEnabled || me.fuzzyLat === null || me.fuzzyLng === null) {
    throw new ServiceError(
      'FORBIDDEN',
      'Active ton profil public pour voir ce qui se passe autour de toi.',
    )
  }

  const origin = { lat: me.fuzzyLat, lng: me.fuzzyLng }
  const cursor = decodeCursor(rawCursor)
  const requested = requestedRadiusKm ?? normalizeRadius(me.communityRadiusKm)
  const hidden = await hiddenUserIds(userId)

  // Une page entamée garde son rayon, quoi qu'il arrive.
  let applied = cursor?.radiusKm ?? requested
  let ids = await nearbyPostIds(origin, applied, hidden, cursor, FEED_PAGE_SIZE + 1)

  if (!cursor) {
    let wider = widerRadius(applied)
    while (ids.length < FEED_WIDEN_BELOW && wider !== null) {
      applied = wider
      ids = await nearbyPostIds(origin, applied, hidden, null, FEED_PAGE_SIZE + 1)
      wider = widerRadius(applied)
    }
  }

  const viewer = await findViewer(userId)
  const items = await hydrate(ids.slice(0, FEED_PAGE_SIZE), userId, viewer)
  const last = items[items.length - 1]

  return {
    items,
    nextCursor:
      ids.length > FEED_PAGE_SIZE && last
        ? encodeCursor({ createdAt: new Date(last.createdAt), id: last.id, radiusKm: applied })
        : null,
    requestedRadiusKm: requested,
    appliedRadiusKm: applied,
    widened: applied > requested,
  }
}

/**
 * Ce que l'Accueil montre de la communauté.
 *
 * Servi par une route séparée de `/api/v1/summary` — l'écran le plus consulté
 * de l'app ne doit pas attendre après la communauté — et muet tant que le
 * profil public n'est pas activé.
 */
export async function getHome(userId: string): Promise<CommunityHome> {
  try {
    const feed = await getNearbyFeed(userId, null, null)
    return { enabled: true, posts: feed.items.slice(0, 3) }
  } catch (err) {
    // Le seul refus possible ici est « profil non activé », qui n'est pas une
    // panne : l'accueil n'affiche simplement pas la carte.
    if (err instanceof ServiceError && err.code === 'FORBIDDEN') {
      return { enabled: false, posts: [] }
    }
    throw err
  }
}
