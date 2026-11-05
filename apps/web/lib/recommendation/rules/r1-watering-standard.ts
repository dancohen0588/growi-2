import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { WINTER_REST_MONTHS, isExposed, isFinishedAnnual, isoDay, parseJsonArray } from '../utils'

const MS_PER_DAY = 86_400_000

/**
 * Au-delà, l'arrosage annoncé n'apprend plus rien : les sections « cette
 * semaine » et « plus tard » se rempliraient de dates trop lointaines pour
 * être utiles.
 */
const FORECAST_HORIZON_DAYS = 14

/**
 * En repos végétatif, une plante dehors ne boit presque plus : le rythme du
 * catalogue est celui de la pleine saison. Sans cet espacement, le moteur
 * proposait d'arroser un hortensia en novembre comme en juin — c'était la
 * moitié des cartes de l'hiver.
 */
const DORMANCY_FACTOR_EXPOSED = 3
/** À l'abri, la croissance ralentit sans s'arrêter : on espace moins. */
const DORMANCY_FACTOR_SHELTERED = 1.5
/**
 * De novembre à février, une plante exposée qu'on arrose encore — en pot, au
 * balcon — boit au moins deux fois moins, que le catalogue la dise en dormance
 * ou non. À l'intérieur on ne devine rien : le chauffage assèche autant qu'il
 * ralentit.
 */
const WINTER_FACTOR_EXPOSED = 2

interface Seasonal {
  factor: number
  /** Phrase qui dit pourquoi le rythme est espacé, ou vide. */
  note: string
}

/** Facteur de saison sur la fréquence d'arrosage. 1 hors repos. */
function seasonalFactor(ctx: PlantContext): Seasonal {
  const { instance, currentDate } = ctx
  const month = currentDate.getMonth() + 1
  const exposed = isExposed(instance.location)
  const dormancy = parseJsonArray(instance.catalogPlant?.dormancyMonths)

  if (dormancy.includes(month)) {
    return {
      factor: exposed ? DORMANCY_FACTOR_EXPOSED : DORMANCY_FACTOR_SHELTERED,
      note: 'En repos végétatif, elle boit peu',
    }
  }

  if (exposed && WINTER_REST_MONTHS.includes(month)) {
    return { factor: WINTER_FACTOR_EXPOSED, note: "En hiver, dehors, elle boit peu" }
  }

  return { factor: 1, note: '' }
}

/** « il y a 4 jours », « hier », « aujourd'hui » — de quoi écrire une phrase. */
function agoInDays(days: number): string {
  const rounded = Math.floor(days)
  if (rounded <= 0) return "aujourd'hui"
  if (rounded === 1) return 'hier'
  return `il y a ${rounded} jours`
}

export const r1WateringStandard: AdviceRule = {
  id: 'r1-watering-standard',
  name: 'Arrosage standard',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    const freqDays = instance.wateringFreqDays ?? catalog?.wateringFreqDays
    if (!freqDays) return []

    // Fin de saison : il n'y a plus rien à arroser (r17 propose d'arracher).
    if (isFinishedAnnual(ctx)) return []

    // En pleine terre, l'hiver, la pluie suffit. Seuls les pots — renseignés
    // par leur contenance — et le balcon, souvent abrité, gardent un rythme.
    if (
      instance.location === 'OUTDOOR' &&
      instance.containerSizeLiters == null &&
      WINTER_REST_MONTHS.includes(currentDate.getMonth() + 1)
    ) {
      return []
    }

    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    // Le réglage de l'utilisateur l'emporte sur tout : il connaît sa plante.
    // Sinon, la saison espace et la chaleur resserre — jamais les deux à la
    // fois en pratique, une plante en dormance ne voit pas 28 °C.
    const seasonal: Seasonal =
      instance.customWateringAdjFactor != null ? { factor: 1, note: '' } : seasonalFactor(ctx)

    let factor = seasonal.factor
    if (instance.customWateringAdjFactor != null) {
      factor = instance.customWateringAdjFactor
    } else if (weather.current.temperature > 28 && catalog?.wateringAdjHeat != null) {
      factor *= catalog.wateringAdjHeat
    }

    const adjustedFreq = freqDays * factor
    // Une fréquence modifiée se dit : sinon l'utilisateur lit « fréquence
    // 5 jours » sur une carte qui revient au bout de trois — ou de quinze.
    const rhythmNote =
      seasonal.factor > 1
        ? ` ${seasonal.note} : le rythme passe à ${Math.round(adjustedFreq)} jours.`
        : adjustedFreq < freqDays
          ? ` La chaleur resserre le rythme à ${Math.round(adjustedFreq)} jours.`
          : ''

    const common = {
      id: `${this.id}:${instance.id}`,
      type: 'arrosage' as const,
      label: `Arrose ${plantName} ${emoji}`.trim(),
      shortLabel: 'Arroser',
      plantId: instance.id,
      plantName,
      plantEmoji: emoji,
      done: false,
      kind: 'dated' as const,
      ruleId: this.id,
      howTo: catalog?.careTipWatering ?? undefined,
      recurringDays: freqDays,
    }

    // Arrosée récemment : on annonce la prochaine fois plutôt que de se taire.
    // C'est ce qui alimente « cette semaine » et « plus tard » ; sans cela ces
    // sections resteraient vides, le moteur ne parlant que du présent.
    if (instance.lastWateredAt) {
      const lastWatered = new Date(instance.lastWateredAt)
      const elapsed = (currentDate.getTime() - lastWatered.getTime()) / MS_PER_DAY

      if (elapsed < adjustedFreq) {
        const remaining = adjustedFreq - elapsed
        if (remaining > FORECAST_HORIZON_DAYS) return []

        const next = new Date(currentDate.getTime() + Math.ceil(remaining) * MS_PER_DAY)

        return [
          {
            ...common,
            dueDate: isoDay(next),
            // À venir : ne doit pas concurrencer ce qui est dû aujourd'hui.
            priority: 'low',
            why: `Dernier arrosage ${agoInDays(elapsed)}, pour une fréquence de ${freqDays} jours.${rhythmNote}`,
          },
        ]
      }

      return [
        {
          ...common,
          dueDate: isoDay(currentDate),
          priority: 'high',
          why: `Dernier arrosage ${agoInDays(elapsed)}, pour une fréquence de ${freqDays} jours.${rhythmNote}`,
        },
      ]
    }

    // Jamais arrosée, mais en repos : on compte depuis son ajout plutôt que
    // d'exiger un arrosage le jour même d'une plante qui dort dehors.
    if (seasonal.factor > 1) {
      const sinceAdded = (currentDate.getTime() - new Date(instance.dateAdded).getTime()) / MS_PER_DAY
      if (sinceAdded < adjustedFreq) {
        const remaining = adjustedFreq - sinceAdded
        if (remaining > FORECAST_HORIZON_DAYS) return []
        const next = new Date(currentDate.getTime() + Math.ceil(remaining) * MS_PER_DAY)
        return [
          {
            ...common,
            dueDate: isoDay(next),
            priority: 'low',
            why: `Aucun arrosage noté depuis son ajout.${rhythmNote}`,
          },
        ]
      }
    }

    return [
      {
        ...common,
        dueDate: isoDay(currentDate),
        priority: 'high',
        why: `Aucun arrosage noté depuis son ajout, pour une fréquence de ${freqDays} jours.${rhythmNote}`,
      },
    ]
  },
}
