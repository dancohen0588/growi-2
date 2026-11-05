/**
 * Présentation des « Secrets de jardinier » côté web — fonctions pures, sans
 * Prisma ni React, partagées par le calendrier et le grimoire.
 *
 * Le moteur livre un secret comme une action `autre` du planning : une version
 * de l'écran qui l'ignore la montre comme un geste ordinaire. Le calendrier,
 * lui, la **sort** des listes pour lui donner sa propre carte — d'où
 * `splitSecretActions`, qui doit passer avant tout regroupement : un secret
 * resté dans la liste serait coché par « Tout marquer fait » sans `tipSlug`,
 * et son essai ne serait jamais suivi de « c'est prêt » ni de « Ça a marché ? ».
 */

import type { SecretStage } from '@growi/shared'

import type { GardenAction } from '@/lib/recommendation/types'

/** Une action qui porte un secret — le type le garantit après le filtre. */
export type SecretAction = GardenAction & { secret: NonNullable<GardenAction['secret']> }

export function isSecretAction(action: GardenAction): action is SecretAction {
  return action.secret != null
}

/**
 * Ordre des cartes en tête du planning : ce qui demande un geste d'abord
 * (la préparation prête), puis la question, puis la découverte de la semaine.
 */
const STAGE_ORDER: Record<SecretStage, number> = { ready: 0, feedback: 1, discover: 2 }

/**
 * Sépare les actions « secret » des actions ordinaires.
 *
 * L'ordre des actions ordinaires est conservé tel quel : le service les a
 * déjà placées (tâches en tête), et les écrans regroupent sans retrier.
 * Les secrets sont dédoublonnés par identifiant — une plante sans jardin est
 * rattachée à chacun d'eux par le moteur.
 */
export function splitSecretActions(actions: GardenAction[]): {
  secrets: SecretAction[]
  ordinary: GardenAction[]
} {
  const secrets: SecretAction[] = []
  const ordinary: GardenAction[] = []
  const seen = new Set<string>()

  for (const action of actions) {
    if (!isSecretAction(action)) {
      ordinary.push(action)
      continue
    }
    if (seen.has(action.id)) continue
    seen.add(action.id)
    secrets.push(action)
  }

  // `sort` est stable : à étape égale, l'ordre du service tient.
  secrets.sort((a, b) => STAGE_ORDER[a.secret.stage] - STAGE_ORDER[b.secret.stage])
  return { secrets, ordinary }
}

/**
 * La recette en étapes. L'admin écrit une étape par ligne ; certaines arrivent
 * déjà numérotées (« 1. ») ou à puces (« - ») — l'écran numérote lui-même,
 * on retire donc ces marques pour ne pas lire « 1. 1. Écrase… ».
 */
export function recipeSteps(recipe: string | null | undefined): string[] {
  if (!recipe) return []
  return recipe
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:\d+\s*[.)]|[-•*])\s+/, '').trim())
    .filter((line) => line.length > 0)
}

/** « Prêt dans 15 jours » — ou rien, quand la recette s'utilise tout de suite. */
export function prepLabel(prepDays: number): string | null {
  if (prepDays <= 0) return null
  return prepDays === 1 ? 'Prêt dans 1 jour' : `Prêt dans ${prepDays} jours`
}

/** « 10 min », « 1 h 30 ». */
export function effortLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

/** Le message qui suit « Je tente » : il annonce la suite, sans rien promettre de plus. */
export function triedMessage(prepDays: number): string {
  if (prepDays > 0) {
    const days = prepDays === 1 ? 'demain' : `dans ${prepDays} jours`
    return `C'est noté ! On te préviendra ici quand ta préparation sera prête, ${days}.`
  }
  return "C'est noté ! Dans une semaine, on te demandera si ça a marché."
}

/** « 3 nov. 2026 » — la date d'un essai, dans le grimoire. */
export function formatTrialDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
