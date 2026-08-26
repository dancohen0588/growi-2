import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosisRecommendation } from '@growi/shared'

// Les tâches planifiées écrivent dans le planning d'un utilisateur et s'y
// substituent aux actions du moteur : ce qu'elles refusent de créer — un
// doublon, une tâche pour autrui — compte autant que ce qu'elles créent.

const prismaMock = vi.hoisted(() => ({
  diagnosis: { findFirst: vi.fn(), update: vi.fn() },
  plantTask: {
    createMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const {
  completeTask,
  completeTasksForGesture,
  isoDay,
  listOpenTasksAsActions,
  planDiagnosisActions,
  toTaskDraft,
} = await import('../task.service')
const { ServiceError } = await import('../errors')

const USER = 'user_1'
const PLANT = 'plant_1'
const DIAG = 'diag_1'
const NOW = new Date('2026-08-25T09:00:00.000Z')

function reco(overrides: Partial<DiagnosisRecommendation> = {}): DiagnosisRecommendation {
  return {
    action: 'Arrose abondamment ce soir',
    priority: 'urgent',
    timeframe: "aujourd'hui",
    ...overrides,
  }
}

function payload(recommendations: unknown[]) {
  return {
    diagnosed: true,
    status: 'WARNING',
    confidence: 'medium',
    summary: 'Un stress hydrique probable.',
    observations: ['Feuilles jaunies'],
    probableCauses: [],
    recommendations,
    followUp: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.$transaction.mockResolvedValue([])
  prismaMock.plantTask.count.mockResolvedValue(0)
})

describe('recommandation → tâche', () => {
  it('reprend le geste et le délai fournis par le modèle', () => {
    expect(
      toTaskDraft(
        reco({ actionType: 'arrosage', dueInDays: 0, shortAction: 'Arroser au pied' }),
        NOW,
      ),
    ).toEqual({
      type: 'arrosage',
      label: 'Arrose abondamment ce soir',
      shortLabel: 'Arroser au pied',
      dueDate: '2026-08-25',
      priority: 'high',
    })
  })

  it('date depuis la priorité quand le délai manque', () => {
    // Anciens diagnostics : le modèle ne renvoyait pas encore `dueInDays`.
    expect(toTaskDraft(reco({ priority: 'urgent' }), NOW).dueDate).toBe('2026-08-25')
    expect(toTaskDraft(reco({ priority: 'soon' }), NOW).dueDate).toBe('2026-08-27')
    expect(toTaskDraft(reco({ priority: 'watch' }), NOW).dueDate).toBe('2026-09-01')
  })

  it('range en « autre » quand le geste manque', () => {
    expect(toTaskDraft(reco(), NOW).type).toBe('autre')
  })

  it('traduit les trois priorités', () => {
    expect(toTaskDraft(reco({ priority: 'urgent' }), NOW).priority).toBe('high')
    expect(toTaskDraft(reco({ priority: 'soon' }), NOW).priority).toBe('medium')
    expect(toTaskDraft(reco({ priority: 'watch' }), NOW).priority).toBe('low')
  })

  it('abrège le titre quand le modèle n’en fournit pas', () => {
    // Diagnostics d'avant `shortAction` : le titre est coupé sur un mot, sans
    // ponctuation, pour que la carte reste lisible d'un coup d'œil.
    const draft = toTaskDraft(
      reco({ action: 'Retire et détruis immédiatement les parties les plus atteintes.' }),
      NOW,
    )

    expect(draft.shortLabel).toBe('Retire et détruis immédiatement les…')
    expect(draft.shortLabel.length).toBeLessThanOrEqual(41)
    expect(draft.label).toBe('Retire et détruis immédiatement les parties les plus atteintes.')
  })

  it('laisse intact un libellé déjà court', () => {
    expect(toTaskDraft(reco({ action: 'Arrose au pied.' }), NOW).shortLabel).toBe('Arrose au pied')
  })

  it('préfère le titre du modèle à son propre abrégé', () => {
    expect(
      toTaskDraft(reco({ shortAction: 'Arroser au pied' }), NOW).shortLabel,
    ).toBe('Arroser au pied')
  })

  it('franchit un changement de mois sans se tromper', () => {
    expect(isoDay(new Date('2026-08-28T09:00:00.000Z'), 7)).toBe('2026-09-04')
  })
})

describe('planification', () => {
  it('crée une tâche par recommandation et pose le verrou, en une transaction', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({
      id: DIAG,
      tasksPlannedAt: null,
      payload: payload([
        reco({ actionType: 'arrosage', dueInDays: 0 }),
        reco({ action: 'Paille le pied', priority: 'soon', actionType: 'autre', dueInDays: 3 }),
      ]),
    })

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).resolves.toEqual({
      tasksCreated: 2,
      tasksPlannedAt: NOW.toISOString(),
    })

    expect(prismaMock.plantTask.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: USER,
          plantInstanceId: PLANT,
          diagnosisId: DIAG,
          source: 'DIAGNOSIS',
          type: 'arrosage',
          dueDate: '2026-08-25',
          priority: 'high',
        }),
        expect.objectContaining({ label: 'Paille le pied', dueDate: '2026-08-28' }),
      ],
    })
    expect(prismaMock.diagnosis.update).toHaveBeenCalledWith({
      where: { id: DIAG },
      data: { tasksPlannedAt: NOW },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })

  it('est idempotent : un second appel ne recrée rien', async () => {
    const plannedAt = new Date('2026-08-24T10:00:00.000Z')
    prismaMock.diagnosis.findFirst.mockResolvedValue({ id: DIAG, tasksPlannedAt: plannedAt })
    prismaMock.plantTask.count.mockResolvedValue(3)

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).resolves.toEqual({
      tasksCreated: 3,
      tasksPlannedAt: plannedAt.toISOString(),
    })
    expect(prismaMock.plantTask.createMany).not.toHaveBeenCalled()
    expect(prismaMock.diagnosis.update).not.toHaveBeenCalled()
  })

  it('planifie un diagnostic d’avant cette évolution via les replis', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({
      id: DIAG,
      tasksPlannedAt: null,
      payload: payload([reco({ priority: 'watch', timeframe: 'ce mois-ci' })]),
    })

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).resolves.toMatchObject({
      tasksCreated: 1,
    })
    expect(prismaMock.plantTask.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ type: 'autre', dueDate: '2026-09-01', priority: 'low' })],
    })
  })

  it('accepte un diagnostic sans recommandation sans rien créer', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({
      id: DIAG,
      tasksPlannedAt: null,
      payload: payload([]),
    })

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).resolves.toMatchObject({
      tasksCreated: 0,
    })
  })

  it('refuse le diagnostic d’un autre compte', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue(null)

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).rejects.toThrow(
      /Diagnostic introuvable/,
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('cherche le diagnostic sous la plante ET sous l’utilisateur', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({ id: DIAG, tasksPlannedAt: NOW })
    await planDiagnosisActions(USER, PLANT, DIAG, NOW)

    expect(prismaMock.diagnosis.findFirst).toHaveBeenCalledWith({
      where: { id: DIAG, plantInstanceId: PLANT, userId: USER },
    })
  })

  it('refuse de planifier un payload illisible', async () => {
    prismaMock.diagnosis.findFirst.mockResolvedValue({
      id: DIAG,
      tasksPlannedAt: null,
      payload: { diagnosed: true },
    })

    await expect(planDiagnosisActions(USER, PLANT, DIAG, NOW)).rejects.toThrow(ServiceError)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('tâches présentées comme actions du planning', () => {
  const row = {
    id: 'task_1',
    type: 'arrosage',
    label: 'Arrose abondamment ce soir, au pied, sans mouiller le feuillage',
    shortLabel: 'Arroser au pied',
    dueDate: '2026-08-25',
    priority: 'high',
    plantInstance: {
      id: PLANT,
      gardenId: 'garden_1',
      customName: 'Basilic du balcon',
      emoji: '🌿',
      photoUrl: 'https://stockage.test/p.jpg',
      catalogPlant: { commonName: 'Basilic', emoji: '🌱', imageUrl: 'https://cat.test/b.jpg' },
    },
  }

  it('se présente comme une action ordinaire, sa provenance en plus', async () => {
    prismaMock.plantTask.findMany.mockResolvedValue([row])

    await expect(listOpenTasksAsActions(USER, { gardenId: 'garden_1' })).resolves.toEqual([
      {
        id: 'task:task_1',
        type: 'arrosage',
        label: 'Arrose abondamment ce soir, au pied, sans mouiller le feuillage',
        shortLabel: 'Arroser au pied',
        // La consigne complète, que la carte affiche sous son titre.
        detail: 'Arrose abondamment ce soir, au pied, sans mouiller le feuillage',
        plantId: PLANT,
        plantName: 'Basilic du balcon',
        plantEmoji: '🌿',
        plantPhotoUrl: 'https://stockage.test/p.jpg',
        dueDate: '2026-08-25',
        done: false,
        priority: 'high',
        source: 'task',
        taskId: 'task_1',
      },
    ])
  })

  it('préfixe l’identifiant pour ne pas heurter ceux du moteur', async () => {
    prismaMock.plantTask.findMany.mockResolvedValue([row])
    const [action] = await listOpenTasksAsActions(USER)

    expect(action.id).toBe('task:task_1')
    expect(action.id).not.toMatch(/^r\d/)
  })

  it('retombe sur le catalogue quand la plante n’a ni nom ni photo', async () => {
    prismaMock.plantTask.findMany.mockResolvedValue([
      { ...row, plantInstance: { ...row.plantInstance, customName: null, emoji: null, photoUrl: null } },
    ])

    await expect(listOpenTasksAsActions(USER)).resolves.toMatchObject([
      { plantName: 'Basilic', plantEmoji: '🌱', plantPhotoUrl: 'https://cat.test/b.jpg' },
    ])
  })

  it('ne rend que les tâches ouvertes', async () => {
    prismaMock.plantTask.findMany.mockResolvedValue([])
    await listOpenTasksAsActions(USER, { gardenId: 'garden_1' })

    expect(prismaMock.plantTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER, doneAt: null }),
      }),
    )
  })

  it('inclut les plantes sans jardin dans le filtre par jardin', async () => {
    prismaMock.plantTask.findMany.mockResolvedValue([])
    await listOpenTasksAsActions(USER, { gardenId: 'garden_1' })

    // Le moteur rattache lui aussi les orphelines à chaque jardin ; la
    // déduplication de `planning.service` empêche le doublon.
    const { where } = prismaMock.plantTask.findMany.mock.calls[0][0]
    expect(where.plantInstance).toEqual({
      OR: [{ gardenId: 'garden_1' }, { gardenId: null }],
    })
  })
})

