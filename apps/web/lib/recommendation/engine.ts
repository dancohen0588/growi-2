import type { AdviceRule, PlantContext, GardenAction, PlantAdvice, PlantAlert, GardenAdviceResult } from './types'
import { r1WateringStandard } from './rules/r1-watering-standard'
import { r2WateringHeat } from './rules/r2-watering-heat'
import { r3WateringRain } from './rules/r3-watering-rain'
import { r4PruningSeasonal } from './rules/r4-pruning-seasonal'
import { r5PruningOverdue } from './rules/r5-pruning-overdue'
import { r6SowingIndoor } from './rules/r6-sowing-indoor'
import { r7SowingOutdoor } from './rules/r7-sowing-outdoor'
import { r8Harvest } from './rules/r8-harvest'
import { r9Fertilizing } from './rules/r9-fertilizing'
import { r10FrostAlert } from './rules/r10-frost-alert'
import { r11Repotting } from './rules/r11-repotting'
import { r12PreventiveTreatment } from './rules/r12-preventive-treatment'
import { r13Mulching } from './rules/r13-mulching'
import { r14WinterPrep } from './rules/r14-winter-prep'
import { r15Deadheading } from './rules/r15-deadheading'
import { r16Transplant } from './rules/r16-transplant'
import { isoDay } from './utils'

/**
 * Version de la forme du payload mis en cache six heures.
 *
 * Sans elle, changer la forme d'une `GardenAction` — ce que fait la v2 avec
 * `kind` et `window` — sert pendant six heures des plannings hybrides : des
 * tailles sans fenêtre, donc rangées « en retard », à côté de tailles qui n'y
 * sont plus. Un cache d'une version antérieure est ignoré et recalculé.
 */
export const ADVICE_PAYLOAD_VERSION = 3

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Une plante qui aurait cinq choses à faire le même jour noie la liste sans
 * que l'utilisateur en fasse davantage. Trois, et les plus prioritaires.
 */
const MAX_ACTIONS_PER_PLANT = 3

/**
 * Ce qui se range ensemble sous le cap : un geste par type et par plante.
 *
 * Les « autres gestes » sont distincts par règle — pailler et préparer
 * l'hivernage ne se remplacent pas l'un l'autre.
 */
function capKey(action: GardenAction): string {
  return action.type === 'autre' ? `autre:${action.ruleId ?? action.id}` : action.type
}

/**
 * Une action datée d'un jour à venir n'est qu'une **annonce** — « prochain
 * arrosage jeudi ». Elle ne compte pas dans le cap : avant, l'arrosage annoncé
 * prenait l'une des trois places, et chassait la taille ou le paillage du
 * moment, qui eux sont à faire maintenant.
 */
function isAnnouncement(action: GardenAction, today: string): boolean {
  return action.kind !== 'window' && action.dueDate > today
}

const RULES: AdviceRule[] = [
  r1WateringStandard,
  r2WateringHeat,
  r3WateringRain,
  r4PruningSeasonal,
  r5PruningOverdue,
  r6SowingIndoor,
  r7SowingOutdoor,
  r8Harvest,
  r9Fertilizing,
  r10FrostAlert,
  r11Repotting,
  r12PreventiveTreatment,
  r13Mulching,
  r14WinterPrep,
  r15Deadheading,
  r16Transplant,
]

const GESTURE_LABELS = new Map(
  RULES.flatMap((rule) => (rule.gestureLabel ? [[rule.id, rule.gestureLabel] as const] : [])),
)

/**
 * Nom du geste à écrire au journal pour une action « autre » de cette règle —
 * « Paillage », « Hivernage ». `undefined` pour une règle inconnue ou qui
 * produit un geste déjà nommé par son type.
 */
export function gestureLabelForRule(ruleId: string | null | undefined): string | undefined {
  return ruleId ? GESTURE_LABELS.get(ruleId) : undefined
}

/**
 * L'ordre du planning : ce qui a un jour d'abord, puis l'urgence, puis la date.
 *
 * La nature passe avant la priorité — une action à fenêtre est par définition
 * sans urgence, et laisser une taille « à faire ce mois-ci » devancer un
 * arrosage du jour parce qu'elle est déclarée plus tôt n'aurait aucun sens.
 */
function compareActions(a: GardenAction, b: GardenAction): number {
  const kindDiff = (a.kind === 'window' ? 1 : 0) - (b.kind === 'window' ? 1 : 0)
  if (kindDiff !== 0) return kindDiff

  const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  if (pDiff !== 0) return pDiff

  return a.dueDate.localeCompare(b.dueDate)
}

