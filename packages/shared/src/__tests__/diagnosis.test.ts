import { describe, expect, it } from 'vitest'

import {
  PHOTO_KINDS,
  applyDiagnosisSchema,
  markActionDoneSchema,
  gardenActionSchema,
  planDiagnosisResponseSchema,
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
    tasksPlannedAt: null,
  }

  it('accepte une entrée de liste', () => {
    expect(diagnosisListItemSchema.safeParse(ITEM).success).toBe(true)
  })

  it('porte la date de planification quand elle a eu lieu', () => {
    expect(
      diagnosisListItemSchema.safeParse({ ...ITEM, tasksPlannedAt: '2026-08-25T09:00:00.000Z' })
        .success,
    ).toBe(true)
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

describe('recommandation planifiable', () => {
  const BASE = { action: 'Arrose ce soir', priority: 'urgent', timeframe: "aujourd'hui" }

  it('accepte le geste et le délai quand le modèle les fournit', () => {
    const parsed = diagnosisSuccessSchema.safeParse({
      ...SUCCESS,
      recommendations: [{ ...BASE, actionType: 'arrosage', dueInDays: 0 }],
    })
    expect(parsed.success).toBe(true)
  })

  it('reste valide sans eux — les diagnostics déjà en base n’en ont pas', () => {
    // Rétrocompatibilité : un payload écrit avant cette évolution doit
    // continuer à se relire, sinon tout l'historique devient illisible.
    expect(diagnosisSuccessSchema.safeParse(SUCCESS).success).toBe(true)
  })

  it('refuse un geste hors du domaine du planning', () => {
    const parsed = diagnosisSuccessSchema.safeParse({
      ...SUCCESS,
      recommendations: [{ ...BASE, actionType: 'desherbage' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('refuse un délai négatif ou fractionnaire', () => {
    for (const dueInDays of [-1, 2.5]) {
      const parsed = diagnosisSuccessSchema.safeParse({
        ...SUCCESS,
        recommendations: [{ ...BASE, dueInDays }],
      })
      expect(parsed.success).toBe(false)
    }
  })
})

describe('acquittement d’une tâche', () => {
  const BASE = { gardenId: 'g1', actionType: 'arrosage' }

  it('accepte un identifiant de tâche', () => {
    expect(markActionDoneSchema.safeParse({ ...BASE, taskId: 'task_1' }).success).toBe(true)
  })

  it('reste valide sans lui — les actions du moteur n’en ont pas', () => {
    expect(markActionDoneSchema.safeParse(BASE).success).toBe(true)
  })

  it('exige toujours le geste, qui alimente le journal', () => {
    expect(markActionDoneSchema.safeParse({ gardenId: 'g1', taskId: 'task_1' }).success).toBe(false)
  })
})

describe('provenance d’une action du planning', () => {
  const ACTION = {
    id: 'a1', type: 'arrosage', label: 'Arroser le basilic', shortLabel: 'Arroser',
    dueDate: '2026-08-25', done: false, priority: 'high',
  }

  it('accepte une action issue d’une tâche', () => {
    expect(gardenActionSchema.safeParse({ ...ACTION, source: 'task', taskId: 't1' }).success).toBe(
      true,
    )
  })

  it('reste valide sans provenance — le moteur est le cas par défaut', () => {
    expect(gardenActionSchema.safeParse(ACTION).success).toBe(true)
  })

  it('refuse une provenance inventée', () => {
    expect(gardenActionSchema.safeParse({ ...ACTION, source: 'manuel' }).success).toBe(false)
  })
})

describe('réponse de planification', () => {
  it('porte le nombre de tâches créées et la date', () => {
    expect(
      planDiagnosisResponseSchema.safeParse({
        tasksCreated: 3,
        tasksPlannedAt: '2026-08-25T09:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('refuse un compte négatif', () => {
    expect(
      planDiagnosisResponseSchema.safeParse({ tasksCreated: -1, tasksPlannedAt: '2026-08-25T09:00:00.000Z' })
        .success,
    ).toBe(false)
  })
})

describe('kind de photo', () => {
  it('connaît le rangement des photos de diagnostic', () => {
    expect(PHOTO_KINDS).toContain('diagnosis')
    expect(photoKindSchema.safeParse('diagnosis').success).toBe(true)
  })
})
