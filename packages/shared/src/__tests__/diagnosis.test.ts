import { describe, expect, it } from 'vitest'

import {
  PHOTO_KINDS,
  applyDiagnosisSchema,
  diagnoseRequestSchema,
  diagnosisDetailSchema,
  diagnosisListItemSchema,
  diagnosisResultSchema,
  diagnosisSuccessSchema,
  photoKindSchema,
} from '../index'

const SUCCESS = {
  diagnosed: true,
  status: 'WARNING',
  confidence: 'medium',
  summary: 'Un stress hydrique probable après la canicule.',
  observations: ['Feuilles basses jaunies', 'Terreau sec en surface'],
  probableCauses: [
    {
      label: 'Manque d’eau',
      likelihood: 'likely',
      explanation: 'Trois jours à 34 °C et un dernier arrosage il y a six jours.',
    },
  ],
  recommendations: [
    { action: 'Arrose abondamment ce soir', priority: 'urgent', timeframe: "aujourd'hui" },
    { action: 'Pailler le pied', priority: 'soon', timeframe: 'cette semaine' },
  ],
  followUp: 'Reprends une photo dans 7 jours.',
}

describe('résultat de diagnostic', () => {
  it('accepte un diagnostic complet', () => {
    expect(diagnosisSuccessSchema.safeParse(SUCCESS).success).toBe(true)
  })

  it('accepte un followUp absent (null), pas manquant', () => {
    expect(diagnosisSuccessSchema.safeParse({ ...SUCCESS, followUp: null }).success).toBe(true)

    const { followUp, ...sansFollowUp } = SUCCESS
    void followUp
    expect(diagnosisSuccessSchema.safeParse(sansFollowUp).success).toBe(false)
  })

  it('accepte un diagnostic sans cause identifiée', () => {
    expect(diagnosisSuccessSchema.safeParse({ ...SUCCESS, probableCauses: [] }).success).toBe(true)
  })

  it('refuse un statut de santé hors du domaine', () => {
    expect(diagnosisSuccessSchema.safeParse({ ...SUCCESS, status: 'SICK' }).success).toBe(false)
  })

  it('refuse une priorité de recommandation inventée', () => {
    const result = diagnosisSuccessSchema.safeParse({
      ...SUCCESS,
      recommendations: [{ action: 'Arroser', priority: 'now', timeframe: "aujourd'hui" }],
    })
    expect(result.success).toBe(false)
  })

  it('discrimine succès et échec sur `diagnosed`', () => {
    expect(diagnosisResultSchema.safeParse(SUCCESS).success).toBe(true)
    expect(
      diagnosisResultSchema.safeParse({ diagnosed: false, reason: 'Photo trop floue.' }).success,
    ).toBe(true)
    // Un échec ne porte pas de statut : il n'y a rien à appliquer à la plante.
    expect(diagnosisResultSchema.safeParse({ diagnosed: false, status: 'HEALTHY' }).success).toBe(
      false,
    )
  })
})

describe('requête de diagnostic', () => {
  it('accepte une photo neuve', () => {
    expect(diagnoseRequestSchema.safeParse({ imageBase64: 'data:image/jpeg;base64,QUJD' }).success).toBe(
      true,
    )
  })

  it('accepte la réutilisation de la photo de la fiche', () => {
    expect(diagnoseRequestSchema.safeParse({ useExistingPhoto: true }).success).toBe(true)
  })

  it('refuse les deux à la fois — la source de la photo doit être sans ambiguïté', () => {
    expect(
      diagnoseRequestSchema.safeParse({ imageBase64: 'data:image/jpeg;base64,QUJD', useExistingPhoto: true })
        .success,
    ).toBe(false)
  })

  it('refuse une requête vide', () => {
    expect(diagnoseRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('confirmation de mise à jour du statut', () => {
  it('exige un accord explicite', () => {
    expect(applyDiagnosisSchema.safeParse({ apply: true }).success).toBe(true)
    expect(applyDiagnosisSchema.safeParse({ apply: false }).success).toBe(false)
    expect(applyDiagnosisSchema.safeParse({}).success).toBe(false)
  })
})

describe('historique', () => {
  const ITEM = {
    id: 'diag_1',
    createdAt: '2026-08-24T09:30:00.000Z',
    photoUrl: 'https://exemple.fr/photo.jpg',
    status: 'WARNING',
    confidence: 'medium',
    summary: 'Un stress hydrique probable.',
    statusApplied: false,
  }

  it('accepte une entrée de liste', () => {
    expect(diagnosisListItemSchema.safeParse(ITEM).success).toBe(true)
  })

  it('refuse une date qui n’est pas ISO', () => {
    expect(diagnosisListItemSchema.safeParse({ ...ITEM, createdAt: '24/08/2026' }).success).toBe(
      false,
    )
  })

  it('porte le résultat complet dans le détail', () => {
    expect(
      diagnosisDetailSchema.safeParse({ ...ITEM, plantInstanceId: 'plant_1', result: SUCCESS })
        .success,
    ).toBe(true)
  })
})

describe('kind de photo', () => {
  it('connaît le rangement des photos de diagnostic', () => {
    expect(PHOTO_KINDS).toContain('diagnosis')
    expect(photoKindSchema.safeParse('diagnosis').success).toBe(true)
  })
})
