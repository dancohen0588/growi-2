'use server'

/**
 * Server Actions de la sève, côté web.
 *
 * Le mobile passe par `/api/v1/sap/*` ; le web appelle le même service. Comme
 * ailleurs, **l'authentification est refaite ici** : une Server Action est un
 * point d'entrée à part entière. Rien ne lève vers le client — un refus du
 * service (quota, profil manquant) revient en `{ ok: false, error }`, dont le
 * message est rédigé pour être lu.
 */

import { revalidatePath } from 'next/cache'
import { giveSapDropSchema, setSapHomeThemeSchema, type SapEntryPage, type SapHomeTheme } from '@growi/shared'

import { auth } from '@/auth'
import { serializeSapEntry } from '@/lib/api/serializers'
import { isServiceError, ServiceError } from '@/lib/services/errors'
import { setHomeTheme } from '@/lib/services/sap-rewards.service'
import * as sapService from '@/lib/services/sap.service'

export type SapActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }

async function requireUser(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new ServiceError('UNAUTHENTICATED', 'Reconnecte-toi pour continuer.')
  return userId
}

async function run<T>(fn: (userId: string) => Promise<T>): Promise<SapActionResult<T>> {
  try {
    return { ok: true, data: await fn(await requireUser()) }
  } catch (err) {
    if (isServiceError(err)) {
      // Même règle que le mobile : un profil injoignable ne dit pas pourquoi.
      const error = err.code === 'NOT_FOUND' ? 'Ce jardinier n’est plus joignable.' : err.message
      return { ok: false, error, code: err.code }
    }
    console.error('[sève] action web en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

/** Les gouttes qu'il reste à offrir — lues à l'ouverture de la boîte « Offrir ». */
export async function getGiftQuotaAction(): Promise<
  SapActionResult<{ giftsLeft: number; giftsPerWeek: number }>
> {
  return run(async (userId) => {
    const { giftsLeft, giftsPerWeek } = await sapService.getSapSummary(userId)
    return { giftsLeft, giftsPerWeek }
  })
}

/** Offrir une goutte à un voisin, désigné par son pseudo. */
export async function giveSapDropAction(input: unknown): Promise<SapActionResult<{ giftsLeft: number }>> {
  return run(async (userId) => {
    const parsed = giveSapDropSchema.safeParse(input)
    if (!parsed.success) {
      throw new ServiceError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Goutte invalide')
    }
    const result = await sapService.giveSapDrop(userId, parsed.data)
    // Les gouttes restantes de la carte d'accueil et de « Ta sève ».
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/seve')
    return result
  })
}

/** La page suivante de l'historique, pour « Voir les gouttes plus anciennes ». */
export async function loadSapHistoryAction(cursor: string | null): Promise<SapActionResult<SapEntryPage>> {
  return run(async (userId) => {
    const page = await sapService.listSapHistory(userId, cursor)
    return { items: page.items.map(serializeSapEntry), nextCursor: page.nextCursor }
  })
}

/** Choisir le thème d'Accueil débloqué par un cerne — `null` revient au classique. */
export async function setHomeThemeAction(input: unknown): Promise<SapActionResult<{ homeTheme: SapHomeTheme | null }>> {
  return run(async (userId) => {
    const parsed = setSapHomeThemeSchema.safeParse(input)
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Thème inconnu')
    const homeTheme = await setHomeTheme(userId, parsed.data.theme)
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/seve')
    return { homeTheme }
  })
}
