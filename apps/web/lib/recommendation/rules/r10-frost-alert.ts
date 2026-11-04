import type { AdviceRule, PlantContext, GardenAction, PlantAlert } from '../types'
import { doneSince, isExposed, isoDay, minTempWithin } from '../utils'
import { FROST_HOW_TO_DEFAULT, WINTER_HOW_TO, winterProtectionOf } from '../winter-protection'

export interface AlertRule extends AdviceRule {
  generateAlerts(ctx: PlantContext): PlantAlert[]
}

const MS_PER_DAY = 86_400_000

/** Seuil de gel des 48 prochaines heures. */
const FROST_THRESHOLD_C = 2

/**
 * Une protection posée vaut pour l'épisode de froid : on ne la redemande pas
 * chaque matin d'une semaine de gelées.
 */
const PROTECTED_QUIET_DAYS = 3

/** Début de l'hiver en cours : 1ᵉʳ septembre, de cette année ou de la précédente. */
function winterSeasonStart(date: Date): Date {
  const year = date.getMonth() + 1 >= 9 ? date.getFullYear() : date.getFullYear() - 1
  return new Date(year, 8, 1)
}

/**
 * Faut-il alerter ? Une plante sensible, **dehors**, et du gel sous 48 h.
 *
 * Le moteur alertait aussi pour un Monstera du salon : `frostSensitivity` dit
 * ce que la plante craint, pas où elle est.
 */
function frostThreat(ctx: PlantContext): { minTemp: number; sensitivity: 'HIGH' | 'LIGHT' } | null {
  const { instance, weather, currentDate } = ctx
  const catalog = instance.catalogPlant
  if (!catalog) return null

  const sensitivity = catalog.frostSensitivity
  if (sensitivity !== 'HIGH' && sensitivity !== 'LIGHT') return null
  if (!isExposed(instance.location)) return null

  const minTemp = minTempWithin(weather, 2)
  if (minTemp == null || minTemp >= FROST_THRESHOLD_C) return null

  // Rentrée pour l'hiver (r14, protection « INDOOR ») : elle n'est plus dehors,
  // même si sa fiche le dit encore.
  if (
    winterProtectionOf(catalog.winterProtectionType) === 'INDOOR' &&
    doneSince(ctx, 'r14-winter-prep', winterSeasonStart(currentDate))
  ) {
    return null
  }

  return { minTemp, sensitivity }
}

export const r10FrostAlert: AlertRule = {
  id: 'r10-frost-alert',
  name: 'Alerte gel',
  gestureLabel: 'Protection contre le gel',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    const threat = frostThreat(ctx)
    if (!catalog || !threat) return []

    if (doneSince(ctx, this.id, new Date(currentDate.getTime() - PROTECTED_QUIET_DAYS * MS_PER_DAY))) {
      return []
    }

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const protection = winterProtectionOf(catalog.winterProtectionType)

    return [
      {
        id: `${this.id}:${instance.id}`,
        // « Autre », et non « traitement » : cocher la protection écrivait un
        // traitement au journal, et taisait trois mois le traitement préventif.
        type: 'autre',
        label: `❄️ Gel prévu — protège ${plantName}`,
        shortLabel: 'Protéger du gel',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: isoDay(currentDate),
        done: false,
        priority: threat.sensitivity === 'HIGH' ? 'high' : 'medium',
        kind: 'dated',
        ruleId: this.id,
        why: `Jusqu'à ${Math.round(threat.minTemp)} °C annoncés d'ici 48 heures, et cette plante ${
          threat.sensitivity === 'HIGH' ? 'ne supporte pas le gel' : 'craint les gelées'
        }.`,
        howTo: catalog.careTipWinter ?? (protection ? WINTER_HOW_TO[protection] : FROST_HOW_TO_DEFAULT),
      },
    ]
  },

  generateAlerts(ctx: PlantContext): PlantAlert[] {
    const { instance } = ctx
    const catalog = instance.catalogPlant
    const threat = frostThreat(ctx)
    if (!catalog || !threat) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'

    return [
      {
        id: `alert-gel:${instance.id}`,
        type: 'gel',
        message: `Gel prévu (${Math.round(threat.minTemp)}°C) — ${plantName} est sensible au froid`,
        severity: threat.sensitivity === 'HIGH' ? 'high' : 'medium',
        plantInstanceId: instance.id,
      },
    ]
  },
}
