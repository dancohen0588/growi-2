import type { AdviceRule, PlantContext, GardenAction, PlantAlert } from '../types'

export interface AlertRule extends AdviceRule {
  generateAlerts(ctx: PlantContext): PlantAlert[]
}

export const r10FrostAlert: AlertRule = {
  id: 'r10-frost-alert',
  name: 'Alerte gel',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const sensitivity = catalog.frostSensitivity
    if (sensitivity !== 'HIGH' && sensitivity !== 'LIGHT') return []

    // Check tempMin in next 48h (first 2 days of forecast)
    const frostDays = weather.daily.slice(0, 2)
    const hasFrost = frostDays.some((d) => d.tempMin < 2)
    if (!hasFrost) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const priority = sensitivity === 'HIGH' ? 'high' : 'medium'

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'traitement',
        label: `❄️ Gel prévu — protège ${plantName}`,
        shortLabel: 'Protéger',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority,
      },
    ]
  },

  generateAlerts(ctx: PlantContext): PlantAlert[] {
    const { instance, weather } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const sensitivity = catalog.frostSensitivity
    if (sensitivity !== 'HIGH' && sensitivity !== 'LIGHT') return []

    const frostDays = weather.daily.slice(0, 2)
    const hasFrost = frostDays.some((d) => d.tempMin < 2)
    if (!hasFrost) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const minTemp = Math.min(...frostDays.map((d) => d.tempMin))

    return [
      {
        id: `alert-gel:${instance.id}`,
        type: 'gel',
        message: `Gel prévu (${minTemp}°C) — ${plantName} est sensible au froid`,
        severity: sensitivity === 'HIGH' ? 'high' : 'medium',
        plantInstanceId: instance.id,
      },
    ]
  },
}
