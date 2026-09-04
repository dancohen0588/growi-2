/**
 * Lecture des comptes pour le portail d'administration.
 *
 * Ce service **ne lit jamais la session** : comme tous les autres, il reçoit
 * ce dont il a besoin en paramètre. C'est la Server Action qui appelle
 * `requireAdmin()` avant de venir ici.
 *
 * Il ne renvoie que des vues déjà nettoyées (`lib/admin/serializers.ts`) :
 * ni mot de passe, ni empreinte de jeton ne remontent jusqu'à un composant.
 */

import type { Prisma } from '@prisma/client'

import { serializeAdminUserRow, type AdminUserRow } from '@/lib/admin/serializers'
import { prisma } from '@/lib/prisma'

/** 50 lignes par page — au-delà, la table devient illisible avant d'être utile. */
export const USERS_PAGE_SIZE = 50

/** Plafond de l'export CSV, qui n'est pas paginé. */
export const USERS_EXPORT_LIMIT = 5_000

export type UserListFilters = {
  /** Recherche insensible à la casse sur le nom, le prénom ou l'email. */
  search?: string
  role?: 'USER' | 'ADMIN'
  plan?: string
  onboarded?: boolean
  disabled?: boolean
  /** Inscrits à partir de cette date. */
  createdAfter?: Date
  /** Vus au moins une fois depuis cette date. */
  activeSince?: Date
  /** Jamais vus depuis cette date — inclut ceux qu'on n'a jamais vus du tout. */
  inactiveSince?: Date
}

/**
 * Curseur de pagination : `(createdAt, id)`.
 *
 * `createdAt` seul ne suffit pas — deux comptes créés dans la même
 * milliseconde en feraient sauter un. L'`id` départage.
 */
export type UserCursor = { createdAt: Date; id: string }

export type UserListPage = {
  users: AdminUserRow[]
  nextCursor: UserCursor | null
}

/** Traduit les filtres en clause Prisma. Partagé par la liste et l'export. */
export function buildUserWhere(filters: UserListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}
  const and: Prisma.UserWhereInput[] = []

  const search = filters.search?.trim()
  if (search) {
    and.push({
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.role) and.push({ role: filters.role })
  if (filters.plan) and.push({ plan: filters.plan })
  if (filters.onboarded !== undefined) and.push({ onboarded: filters.onboarded })

  // `disabled: false` doit dire « actif », donc `disabledAt IS NULL` — pas
  // « une date différente », qui écarterait justement les comptes actifs.
  if (filters.disabled !== undefined) {
    and.push(filters.disabled ? { disabledAt: { not: null } } : { disabledAt: null })
  }

  if (filters.createdAfter) and.push({ createdAt: { gte: filters.createdAfter } })
  if (filters.activeSince) and.push({ lastSeenAt: { gte: filters.activeSince } })

  // « Sans activité depuis » englobe les comptes jamais vus : ce sont les
  // premiers concernés, les exclure viderait le filtre de son intérêt.
  if (filters.inactiveSince) {
    and.push({ OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: filters.inactiveSince } }] })
  }

  if (and.length) where.AND = and
  return where
}

const LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  plan: true,
  role: true,
  onboarded: true,
  locationCity: true,
  createdAt: true,
  lastSeenAt: true,
  disabledAt: true,
  _count: { select: { gardens: true, plantInstances: true } },
} satisfies Prisma.UserSelect

/**
 * Ordre stable et déterministe, du plus récent au plus ancien.
 * Il doit être identique à celui du curseur, sans quoi la pagination saute des
 * lignes ou en répète.
 */
const LIST_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.UserOrderByWithRelationInput[]

/**
 * Une page de comptes, filtrée et triée.
 *
 * On demande une ligne de plus que la page : sa présence dit qu'il y a une
 * suite, sans le `COUNT(*)` complet qu'il faudrait sinon à chaque page.
 */
export async function listUsers(
  filters: UserListFilters = {},
  cursor?: UserCursor | null,
  pageSize = USERS_PAGE_SIZE,
): Promise<UserListPage> {
  const where = buildUserWhere(filters)

  if (cursor) {
    // « Strictement plus ancien », au sens de l'ordre ci-dessus : soit une date
    // antérieure, soit la même date et un id plus petit.
    const after: Prisma.UserWhereInput = {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    }
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), after]
  }

  const rows = await prisma.user.findMany({
    where,
    select: LIST_SELECT,
    orderBy: LIST_ORDER,
    take: pageSize + 1,
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page.at(-1)

  return {
    users: page.map(serializeAdminUserRow),
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

/**
 * Tous les comptes correspondant aux filtres, pour l'export CSV.
 *
 * Plafonné : un export non borné finirait par épuiser la mémoire de la
 * fonction, et personne n'ouvre un CSV de cent mille lignes.
 */
export async function listUsersForExport(
  filters: UserListFilters = {},
  limit = USERS_EXPORT_LIMIT,
): Promise<AdminUserRow[]> {
  const rows = await prisma.user.findMany({
    where: buildUserWhere(filters),
    select: LIST_SELECT,
    orderBy: LIST_ORDER,
    take: limit,
  })
  return rows.map(serializeAdminUserRow)
}

/** Nombre de comptes correspondant aux filtres. */
export function countUsers(filters: UserListFilters = {}): Promise<number> {
  return prisma.user.count({ where: buildUserWhere(filters) })
}

/** Les plans effectivement présents en base, pour alimenter le filtre. */
export async function listUserPlans(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    distinct: ['plan'],
    select: { plan: true },
    orderBy: { plan: 'asc' },
  })
  return rows.map((row) => row.plan)
}
