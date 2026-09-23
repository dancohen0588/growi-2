'use server'

/**
 * Suppression du compte, côté web. Le mobile passe par `DELETE /api/v1/me` ;
 * les deux aboutissent à `user.service.deleteAccount`.
 *
 * Le web ne se connecte que par mot de passe : c'est donc lui qui fait la
 * preuve de présence, et aucune date de connexion n'est transmise.
 */

import { deleteAccountSchema } from '@growi/shared'

import { auth, signOut } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import { deleteAccount } from '@/lib/services/user.service'

export type DeleteAccountResult = { ok: false; error: string }

export async function deleteAccountAction(input: unknown): Promise<DeleteAccountResult> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { ok: false, error: 'Reconnecte-toi pour continuer.' }

  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' }
  }

  try {
    await deleteAccount(userId, parsed.data)
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[compte] suppression en échec', err)
    return { ok: false, error: 'La suppression n’a pas abouti. Réessaie dans un instant.' }
  }

  // Hors du `try` : `signOut` quitte par une redirection, que Next signale en
  // levant — l'attraper la ferait passer pour une erreur. Le cookie de
  // session porte encore l'identifiant du compte supprimé : on l'efface.
  await signOut({ redirectTo: '/?compte=supprime' })
  return { ok: false, error: 'Redirection impossible.' }
}
