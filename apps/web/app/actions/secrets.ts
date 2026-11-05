'use server'

/**
 * Server Actions des « Secrets de jardinier » et du calendrier lunaire, côté web.
 *
 * Le mobile passera par l'API v1 ; le web appelle les services directement,
 * comme le reste du tableau de bord. **L'authentification est refaite ici** :
 * une Server Action est un point d'entrée à part entière.
 *
 * « Je tente » et « C'est fait » d'une préparation prête ne passent pas par
 * ce module : ce sont des gestes du planning, écrits au journal par
 * `markActionDoneAction` (`ruleId` `r20-secret` / `r20-secret-ready`, `tipSlug`).
 */

import { revalidatePath } from 'next/cache'
import { secretFeedbackSchema, secretSlugSchema, type SecretFeedbackInput } from '@growi/shared'

import { auth } from '@/auth'
import { isServiceError, ServiceError } from '@/lib/services/errors'
import * as secretsService from '@/lib/services/secrets.service'
import * as userService from '@/lib/services/user.service'

export type SecretActionResult = { ok: true } | { ok: false; error: string }

/** @throws ServiceError('UNAUTHENTICATED') — jamais un `redirect`, qui casserait le retour. */
async function requireUser(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new ServiceError('UNAUTHENTICATED', 'Reconnecte-toi pour continuer.')
  return userId
}

async function run(label: string, fn: (userId: string) => Promise<void>): Promise<SecretActionResult> {
  try {
    await fn(await requireUser())
    return { ok: true }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error(`[secrets] ${label} en échec`, err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

/** Un slug hors format est une saisie invalide, pas une panne. */
function parseSlug(slug: string): string {
  const parsed = secretSlugSchema.safeParse(slug)
  if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Secret introuvable')
  return parsed.data
}

/**
 * Le secret a été dévoilé — ouvrir sa popin suffit. Il entre au grimoire.
 *
 * Seul le grimoire est revalidé : revalider le calendrier, d'où l'appel part,
 * en referait le rendu serveur pour une carte qui ne change pas.
 */
export async function revealSecretAction(slug: string): Promise<SecretActionResult> {
  return run('reveal', async (userId) => {
    await secretsService.revealSecret(userId, parseSlug(slug))
    revalidatePath('/dashboard/grimoire')
  })
}

/** « Pas pour moi » : le secret ne sera plus proposé. */
export async function dismissSecretAction(slug: string): Promise<SecretActionResult> {
  return run('dismiss', async (userId) => {
    await secretsService.dismissSecret(userId, parseSlug(slug))
    revalidateSecrets()
  })
}

/** « Me le reproposer », depuis le grimoire. */
export async function restoreSecretAction(slug: string): Promise<SecretActionResult> {
  return run('restore', async (userId) => {
    await secretsService.restoreSecret(userId, parseSlug(slug))
    revalidateSecrets()
  })
}

/** « Ça a marché ? » — le verdict se pose sur le geste d'essai. */
export async function secretFeedbackAction(input: SecretFeedbackInput): Promise<SecretActionResult> {
  return run('feedback', async (userId) => {
    const parsed = secretFeedbackSchema.safeParse(input)
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Réponse invalide')
    await secretsService.recordSecretFeedback(userId, parsed.data)
    revalidateSecrets()
  })
}

/**
 * Active ou coupe le calendrier lunaire. Passe par `updateProfile`, qui émet
 * `lunar_calendar_toggled` : le réglage du compte est le même que celui de
 * l'onglet « Mes alertes » et de l'app.
 */
export async function setLunarCalendarAction(enabled: boolean): Promise<SecretActionResult> {
  return run('lunar', async (userId) => {
    if (typeof enabled !== 'boolean') throw new ServiceError('INVALID_INPUT', 'Réglage invalide')
    await userService.updateProfile(userId, { lunarCalendar: enabled })
    revalidateSecrets()
  })
}

/**
 * Le calendrier montre les cartes et le bandeau lunaire ; le grimoire, l'état
 * de chaque secret — et le secret lunaire n'y figure qu'avec l'option.
 */
function revalidateSecrets(): void {
  revalidatePath('/dashboard/calendrier')
  revalidatePath('/dashboard/grimoire')
}
