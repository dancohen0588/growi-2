'use server'

/**
 * Server Actions du portail, volet « administrateurs ».
 *
 * Même discipline que les deux autres fichiers : `requireAdmin()` à chaque
 * entrée, validation, délégation. Les garde-fous — dernier administrateur,
 * auto-rétrogradation, compte désactivé — vivent dans `lib/admin/roles.ts` et
 * pas ici : une règle qui protège l'accès au portail ne doit pas dépendre de
 * l'écran qui l'appelle.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/admin/auth'
import { demoteAdmin, findAccountByEmail, promoteAdmin } from '@/lib/admin/roles'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action administrateurs en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

function revalidateAdmins(userId?: string) {
  revalidatePath('/admin/administrateurs')
  revalidatePath('/admin/utilisateurs')
  revalidatePath('/admin/journal')
  if (userId) revalidatePath(`/admin/utilisateurs/${userId}`)
}

const emailSchema = z.string().trim().email('Adresse email invalide')

export async function promoteAdminAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const parsed = emailSchema.safeParse(formData.get('email'))
    if (!parsed.success) {
      throw new ServiceError('INVALID_INPUT', parsed.error.issues[0].message)
    }

    // On promeut un compte **existant**, jamais une adresse : créer un compte
    // au passage donnerait des droits à quelqu'un qui n'a jamais rien demandé.
    const account = await findAccountByEmail(parsed.data)
    if (!account) {
      throw new ServiceError(
        'NOT_FOUND',
        'Aucun compte Growi avec cette adresse. La personne doit d’abord s’inscrire.',
      )
    }

    if (account.role === 'ADMIN') {
      throw new ServiceError('CONFLICT', 'Ce compte est déjà administrateur.')
    }

    await promoteAdmin(admin.id, account.id)
    revalidateAdmins(account.id)
    return `${account.email} est désormais administrateur.`
  })
}

export async function demoteAdminAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const account = await demoteAdmin(admin.id, userId)
    revalidateAdmins(userId)
    return `${account.email} n’est plus administrateur.`
  })
}
