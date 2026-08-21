import { describe, expect, it } from 'vitest'

import {
  ACTION_TYPES,
  CARE_LOG_TYPES,
  actionHorizon,
  groupActionsByHorizon,
  CARE_LOG_TYPE_BY_ACTION,
  DEFAULT_ALERT_CONFIG,
  alertConfigSchema,
  getWeatherCodeInfo,
  indicatorTone,
  markActionDoneSchema,
  createCareLogSchema,
  createGardenSchema,
  createPlantInstanceSchema,
  formatHarvest,
  loginSchema,
  profilSchema,
  registerSchema,
  updateProfileSchema,
} from '../index'

describe('alertConfig', () => {
  it('la configuration par défaut satisfait son propre schéma', () => {
    expect(alertConfigSchema.safeParse(DEFAULT_ALERT_CONFIG).success).toBe(true)
  })

  it('rejette un canal de notification inconnu', () => {
    expect(
      alertConfigSchema.safeParse({ ...DEFAULT_ALERT_CONFIG, channel: 'sms' }).success,
    ).toBe(false)
  })
})

// Ces messages sont affichés tels quels dans les formulaires du web : les
// déplacer dans @growi/shared ne doit pas les altérer.
describe('messages de validation des formulaires', () => {
  it('loginSchema signale un email invalide', () => {
    const result = loginSchema.safeParse({ email: 'pasunemail', password: 'x' })
    expect(result.error?.issues[0]?.message).toBe('Email invalide')
  })

  it('registerSchema exige un prénom de 2 caractères', () => {
    const result = registerSchema.safeParse({
      firstName: 'A',
      email: 'dan@growi.fr',
      password: 'motdepasse',
      confirm: 'motdepasse',
    })
    expect(result.error?.issues[0]?.message).toBe(
      'Le prénom doit comporter au moins 2 caractères',
    )
  })

  it('registerSchema refuse deux mots de passe différents', () => {
    const result = registerSchema.safeParse({
      firstName: 'Dan',
      email: 'dan@growi.fr',
      password: 'motdepasse',
      confirm: 'autrechose',
    })
    expect(result.error?.issues[0]?.message).toBe('Les mots de passe ne correspondent pas')
    expect(result.error?.issues[0]?.path).toEqual(['confirm'])
  })

  it('profilSchema conserve son message email détaillé', () => {
    const result = profilSchema.safeParse({ firstName: 'Dan', lastName: 'Cohen', email: 'x' })
    expect(result.error?.issues[0]?.message).toBe(
      'Email invalide — vérifie le format : prenom@domaine.fr',
    )
  })
})

describe('DTOs jardin et plantes', () => {
  it('accepte un jardin valide', () => {
    expect(createGardenSchema.safeParse({ name: 'Potager', type: 'OUTDOOR' }).success).toBe(true)
  })

  it('rejette un type de jardin hors énumération', () => {
    expect(createGardenSchema.safeParse({ name: 'Toit', type: 'ROOFTOP' }).success).toBe(false)
  })

  it('exige la localisation à la création d\'une plante', () => {
    expect(createPlantInstanceSchema.safeParse({ customName: 'Basilic' }).success).toBe(false)
    expect(createPlantInstanceSchema.safeParse({ location: 'OUTDOOR' }).success).toBe(true)
  })

  it('accepte gardenType null dans la mise à jour de profil', () => {
    expect(updateProfileSchema.safeParse({ gardenType: null }).success).toBe(true)
    expect(updateProfileSchema.safeParse({ gardenType: 'verger' }).success).toBe(false)
  })
})

describe('journal d\'entretien', () => {
  it('accepte un geste rapide réduit à son type', () => {
    expect(createCareLogSchema.safeParse({ type: 'watering' }).success).toBe(true)
  })

  it('exige un statut pour une note de santé', () => {
    expect(createCareLogSchema.safeParse({ type: 'health' }).success).toBe(false)
    expect(createCareLogSchema.safeParse({ type: 'health', status: 'WARNING' }).success).toBe(
      true,
    )
  })

  it('accepte les gestes ajoutés avec le journal unifié', () => {
    for (const type of ['harvest', 'treatment', 'repotting', 'sowing', 'other'] as const) {
      expect(createCareLogSchema.safeParse({ type }).success).toBe(true)
    }
  })

  it('accepte un produit employé — « marc de café »', () => {
    const result = createCareLogSchema.safeParse({
      type: 'fertilizing',
      productUsed: 'Marc de café',
    })
    expect(result.success).toBe(true)
  })

  it('exige une unité dès qu\'une quantité est donnée', () => {
    expect(createCareLogSchema.safeParse({ type: 'harvest', quantity: 1.2 }).success).toBe(false)
    expect(
      createCareLogSchema.safeParse({ type: 'harvest', quantity: 1.2, unit: 'kg' }).success,
    ).toBe(true)
  })

  it('rejette une unité inconnue et une quantité négative', () => {
    expect(
      createCareLogSchema.safeParse({ type: 'harvest', quantity: 1, unit: 'tonnes' }).success,
    ).toBe(false)
    expect(
      createCareLogSchema.safeParse({ type: 'harvest', quantity: -3, unit: 'kg' }).success,
    ).toBe(false)
  })

  it('rejette un type d\'intervention inconnu', () => {
    expect(createCareLogSchema.safeParse({ type: 'bricolage' }).success).toBe(false)
  })
})