describe('acquittement', () => {
  it('pose la date de réalisation', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue({ id: 'task_1', doneAt: null })
    await completeTask(USER, 'task_1', NOW)

    expect(prismaMock.plantTask.update).toHaveBeenCalledWith({
      where: { id: 'task_1' },
      data: { doneAt: NOW },
    })
  })

  it('ne déplace pas la date d’une tâche déjà faite', async () => {
    const doneAt = new Date('2026-08-20T09:00:00.000Z')
    prismaMock.plantTask.findFirst.mockResolvedValue({ id: 'task_1', doneAt })

    await completeTask(USER, 'task_1', NOW)

    expect(prismaMock.plantTask.update).not.toHaveBeenCalled()
  })

  it('refuse la tâche d’un autre compte', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue(null)

    await expect(completeTask(USER, 'task_1', NOW)).rejects.toThrow(/Tâche introuvable/)
    expect(prismaMock.plantTask.update).not.toHaveBeenCalled()
  })
})

describe('un geste accomplit les tâches échues du même type', () => {
  it('clôt les arrosages dus, et eux seuls', async () => {
    prismaMock.plantTask.updateMany.mockResolvedValue({ count: 1 })

    await expect(completeTasksForGesture(USER, PLANT, 'watering', NOW)).resolves.toBe(1)

    expect(prismaMock.plantTask.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER,
        plantInstanceId: PLANT,
        type: 'arrosage',
        doneAt: null,
        // Arroser aujourd'hui n'accomplit pas un arrosage prévu la semaine
        // prochaine : seules les tâches échues sont closes.
        dueDate: { lte: '2026-08-25' },
      },
      data: { doneAt: NOW },
    })
  })

  it('traduit chaque geste vers sa tâche', async () => {
    prismaMock.plantTask.updateMany.mockResolvedValue({ count: 0 })

    for (const [care, action] of [
      ['pruning', 'taille'],
      ['fertilizing', 'fertilisation'],
      ['treatment', 'traitement'],
      ['harvest', 'recolte'],
      ['other', 'autre'],
    ] as const) {
      await completeTasksForGesture(USER, PLANT, care, NOW)
      expect(prismaMock.plantTask.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: action }) }),
      )
    }
  })

  it('ne touche à rien pour un geste sans tâche correspondante', async () => {
    // `health` note un état, il n'accomplit aucune tâche du planning.
    await expect(completeTasksForGesture(USER, PLANT, 'health', NOW)).resolves.toBe(0)
    expect(prismaMock.plantTask.updateMany).not.toHaveBeenCalled()
  })
})
