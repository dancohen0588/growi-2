/**
 * Contrôle d'accès du portail d'administration.
 *
 * Le rôle voyage dans le JWT NextAuth, mais **le JWT ne fait pas autorité pour
 * une écriture** : un compte rétrogradé garderait sinon ses droits jusqu'à sa
 * prochaine connexion. `requireAdmin()` relit donc le rôle en base à chaque
 * appel — une requête sur un index, le coût est négligeable devant ce qu'elle
 * protège. Le JWT ne sert qu'au middleware, pour rediriger sans requête SQL.
 *
 * À appeler dans `app/admin/layout.tsx` **et dans chaque Server Action admin** :
 * un layout ne protège pas une action, qui est un point d'entrée à part entière.
 */

import { auth } from '@/auth'
import { isAdminRole } from '@/lib/admin/role'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

export { isAdminRole, isUserRole } from '@/lib/admin/role'

/** L'administrateur authentifié, tel que le portail a besoin de le connaître. */
export type AdminIdentity = {
  id: string
  email: string
  name: string | null
}

/**
 * Vérifie que la requête courante émane d'un administrateur actif.
 *
 * @throws ServiceError('UNAUTHENTICATED') si personne n'est connecté.
 * @throws ServiceError('FORBIDDEN') si le compte n'est pas `ADMIN` ou s'il a
 * été désactivé entre-temps.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    throw new ServiceError('UNAUTHENTICATED', 'Authentification requise')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, disabledAt: true },
  })

  if (!user || !isAdminRole(user.role) || user.disabledAt) {
    throw new ServiceError('FORBIDDEN', 'Accès réservé aux administrateurs')
  }

  return { id: user.id, email: user.email, name: user.name }
}
