import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { monthRunWindow, parseMonthsCsv, daysSince } from '../utils'

/**
 * Faute de `careTipFertilizing` au catalogue, un mot par famille de plantes.
 *
 * Mieux vaut une consigne générique mais juste qu'une popin « Comment faire »
 * vide : c'est précisément ce qui rendait le détail inutile pour les actions
 * du moteur.
 */
const HOW_TO_BY_CATEGORY: Record<string, string> = {
  VEGETABLE:
    'Apporte un engrais riche en potasse au pied, sur sol humide, puis arrose pour le faire descendre aux racines.',
  HERBS:
    'Une demi-dose suffit : trop d’azote fait pousser vite et fade. Sur substrat déjà humide.',
  INDOOR:
    'Engrais liquide dilué dans l’eau d’arrosage, sur terre humide — jamais sur un substrat sec, les racines brûleraient.',
  SUCCULENTS:
    'Très peu, très dilué : un engrais pauvre en azote, une fois dans la saison de croissance.',
  FLOWERS:
    'Un engrais fleurs à faible azote, au pied, juste avant ou pendant la floraison.',
  TREES_SHRUBS:
    'Griffe l’engrais en surface sur toute la largeur du feuillage, puis arrose abondamment.',
}

const HOW_TO_DEFAULT =
  'Applique l’engrais sur un substrat déjà humide, au pied de la plante, puis arrose pour le faire pénétrer.'

export const r9Fertilizing: AdviceRule = {
  id: 'r9-fertilizing',
  name: 'Fertilisation',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    // On ne fertilise pas une plante en détresse : l'engrais force une
    // croissance que ses racines ne peuvent pas soutenir. Le moteur ignorait
    // totalement l'état de santé et proposait de nourrir une plante mourante.
    if (instance.healthStatus === 'CRITICAL') return []

    const months = parseMonthsCsv(catalog.fertilizerMonths)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    if (daysSince(instance.lastFertilizedAt, currentDate) < 28) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    // « Ce mois-ci » au sens propre : la fenêtre s'arrête à la fin de la série
    // de mois de fertilisation en cours, et la carte cesse alors d'exister.
    const window = monthRunWindow(months, currentDate)

    const last = instance.lastFertilizedAt
      ? `Dernier apport il y a ${Math.floor(daysSince(instance.lastFertilizedAt, currentDate))} jours.`
      : 'Aucun apport noté à ce jour.'

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'fertilisation',
        label: `Fertilise ${plantName} ce mois-ci 🌿`,
        shortLabel: 'Fertiliser',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: `C'est la saison de croissance de cette plante. ${last}`,
        howTo: HOW_TO_BY_CATEGORY[catalog.category] ?? HOW_TO_DEFAULT,
      },
    ]
  },
}
