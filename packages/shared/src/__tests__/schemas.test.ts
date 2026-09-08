import { describe, expect, it } from 'vitest'

import {
  ACTION_TYPES,
  CARE_LOG_TYPES,
  actionHorizon,
  clearPlanningTodaySchema,
  gardenActionSchema,
  groupActionsByHorizon,
  groupWateringActions,
  markActionsDoneBulkSchema,
  undoActionSchema,
  type GardenAction,
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

  it('range les tâches en quatre horizons, le retard avec le jour même', () => {
    const groups = groupActionsByHorizon(
      [
        { id: 'retard', dueDate: '2026-08-18' },
        { id: 'jour', dueDate: '2026-08-21' },
        { id: 'demain', dueDate: '2026-08-22' },
        { id: 'semaine', dueDate: '2026-08-27' },
        { id: 'lointain', dueDate: '2026-09-30' },
        {
          id: 'fenetre',
          dueDate: '2026-09-30',
          kind: 'window' as const,
          window: { start: '2026-08-01', end: '2026-09-30' },
        },
      ],
      '2026-08-21',
    )

    expect(groups.today.map((a) => a.id)).toEqual(['retard', 'jour'])
    expect(groups.week.map((a) => a.id)).toEqual(['demain', 'semaine'])
    expect(groups.month.map((a) => a.id)).toEqual(['fenetre'])
    expect(groups.later.map((a) => a.id)).toEqual(['lointain'])
  })

  it('passe correctement la fin de mois', () => {
    expect(actionHorizon({ dueDate: '2026-09-01' }, '2026-08-31')).toBe('week')
    expect(actionHorizon({ dueDate: '2026-09-07' }, '2026-08-31')).toBe('week')
    expect(actionHorizon({ dueDate: '2026-09-08' }, '2026-08-31')).toBe('later')
  })

  it('une action sans nature reste datée', () => {
    expect(actionHorizon({ dueDate: '2026-08-20' }, '2026-08-21')).toBe('today')
  })

  it("une fenêtre à venir attend son tour, une fenêtre ouverte n'est jamais en retard", () => {
    const window = { start: '2026-10-01', end: '2026-11-30' }
    expect(actionHorizon({ dueDate: window.end, kind: 'window', window }, '2026-09-08')).toBe(
      'later',
    )
    expect(actionHorizon({ dueDate: window.end, kind: 'window', window }, '2026-10-15')).toBe(
      'month',
    )
    // Fenêtre close : rangée au calme, jamais traitée comme un retard.
    expect(actionHorizon({ dueDate: window.end, kind: 'window', window }, '2026-12-01')).toBe(
      'month',
    )
  })
})

describe('planning v2 — regroupement et gestes de masse', () => {
  const action = (over: Partial<GardenAction> & { id: string }): GardenAction => ({
    type: 'arrosage',
    label: 'Arroser',
    shortLabel: 'Arroser',
    plantId: `p-${over.id}`,
    dueDate: '2026-09-08',
    done: false,
    priority: 'medium',
    ...over,
  })

  it('regroupe les arrosages, laisse le reste unitaire', () => {
    const { groups, singles } = groupWateringActions(
      [
        action({ id: 'a' }),
        action({ id: 'b' }),
        action({ id: 'c', type: 'taille' }),
        action({ id: 'd' }),
      ],
      'today',
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('arrosage:today')
    expect(groups[0].actions.map((a) => a.id)).toEqual(['a', 'b', 'd'])
    expect(singles.map((a) => a.id)).toEqual(['c'])
  })

  it('un seul arrosage ne fait pas un groupe, et garde sa place dans la liste', () => {
    const { groups, singles } = groupWateringActions([
      action({ id: 'taille', type: 'taille' }),
      action({ id: 'seul' }),
      action({ id: 'rempotage', type: 'rempotage' }),
    ])

    expect(groups).toHaveLength(0)
    expect(singles.map((a) => a.id)).toEqual(['taille', 'seul', 'rempotage'])
  })

  it('un arrosage sans plante reste unitaire — rien à cocher dans une carte groupée', () => {
    const { groups, singles } = groupWateringActions([
      action({ id: 'a', plantId: undefined }),
      action({ id: 'b', plantId: undefined }),
    ])

    expect(groups).toHaveLength(0)
    expect(singles).toHaveLength(2)
  })

  it('exige au moins un item, et refuse une tournée démesurée', () => {
    const item = { actionType: 'arrosage' as const, plantId: 'p1' }
    expect(markActionsDoneBulkSchema.safeParse({ gardenId: 'g1', items: [item] }).success).toBe(
      true,
    )
    expect(markActionsDoneBulkSchema.safeParse({ gardenId: 'g1', items: [] }).success).toBe(false)
    expect(
      markActionsDoneBulkSchema.safeParse({ gardenId: 'g1', items: Array(101).fill(item) }).success,
    ).toBe(false)
  })

  it('« Ignorer » et son « Rétablir » partagent le même corps', () => {
    expect(clearPlanningTodaySchema.safeParse({ gardenId: 'g1' }).success).toBe(true)
    expect(clearPlanningTodaySchema.safeParse({ gardenId: 'g1', undo: true }).success).toBe(true)
    expect(clearPlanningTodaySchema.safeParse({ undo: true }).success).toBe(false)
  })

  it("annuler demande le geste à effacer, pas seulement l'action", () => {
    expect(undoActionSchema.safeParse({ gardenId: 'g1', careLogId: 'c1' }).success).toBe(true)
    expect(undoActionSchema.safeParse({ gardenId: 'g1' }).success).toBe(false)
  })

  it('accepte encore une action sans aucun des champs de la v2', () => {
    const legacy = action({ id: 'a' })
    expect(gardenActionSchema.safeParse(legacy).success).toBe(true)
    expect(
      gardenActionSchema.safeParse({
        ...legacy,
        kind: 'window',
        window: { start: '2026-09-01', end: '2026-10-31' },
        why: 'Le rosier se taille en fin de saison.',
        howTo: 'Sécateur propre, au-dessus d’un œil tourné vers l’extérieur.',
        ruleId: 'r4-pruning-seasonal',
      }).success,
    ).toBe(true)
    expect(gardenActionSchema.safeParse({ ...legacy, kind: 'saison' }).success).toBe(false)
  })
})

describe('météo', () => {
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
