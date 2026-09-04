/**
 * Vues admin des entités Prisma.
 *
 * **Aucun champ sensible ne franchit cette couche** : ni `password`, ni
 * `tokenHash`, ni les jetons des `Account` ou des `PushToken`. La règle est la
 * même que celle de `publicUserSchema` dans `@growi/shared`, appliquée ici à
 * une surface qui voit tout le reste.
 *
 * Le principe est **positif** : on construit l'objet champ par champ plutôt que
 * de recopier la ligne en retirant ce qui gêne. Une colonne ajoutée demain au
 * modèle `User` n'apparaîtra donc pas toute seule dans l'interface.
 *
 * Les dates restent des `Date` : ces vues alimentent des Server Components, pas
 * du JSON. La conversion en chaîne ISO appartient à `lib/api/serializers.ts`.
 */

import type { UserRole } from '@growi/shared'

export type AdminUserRow = {
  id: string
  email: string
  /** Nom d'affichage reconstitué, jamais vide. */
  displayName: string
  firstName: string | null
  lastName: string | null
  plan: string
  role: UserRole
  onboarded: boolean
  city: string | null
  createdAt: Date
  lastSeenAt: Date | null
  disabledAt: Date | null
  gardens: number
  plants: number
}

type UserRowInput = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  plan: string
  role: string
  onboarded: boolean
  locationCity: string | null
  createdAt: Date
  lastSeenAt: Date | null
  disabledAt: Date | null
  _count: { gardens: number; plantInstances: number }
}

/**
 * Nom lisible d'un compte.
 *
 * Beaucoup de comptes n'ont qu'un `name` (inscription par mot de passe) ou
 * rien du tout (Apple avec adresse masquée). Renvoyer une chaîne vide ferait
 * des lignes de tableau sans repère : on retombe sur l'email.
 */
export function displayNameOf(user: {
  firstName: string | null
  lastName: string | null
  name: string | null
  email: string
}): string {
  const composed = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  return composed || user.name?.trim() || user.email
}

export function serializeAdminUserRow(user: UserRowInput): AdminUserRow {
  return {
    id: user.id,
    email: user.email,
    displayName: displayNameOf(user),
    firstName: user.firstName,
    lastName: user.lastName,
    plan: user.plan,
    role: user.role as UserRole,
    onboarded: user.onboarded,
    city: user.locationCity,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    disabledAt: user.disabledAt,
    gardens: user._count.gardens,
    plants: user._count.plantInstances,
  }
}

// ─── Journal d'audit ───────────────────────────────────────────────────────

export type AdminAuditRow = {
  id: string
  action: string
  actionLabel: string
  targetType: string
  targetLabel: string
  targetId: string
  details: unknown
  createdAt: Date
  actor: { id: string; email: string; displayName: string } | null
}

type AuditRowInput = {
  id: string
  action: string
  targetType: string
  targetId: string
  details: unknown
  createdAt: Date
  actor: {
    id: string
    email: string
    name: string | null
    firstName: string | null
    lastName: string | null
  } | null
}

export function serializeAuditRow(
  row: AuditRowInput,
  labels: { action: (a: string) => string; target: (t: string) => string },
): AdminAuditRow {
  return {
    id: row.id,
    action: row.action,
    actionLabel: labels.action(row.action),
    targetType: row.targetType,
    targetLabel: labels.target(row.targetType),
    targetId: row.targetId,
    details: row.details,
    createdAt: row.createdAt,
    actor: row.actor
      ? {
          id: row.actor.id,
          email: row.actor.email,
          displayName: displayNameOf(row.actor),
        }
      : null,
  }
}
