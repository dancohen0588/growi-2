/**
 * Lecture du journal d'audit.
 *
 * Lecture seule, exclusivement : l'écriture passe par `lib/admin/audit.ts`, et
 * rien nulle part ne modifie ni ne supprime une entrée.
 */

import type { Prisma } from '@prisma/client'

import { adminActionLabel, auditTargetLabel } from '@/lib/admin/audit'
import { serializeAuditRow, type AdminAuditRow } from '@/lib/admin/serializers'
import { prisma } from '@/lib/prisma'

export const AUDIT_PAGE_SIZE = 50

export type AuditFilters = {
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  from?: Date
  to?: Date
}

export type AuditCursor = { createdAt: Date; id: string }

export type AuditPage = {
  entries: AdminAuditRow[]
  nextCursor: AuditCursor | null
}

const ACTOR_SELECT = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
} as const

function buildAuditWhere(filters: AuditFilters): Prisma.AdminAuditLogWhereInput {
  const and: Prisma.AdminAuditLogWhereInput[] = []

  if (filters.actorId) and.push({ actorId: filters.actorId })
  if (filters.action) and.push({ action: filters.action })
  if (filters.targetType) and.push({ targetType: filters.targetType })
  if (filters.targetId) and.push({ targetId: filters.targetId })
  if (filters.from) and.push({ createdAt: { gte: filters.from } })
  if (filters.to) and.push({ createdAt: { lte: filters.to } })

  return and.length ? { AND: and } : {}
}

/** Une page du journal, de la plus récente à la plus ancienne. */
export async function listAuditEntries(
  filters: AuditFilters = {},
  cursor?: AuditCursor | null,
  pageSize = AUDIT_PAGE_SIZE,
): Promise<AuditPage> {
  const where = buildAuditWhere(filters)

  if (cursor) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ]
  }

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
    include: { actor: { select: ACTOR_SELECT } },
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page.at(-1)

  return {
    entries: page.map((row) =>
      serializeAuditRow(row, { action: adminActionLabel, target: auditTargetLabel }),
    ),
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

/** Les comptes ayant au moins une action au journal, pour le filtre « acteur ». */
export async function listAuditActors() {
  const rows = await prisma.adminAuditLog.findMany({
    distinct: ['actorId'],
    select: { actor: { select: ACTOR_SELECT } },
    orderBy: { actorId: 'asc' },
  })

  return rows
    .map((row) => row.actor)
    .filter((actor): actor is NonNullable<typeof actor> => actor !== null)
}
