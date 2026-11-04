import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { doneSince, monthRunWindow, parseJsonArray } from '../utils'

/** Ce qu'on élève au chaud avant de l'installer au jardin. */
const RAISED_CATEGORIES = new Set(['VEGETABLE', 'HERBS', 'FLOWERS'])

/** Nuits minimales pour sortir des plants qui craignent le froid… */
const MIN_NIGHT_TENDER_C = 10
/** … et pour les autres. */
const MIN_NIGHT_HARDY_C = 5

const HOW_TO =
  "Habitue d'abord tes plants : quelques heures dehors par jour pendant une semaine, à l'abri du vent. Puis plante en fin de journée, arrose bien au pied et garde un voile à portée de main si les nuits fraîchissent."

/**
 * Mettre en place au jardin les plants élevés à l'intérieur ou sous serre
 * (`transplantMonths`), quand les nuits le permettent.
 *
 * Seulement pour ce qui est fait pour vivre dehors : une plante d'intérieur
 * a souvent des mois de repiquage au catalogue — c'est d'un pot à l'autre, pas
 * du salon au potager.
 */
export const r16Transplant: AdviceRule = {
  id: 'r16-transplant',
  name: 'Mise en place au jardin',
  gestureLabel: 'Mise en place au jardin',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    if (instance.location !== 'INDOOR' && instance.location !== 'GREENHOUSE') return []
    if (!catalog.outdoor || catalog.indoor) return []
    if (!RAISED_CATEGORIES.has(catalog.category)) return []

    const months = parseJsonArray(catalog.transplantMonths)
    if (!months.includes(currentDate.getMonth() + 1)) return []

    const tender = catalog.frostSensitivity === 'HIGH' || catalog.frostSensitivity === 'LIGHT'
    const minNight = tender ? MIN_NIGHT_TENDER_C : MIN_NIGHT_HARDY_C
    const nights = weather.daily.slice(0, 3)
    if (nights.length < 3 || nights.some((d) => d.tempMin <= minNight)) return []

    const window = monthRunWindow(months, currentDate)
    if (doneSince(ctx, this.id, window.start)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const coldest = Math.round(Math.min(...nights.map((d) => d.tempMin)))

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'autre',
        label: `Installe ${plantName} au jardin`,
        shortLabel: 'Mettre en terre',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: `C'est la période pour la mettre en place dehors, et les trois prochaines nuits restent au-dessus de ${minNight} °C (minimum prévu : ${coldest} °C).`,
        howTo: HOW_TO,
      },
    ]
  },
}
