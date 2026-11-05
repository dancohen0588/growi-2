'use server'

/**
 * Server Actions du portail d'administration, volet « Secrets de jardinier ».
 *
 * Même discipline que `blog.ts` : `requireAdmin()` à chaque entrée — le layout
 * ne protège pas une action —, lecture du formulaire, délégation au service
 * (qui valide et journalise), revalidation. Aucune écriture Prisma ici.
 *
 * L'identifiant du secret est lié côté serveur (`action.bind(null, tip.id)`) ;
 * celui de l'auteur vient de `requireAdmin()`, jamais du client.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin/auth'
import { readGardenTipForm } from '@/lib/admin/secret-form'
import { isServiceError } from '@/lib/services/errors'
import {
  createGardenTip,
  deleteGardenTip,
  publishGardenTip,
  unpublishGardenTip,
  updateGardenTip,
} from '@/lib/services/secrets-admin.service'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action secrets en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

/**
 * L'admin seulement : le planning et le grimoire sont rendus à la demande, et
 * relisent la bibliothèque par `listPublishedTips` (cache d'une minute, vidé
 * par le service).
 */
function revalidateAdmin(id?: string) {
  revalidatePath('/admin/secrets')
  if (id) revalidatePath(`/admin/secrets/${id}`)
  revalidatePath('/admin/journal')
}

export async function createGardenTipAction(formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null

  const result = await run(async () => {
    const admin = await requireAdmin()
    const tip = await createGardenTip(admin.id, readGardenTipForm(formData))
    revalidateAdmin(tip.id)
    createdId = tip.id
    return 'Brouillon créé.'
  })

  // Hors de `run` : `redirect` lève une exception de contrôle que `run`
  // prendrait pour une erreur.
  if (createdId) redirect(`/admin/secrets/${createdId}`)
  return result
}

export async function updateGardenTipAction(id: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    // Le formulaire d'édition n'a pas de champ `slug`, et le service l'ignorerait.
    const tip = await updateGardenTip(admin.id, id, readGardenTipForm(formData))
    revalidateAdmin(id)
    return tip.status === 'PUBLISHED'
      ? 'Enregistré. Le planning en tiendra compte d’ici une minute.'
      : 'Enregistré.'
  })
}

export async function publishGardenTipAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    await publishGardenTip(admin.id, id)
    revalidateAdmin(id)
    return 'Secret publié : il peut être tiré dès la semaine en cours.'
  })
}

export async function unpublishGardenTipAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    await unpublishGardenTip(admin.id, id)
    revalidateAdmin(id)
    return 'Secret dépublié : il ne sera plus tiré. Les essais en cours suivent leur cours.'
  })
}

export async function deleteGardenTipAction(id: string): Promise<ActionResult> {
  let deleted = false

  const result = await run(async () => {
    const admin = await requireAdmin()
    await deleteGardenTip(admin.id, id)
    revalidateAdmin()
    deleted = true
    return 'Secret supprimé.'
  })

  if (deleted) redirect('/admin/secrets?statut=brouillons')
  return result
}
