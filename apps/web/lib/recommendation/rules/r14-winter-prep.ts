import type { ActionWindow } from '@growi/shared'

import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { doneSince, isExposed, minTempWithin } from '../utils'
import { WINTER_HOW_TO, winterProtectionOf, type WinterProtection } from '../winter-protection'

/**
 * Préparer l'hivernage **avant** le gel : rentrer les gélives, garder un voile
 * prêt, pailler le pied. L'alerte gel (r10) arrive à 48 h ; c'est souvent
 * trop tard pour trouver de la place dans la maison.
 *
 * Une fois par hiver : fait en octobre, la carte ne revient pas en décembre.
 */
const PREP_MONTHS = [10, 11, 12]

/** Sous ce minimum annoncé dans la semaine, la carte remonte en priorité. */
const COLD_SOON_C = 3

const WORDING: Record<WinterProtection, { shortLabel: string; label: (name: string) => string; why: string }> = {
  INDOOR: {
    shortLabel: 'Rentrer',
    label: (name) => `Rentre ${name} avant les gelées`,
    why: "Cette plante ne passe pas l'hiver dehors : mieux vaut la rentrer avant la première gelée que dans l'urgence.",
  },
  FLEECE: {
    shortLabel: 'Préparer un voile',
    label: (name) => `Prépare un voile d'hivernage pour ${name}`,
    why: "Elle supporte l'hiver sous un voile, les nuits de gel. Autant l'avoir sous la main avant d'en avoir besoin.",
  },
  MULCH: {
    shortLabel: "Pailler pour l'hiver",
    label: (name) => `Paille le pied de ${name} pour l'hiver`,
    why: "Ses racines craignent le gel : un bon paillage au pied suffit à les protéger tout l'hiver.",
  },
}

export const r14WinterPrep: AdviceRule = {
  id: 'r14-winter-prep',
  name: 'Hivernage',
  gestureLabel: 'Hivernage',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const protection = winterProtectionOf(catalog.winterProtectionType)
    if (!protection) return []
    // Déjà à l'abri : rien à préparer.
    if (!isExposed(instance.location)) return []

    const month = currentDate.getMonth() + 1
    if (!PREP_MONTHS.includes(month)) return []

    const year = currentDate.getFullYear()
    // La fenêtre est celle de toute la préparation, d'octobre à décembre : un
    // geste d'octobre vaut pour l'hiver, pas pour le seul mois.
    const window: ActionWindow = { start: `${year}-10-01`, end: `${year}-12-31` }
    if (doneSince(ctx, this.id, window.start)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const wording = WORDING[protection]

    const minSoon = minTempWithin(weather, 7)
    const coldSoon = minSoon != null && minSoon < COLD_SOON_C
    const coldNote = coldSoon ? ` Jusqu'à ${Math.round(minSoon)} °C annoncés cette semaine.` : ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'autre',
        label: wording.label(plantName),
        shortLabel: wording.shortLabel,
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        // Le froid qui approche en fait une affaire de la semaine.
        priority: coldSoon ? 'medium' : 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: `${wording.why}${coldNote}`,
        howTo: catalog.careTipWinter ?? WINTER_HOW_TO[protection],
      },
    ]
  },
}
