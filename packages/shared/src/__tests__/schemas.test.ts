import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ALERT_CONFIG,
  alertConfigSchema,
  createCareLogSchema,
  createGardenSchema,
  createPlantInstanceSchema,
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
