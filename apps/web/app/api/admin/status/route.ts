/**
 * « Le compte connecté est-il administrateur ? »
 *
 * Le header est un composant client : il ne dispose que de la session
 * NextAuth, dont le rôle est **figé à la connexion**. Un compte promu depuis
 * ne verrait donc pas le lien, et un compte rétrogradé continuerait à le voir.
 * Cette route relit l'état réel, comme `requireAdmin()` — c'est la seule source
 * qui fasse autorité.
 *
 * Faire lire la base par le layout marketing serait l'autre solution, mais
 * rendrait dynamiques la page d'accueil et le blog, aujourd'hui prérendus.
 *
 * Elle ne dit rien de plus que ce que l'appelant sait déjà de lui-même : à un
 * anonyme comme à un compte ordinaire, elle répond `false`.
 */

import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { isAdminRole } from '@/lib/admin/role'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return NextResponse.json({ isAdmin: false })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabledAt: true },
  })

  const isAdmin = Boolean(user && isAdminRole(user.role) && !user.disabledAt)

  return NextResponse.json(
    { isAdmin },
    // Réponse propre à un compte : jamais mise en cache par un intermédiaire.
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
