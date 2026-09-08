import { describe, expect, it } from 'vitest'

// Les alertes du contexte jardin sont lues sur l'accueil du mobile et sur la
// page Météo du web. Elles ne dépendaient que du temps qu'il fait : arroser
// n'en éteignait aucune, et chaque plante avait la sienne — vingt plantes,
// vingt bandeaux identiques.

import { generatePlantAlerts } from '../garden-context'
import type { Plant } from '../plant-types'
import type { ForecastDay, FrostRisk, WateringIndex } from '@/types/weather'

const DAY_MS = 86_400_000

function plant(overrides: Partial<Plant> & { id: string }): Plant {
  return {
    name: `Plante ${overrides.id}`,
    emoji: '🌿',
    category: 'potager',
    location: 'exterieur',
    dateAdded: '2026-01-01',
    wateringFrequencyDays: 3,
    sunExposure: 'full',
    wateringDifficulty: 'medium',
    healthStatus: 'healthy',
    description: '',
    careTips: { watering: '', light: '', soil: '' },
    ...overrides,
  } as Plant
}

/** Une plante arrosée il y a `days` jours. */
function watered(id: string, days: number, overrides: Partial<Plant> = {}): Plant {
  return plant({
    id,
    lastWateredDate: new Date(Date.now() - days * DAY_MS).toISOString(),
    ...overrides,
  })
}

const NO_FROST: FrostRisk = {
  level: 'none',
  label: 'Aucun risque de gel cette semaine',
  affectedNights: 0,
  minTemp: 12,
}

/** Chaud et sec : l'indice d'arrosage qui déclenchait tout. */
const THIRSTY: WateringIndex = {
  score: 8,
  label: 'Arrosage recommandé ce soir',
  reasoning: 'Aucune pluie prévue, températures atteignant 23°C',
}

const CALM: WateringIndex = { score: 3, label: 'Arrosage léger possible', reasoning: '' }

function forecast(days: Partial<ForecastDay>[] = []): ForecastDay[] {
  return days.map(
    (day, index) =>
      ({
        date: new Date(Date.now() + index * DAY_MS).toISOString().slice(0, 10),
        tempMax: 23,
        tempMin: 14,
        precipitationSum: 0,
        precipitationProbability: 0,
        weatherCode: 0,
        sunrise: '',
        sunset: '',
        ...day,
      }) as ForecastDay,
  )
}

const THREE_DRY_DAYS = forecast([{}, {}, {}])

describe('alertes du contexte jardin', () => {
  it('se tait sur une plante qu’on vient d’arroser', () => {
    const alerts = generatePlantAlerts(
      [watered('p1', 0)],
      NO_FROST,
      THIRSTY,
      THREE_DRY_DAYS,
      'summer',
    )

    expect(alerts).toHaveLength(0)
  })

  it('alerte celle dont l’échéance est passée, et elle seule', () => {
    const alerts = generatePlantAlerts(
      [watered('arrosee', 0), watered('assoiffee', 5)],
      NO_FROST,
      THIRSTY,
      THREE_DRY_DAYS,
      'summer',
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0].alertType).toBe('drought')
    expect(alerts[0].message).toContain('Plante assoiffee')
    expect(alerts[0].message).not.toContain('Plante arrosee')
  })

  it('alerte une plante jamais arrosée', () => {
    const alerts = generatePlantAlerts(
      [plant({ id: 'neuve' })],
      NO_FROST,
      THIRSTY,
      THREE_DRY_DAYS,
      'summer',
    )

    expect(alerts.map((a) => a.alertType)).toEqual(['drought'])
  })

  it('réunit les plantes assoiffées en un seul bandeau, trois noms au plus', () => {
    const thirsty = ['a', 'b', 'c', 'd', 'e'].map((id) => watered(id, 5))

    const alerts = generatePlantAlerts(thirsty, NO_FROST, THIRSTY, THREE_DRY_DAYS, 'summer')

    // Cinq plantes, une seule alerte : c'est tout l'objet du regroupement.
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toContain('5 plantes')
    expect(alerts[0].message).toContain('et 2 autres')
  })

  it('garde le nom et l’emoji quand une seule plante est concernée', () => {
    const alerts = generatePlantAlerts(
      [watered('p1', 5, { name: 'Basilic', emoji: '🌿' })],
      NO_FROST,
      THIRSTY,
      THREE_DRY_DAYS,
      'summer',
    )

    expect(alerts[0].message).toMatch(/^🌿 Basilic —/)
    expect(alerts[0].message).toContain("elle n’a pas été arrosée")
  })

  it('ne dit rien de la sécheresse quand la météo ne la justifie pas', () => {
    const alerts = generatePlantAlerts(
      [watered('p1', 30)],
      NO_FROST,
      CALM,
      THREE_DRY_DAYS,
      'summer',
    )

    expect(alerts).toHaveLength(0)
  })

  it('réunit aussi les plantes menacées par le gel, arrosées ou non', () => {
    const frost: FrostRisk = {
      level: 'high',
      label: 'Risque de gel élevé (2 nuits à risque)',
      affectedNights: 2,
      minTemp: -4,
    }

    const alerts = generatePlantAlerts(
      [watered('a', 0), watered('b', 0), watered('c', 0)],
      frost,
      CALM,
      forecast([{ tempMin: -4 }, { tempMin: -2 }]),
      'winter',
    )

    // Le gel ne s'éteint pas en arrosant : c'est un risque, pas un besoin.
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ alertType: 'frost', severity: 'critical' })
    expect(alerts[0].message).toContain('3 plantes')
    expect(alerts[0].message).toContain('Rentre-les')
  })
})