describe('planning du jour', () => {
  it('associe un geste du journal à chaque type de tâche', () => {
    for (const type of ACTION_TYPES) {
      expect(CARE_LOG_TYPES).toContain(CARE_LOG_TYPE_BY_ACTION[type])
    }
  })

  it('exige un jardin et un type de tâche connu pour cocher', () => {
    expect(
      markActionDoneSchema.safeParse({ gardenId: 'g1', actionType: 'arrosage' }).success,
    ).toBe(true)
    expect(markActionDoneSchema.safeParse({ actionType: 'arrosage' }).success).toBe(false)
    expect(
      markActionDoneSchema.safeParse({ gardenId: 'g1', actionType: 'bricolage' }).success,
    ).toBe(false)
  })

  it('range les tâches en trois horizons, le retard avec le jour même', () => {
    const groups = groupActionsByHorizon(
      [
        { id: 'retard', dueDate: '2026-08-18' },
        { id: 'jour', dueDate: '2026-08-21' },
        { id: 'demain', dueDate: '2026-08-22' },
        { id: 'semaine', dueDate: '2026-08-27' },
      ],
      '2026-08-21',
    )

    expect(groups.today.map((a) => a.id)).toEqual(['retard', 'jour'])
    expect(groups.tomorrow.map((a) => a.id)).toEqual(['demain'])
    expect(groups.later.map((a) => a.id)).toEqual(['semaine'])
  })

  it('passe correctement la fin de mois', () => {
    expect(actionHorizon('2026-09-01', '2026-08-31')).toBe('tomorrow')
    expect(actionHorizon('2026-09-02', '2026-08-31')).toBe('later')
  })

  it('traduit les codes météo, et retombe sur un libellé neutre', () => {
    expect(getWeatherCodeInfo(0).label).toBe('Ciel dégagé')
    expect(getWeatherCodeInfo(95).severity).toBe('bad')
    expect(getWeatherCodeInfo(1234).label).toBe('Conditions inconnues')
  })
})

describe('couleur des indicateurs', () => {
  const empty = {
    gardens: 0,
    plants: 0,
    plantsToWater: 0,
    tasksToday: 0,
    tasksLate: 0,
    tasksWeek: 0,
    alerts: 0,
    alertsHigh: 0,
    plantsWarning: 0,
    plantsCritical: 0,
  }

  it('reste neutre sur un compte vide', () => {
    expect(indicatorTone('plants', empty)).toBe('neutral')
    expect(indicatorTone('health', empty)).toBe('neutral')
    // Rien à faire est une bonne nouvelle, pas une absence d'information.
    expect(indicatorTone('tasks', empty)).toBe('good')
  })

  it('réserve le rouge à ce qui se dégrade', () => {
    expect(indicatorTone('tasks', { ...empty, tasksToday: 3 })).toBe('warning')
    expect(indicatorTone('tasks', { ...empty, tasksToday: 3, tasksLate: 1 })).toBe('critical')
    expect(indicatorTone('alerts', { ...empty, alerts: 2 })).toBe('warning')
    expect(indicatorTone('alerts', { ...empty, alerts: 2, alertsHigh: 1 })).toBe('critical')
    expect(indicatorTone('health', { ...empty, plants: 4, plantsCritical: 1 })).toBe('critical')
  })

  it('ne rougit pas l\'arrosage du jour à cause d\'une taille en retard', () => {
    const summary = { ...empty, plants: 4, plantsToWater: 2, tasksToday: 5, tasksLate: 3 }

    expect(indicatorTone('tasks', summary)).toBe('critical')
    expect(indicatorTone('water', summary)).toBe('warning')
  })
})

describe('affichage d\'une récolte', () => {
  it('accorde les unités qui sont des noms', () => {
    expect(formatHarvest(1, 'pièce')).toBe('1 pièce')
    expect(formatHarvest(3, 'pièce')).toBe('3 pièces')
    expect(formatHarvest(3, 'botte')).toBe('3 bottes')
  })

  it('laisse les symboles invariables', () => {
    expect(formatHarvest(3, 'kg')).toBe('3 kg')
    expect(formatHarvest(500, 'g')).toBe('500 g')
    expect(formatHarvest(2, 'L')).toBe('2 L')
  })

  it('garde le singulier en dessous de deux, comme le veut le français', () => {
    expect(formatHarvest(1.5, 'pièce')).toBe('1,5 pièce')
    expect(formatHarvest(2, 'pièce')).toBe('2 pièces')
  })

  it('écrit les décimales avec une virgule', () => {
    expect(formatHarvest(1.2, 'kg')).toBe('1,2 kg')
  })

  it('supporte une unité absente ou inconnue', () => {
    expect(formatHarvest(4)).toBe('4')
    expect(formatHarvest(4, null)).toBe('4')
    expect(formatHarvest(4, 'cageot')).toBe('4 cageot')
  })
})