export class RecommendationEngine {
  private rules: AdviceRule[] = RULES

  evaluate(contexts: PlantContext[]): GardenAction[] {
    const allActions: GardenAction[] = []

    for (const ctx of contexts) {
      const plantActions: GardenAction[] = []

      for (const rule of this.rules) {
        plantActions.push(...rule.evaluate(ctx))
      }

      // R5 overrides R4 for the same plant
      const hasR5 = plantActions.some((a) => a.id.startsWith('r5-'))
      const filtered = hasR5
        ? plantActions.filter((a) => !a.id.startsWith('r4-'))
        : plantActions

      // R3 overrides R1 for the same plant (rain postpones standard watering)
      const hasR3 = filtered.some((a) => a.id.startsWith('r3-'))
      const deduped = hasR3
        ? filtered.filter((a) => !a.id.startsWith('r1-'))
        : filtered

      // Deduplicate: same type + plantId + dueDate
      const seen = new Set<string>()
      const unique = deduped.filter((a) => {
        const key = `${a.type}:${a.plantId ?? ''}:${a.dueDate}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // La photo est attachée ici plutôt que dans chacune des douze règles :
      // elle décrit la plante, pas le geste.
      const photoUrl = ctx.instance.photoUrl ?? ctx.instance.catalogPlant?.imageUrl ?? null

      // Le cap retient les plus prioritaires, pas les premières venues : sans
      // ce tri local, l'ordre de déclaration des règles décidait de ce qui
      // survit — un rempotage « plus tard » aurait chassé un arrosage du jour.
      const ranked = [...unique].sort(compareActions)

      // Puis un geste par type : deux cartes « Traiter » ou « Arroser » pour la
      // même plante n'en font pas faire davantage, et prennent la place d'un
      // geste différent.
      const today = isoDay(ctx.currentDate)
      const seenKeys = new Set<string>()
      const announced: GardenAction[] = []
      const current: GardenAction[] = []
      for (const action of ranked) {
        const key = capKey(action)
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        if (isAnnouncement(action, today)) announced.push(action)
        else current.push(action)
      }

      allActions.push(
        ...[...current.slice(0, MAX_ACTIONS_PER_PLANT), ...announced].map((a) => ({
          ...a,
          plantPhotoUrl: photoUrl,
        })),
      )
    }

    allActions.sort(compareActions)

    return allActions
  }

  generateAlerts(contexts: PlantContext[]): PlantAlert[] {
    const alerts: PlantAlert[] = []
    for (const ctx of contexts) {
      for (const rule of this.rules) {
        if (rule.generateAlerts) {
          alerts.push(...rule.generateAlerts(ctx))
        }
      }
    }
    return alerts
  }

  evaluateForPlant(ctx: PlantContext): PlantAdvice {
    const tasks = this.evaluate([ctx])
    const alerts = this.generateAlerts([ctx])
    const catalog = ctx.instance.catalogPlant

    return {
      plantInstanceId: ctx.instance.id,
      plantName: ctx.instance.customName ?? catalog?.commonName ?? 'Plante',
      plantEmoji: ctx.instance.emoji ?? catalog?.emoji ?? '',
      tasks,
      alerts,
      careTips: {
        watering: catalog?.careTipWatering ?? '',
        light: catalog?.careTipLight ?? '',
        soil: catalog?.careTipSoil ?? '',
        pruning: catalog?.careTipPruning ?? undefined,
        diseases: catalog?.careTipDiseases ?? undefined,
        winter: catalog?.careTipWinter ?? undefined,
      },
      generatedAt: ctx.currentDate,
    }
  }

  evaluateGarden(contexts: PlantContext[], gardenId: string): GardenAdviceResult {
    const now = contexts[0]?.currentDate ?? new Date()
    const actions = this.evaluate(contexts)
    const alerts = this.generateAlerts(contexts)
    const adviceByPlant = contexts.map((ctx) => this.evaluateForPlant(ctx))

    const expiresAt = new Date(now)
    expiresAt.setHours(expiresAt.getHours() + 6)

    return {
      version: ADVICE_PAYLOAD_VERSION,
      gardenId,
      generatedAt: now,
      expiresAt,
      actions,
      adviceByPlant,
      alerts,
    }
  }
}
