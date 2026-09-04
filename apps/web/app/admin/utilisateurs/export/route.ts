/**
 * Export CSV de la liste des utilisateurs, telle qu'elle est filtrée.
 *
 * ⚠️ Écart assumé avec la spec, qui prévoyait « une Server Action renvoyant un
 * `Response` » : une Server Action renvoie une valeur sérialisable au client,
 * pas une réponse HTTP. Un téléchargement demande un `Content-Disposition`,
 * donc un Route Handler — et un `GET`, pour qu'un simple lien suffise.
 *
 * Il vit sous `/admin`, donc derrière le même middleware, et refait le contrôle
 * avec `requireAdmin()` : une route est un point d'entrée à part entière.
 */

import { NextResponse } from 'next/server'

import { logAdminAction } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/auth'
import { csvFilename, toCsv } from '@/lib/admin/csv'
import { readUserFilters, type SearchParams } from '@/lib/admin/search-params'
import { USER_ROLE_LABELS } from '@growi/shared'
import { listUsersForExport, USERS_EXPORT_LIMIT } from '@/lib/services/admin-user.service'
import { isServiceError } from '@/lib/services/errors'

export const dynamic = 'force-dynamic'

const HEADERS = [
  'Email',
  'Nom',
  'Prénom',
  'Nom de famille',
  'Ville',
  'Plan',
  'Rôle',
  'Onboardé',
  'État',
  'Inscription',
  'Dernière activité',
  'Jardins',
  'Plantes',
]

const iso = (date: Date | null) => (date ? date.toISOString() : '')

export async function GET(request: Request) {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    if (isServiceError(err)) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status })
    }
    throw err
  }

  const url = new URL(request.url)
  const params: SearchParams = Object.fromEntries(url.searchParams.entries())
  const filters = readUserFilters(params)

  const users = await listUsersForExport(filters)

  const csv = toCsv(
    HEADERS,
    users.map((user) => [
      user.email,
      user.displayName,
      user.firstName ?? '',
      user.lastName ?? '',
      user.city ?? '',
      user.plan,
      USER_ROLE_LABELS[user.role] ?? user.role,
      user.onboarded ? 'oui' : 'non',
      user.disabledAt ? 'désactivé' : 'actif',
      iso(user.createdAt),
      iso(user.lastSeenAt),
      user.gardens,
      user.plants,
    ]),
  )

  // Un export sort des données personnelles du produit : il se journalise comme
  // n'importe quelle autre action. On y consigne les filtres et le volume, pas
  // les lignes.
  await logAdminAction({
    actorId: admin.id,
    action: 'user.export',
    targetType: 'user',
    // Pas de cible unique : l'export porte sur une sélection.
    targetId: 'liste',
    details: {
      count: users.length,
      tronque: users.length >= USERS_EXPORT_LIMIT,
      filtres: Object.fromEntries(url.searchParams.entries()),
    },
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('growi-utilisateurs')}"`,
      // Ces lignes sont des données personnelles : rien ne doit les garder.
      'Cache-Control': 'no-store, private',
    },
  })
}
