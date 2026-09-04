'use server'

/**
 * Server Actions du portail d'administration, volet « comptes ».
 *
 * Elles sont volontairement **minces** : authentifier, valider, déléguer,
 * rafraîchir. Toute la logique — invariants, journal, transactions — vit dans
 * `lib/services/admin-account.service.ts`.
 *
 * Chacune appelle `requireAdmin()` elle-même. Le contrôle du layout ne vaut pas
 * pour elles : une Server Action est un point d'entrée HTTP à part entière,
 * atteignable sans jamais rendre la page qui la contient.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { updateProfileSchema } from '@growi/shared'

import { requireAdmin } from '@/lib/admin/auth'
import {
  adminUpdateUserProfile,
  disableUser,
  enableUser,
  resetUserAdvice,
  revokeMobileSessions,
  type ResetLevel,
} from '@/lib/services/admin-account.service'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Traduit une exception en résultat affichable.
 *
 * Une `ServiceError` porte un message écrit pour être lu ; tout le reste est
 * un incident, dont on ne recopie pas le détail à l'écran.
 */
async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

/** Rafraîchit la fiche **et** la liste, dont les agrégats viennent de changer. */
function revalidateUser(userId: string) {
  revalidatePath(`/admin/utilisateurs/${userId}`)
  revalidatePath('/admin/utilisateurs')
  revalidatePath('/admin/journal')
}

// ─── Profil ────────────────────────────────────────────────────────────────

/**
 * Champs modifiables depuis l'admin.
 *
 * On part de `updateProfileSchema`, la liste blanche que l'utilisateur s'applique
 * à lui-même, et on ajoute ce que seul un administrateur touche. Repartir d'un
 * schéma libre laisserait passer `role` ou `password` au premier oubli.
 */
const adminUpdateSchema = updateProfileSchema.extend({
  name: z.string().trim().min(1).max(120).nullish(),
  plan: z.string().trim().min(1).max(40).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  onboarded: z.boolean().optional(),
})

/** `''` d'un champ vide de formulaire = « pas de valeur », pas la chaîne vide. */
function optionalText(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined
  const text = String(value).trim()
  return text === '' ? null : text
}

function requiredText(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined
  const text = String(value).trim()
  return text === '' ? undefined : text
}

function optionalNumber(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined
  const text = String(value).trim()
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function updateUserProfileAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const parsed = adminUpdateSchema.safeParse({
      firstName: requiredText(formData.get('firstName')),
      lastName: requiredText(formData.get('lastName')),
      name: optionalText(formData.get('name')),
      email: requiredText(formData.get('email')),
      address: optionalText(formData.get('address')),
      city: optionalText(formData.get('city')),
      gardenType: optionalText(formData.get('gardenType')),
      latitude: optionalNumber(formData.get('latitude')),
      longitude: optionalNumber(formData.get('longitude')),
      plan: requiredText(formData.get('plan')),
      timezone: requiredText(formData.get('timezone')),
      onboarded: formData.get('onboarded') === 'on',
    })

    if (!parsed.success) {
      const first = parsed.error.issues[0]
      // Une vraie `ServiceError` : `isServiceError` teste `instanceof`, un
      // objet qui lui ressemble finirait en « une erreur est survenue ».
      throw new ServiceError('INVALID_INPUT', `${first.path.join('.')} : ${first.message}`)
    }

    await adminUpdateUserProfile(admin.id, userId, parsed.data)
    revalidateUser(userId)
    return 'Profil enregistré.'
  })
}

// ─── Réinitialisations ─────────────────────────────────────────────────────

export async function resetAdviceAction(
  userId: string,
  level: ResetLevel,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const outcome = await resetUserAdvice(admin.id, userId, level)
    revalidateUser(userId)

    if (level === 1) {
      return `Conseils recalculés sur ${outcome.gardensInvalidated} jardin(s).`
    }
    if (level === 2) {
      return `${outcome.tasksDeleted} tâche(s) ouverte(s) supprimée(s).`
    }
    return `Suivi d’entretien remis à zéro sur ${outcome.plantsReset} plante(s).`
  })
}

// ─── Compte ────────────────────────────────────────────────────────────────

export async function disableUserAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const outcome = await disableUser(admin.id, userId)
    revalidateUser(userId)
    return `Compte désactivé. ${outcome.sessionsRevoked} session(s) coupée(s), ${outcome.pushTokensRemoved} appareil(s) débranché(s).`
  })
}

export async function enableUserAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    await enableUser(admin.id, userId)
    revalidateUser(userId)
    return 'Compte réactivé. L’utilisateur devra se reconnecter.'
  })
}

export async function revokeMobileSessionsAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const count = await revokeMobileSessions(admin.id, userId)
    revalidateUser(userId)
    return count === 0
      ? 'Aucune session mobile active.'
      : `${count} session(s) mobile(s) révoquée(s).`
  })
}
