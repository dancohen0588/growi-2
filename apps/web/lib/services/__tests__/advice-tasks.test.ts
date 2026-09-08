import { beforeEach, describe, expect, it, vi } from 'vitest'

// La fusion des tâches planifiées avec les actions du moteur, sur les trois
// portes d'entrée du service. En rater une, c'est une surface entière — le
// calendrier web, l'Accueil mobile — où les tâches n'apparaîtraient jamais.

const engine = vi.hoisted(() => ({
  getGardenAdvice: vi.fn(),
  getPlantAdvice: vi.fn(),
  invalidateGardenAdviceCache: vi.fn(),
}))
const gardenService = vi.hoisted(() => ({
  assertGardenOwned: vi.fn(),
  listGardens: vi.fn(),
  setPlanningClearedOn: vi.fn(),
}))
const logService = vi.hoisted(() => ({ logCare: vi.fn(), deleteCareLog: vi.fn() }))
const taskService = vi.hoisted(() => ({
  listOpenTasksAsActions: vi.fn(),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
}))
const userService = vi.hoisted(() => ({ getUserTimezone: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  plantInstance: { findFirst: vi.fn() },
  // Une transaction doublée exécute simplement le corps : ce qu'on vérifie
  // ici, ce sont les écritures demandées, pas l'atomicité de Postgres.
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/recommendation/garden-advice-service', () => engine)
vi.mock('@/lib/services/garden.service', () => gardenService)
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/services/task.service', () => taskService)
vi.mock('@/lib/services/user.service', () => userService)

const {
  clearPlanningToday,
  getGardenAdvice,
  getGardensAdvice,
  getPlantAdvice,
  markActionDone,
  markActionsDone,
  undoAction,
} = await import('../advice.service')

const USER = 'user_1'
const GARDEN = 'garden_1'
// 23 h 30 à Paris : en UTC on serait déjà le lendemain, et « ignorer pour
// aujourd'hui » se lèverait au milieu de la soirée.
const LATE_NIGHT = new Date('2026-08-21T21:30:00.000Z')
const TODAY = '2026-08-21'

const engineAction = { id: 'r1-abc', type: 'arrosage', label: 'Arroser', shortLabel: 'Arroser',
  dueDate: '2026-08-25', done: false, priority: 'high' }
const taskAction = { id: 'task:t1', type: 'traitement', label: 'Pulvérise du bicarbonate',
  shortLabel: 'Pulvérise du bicarbonate', dueDate: '2026-08-25', done: false, priority: 'high',
  source: 'task', taskId: 't1' }

function advice(actions: unknown[] = [engineAction]) {
  return { gardenId: GARDEN, actions, adviceByPlant: [], alerts: [], generatedAt: new Date(), expiresAt: new Date() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  engine.getGardenAdvice.mockResolvedValue(advice())
  gardenService.assertGardenOwned.mockResolvedValue({ id: GARDEN, planningClearedOn: null })
  gardenService.listGardens.mockResolvedValue([
    { id: GARDEN, name: 'Potager', planningClearedOn: null },
  ])
  taskService.listOpenTasksAsActions.mockResolvedValue([taskAction])
  userService.getUserTimezone.mockResolvedValue('Europe/Paris')
  prismaMock.plantInstance.findFirst.mockResolvedValue({ garden: { planningClearedOn: null } })
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock))
  logService.logCare.mockResolvedValue({ id: 'log_1' })
})

describe('fusion sur les trois portes d’entrée', () => {
  it('getGardenAdvice ajoute les tâches aux actions du moteur', async () => {
    const result = await getGardenAdvice(GARDEN, USER)

    // Les tâches passent devant : l'utilisateur les a validées lui-même.
    expect(result.actions).toEqual([taskAction, engineAction])
    expect(taskService.listOpenTasksAsActions).toHaveBeenCalledWith(USER, { gardenId: GARDEN })
  })

  it('getGardensAdvice aussi — c’est par là que passent l’Accueil mobile et le calendrier web', async () => {
    const [first] = await getGardensAdvice(USER)

    expect(first.advice?.actions).toEqual([taskAction, engineAction])
  })

  it('getPlantAdvice ajoute les tâches de la plante à ses tâches', async () => {
    engine.getPlantAdvice.mockResolvedValue({ plantInstanceId: 'p1', tasks: [engineAction], alerts: [] })

    const result = await getPlantAdvice('p1', USER)

    expect(result.tasks).toEqual([taskAction, engineAction])
    expect(taskService.listOpenTasksAsActions).toHaveBeenCalledWith(USER, {
      plantInstanceId: 'p1',
    })
  })

  it('laisse les conseils intacts quand il n’y a aucune tâche', async () => {
    taskService.listOpenTasksAsActions.mockResolvedValue([])

    const result = await getGardenAdvice(GARDEN, USER)

    expect(result.actions).toEqual([engineAction])
  })

  it('vérifie toujours l’appartenance du jardin avant de servir quoi que ce soit', async () => {
    gardenService.assertGardenOwned.mockRejectedValue(new Error('Jardin introuvable'))

    await expect(getGardenAdvice(GARDEN, USER)).rejects.toThrow(/Jardin introuvable/)
    expect(taskService.listOpenTasksAsActions).not.toHaveBeenCalled()
  })

  it('une panne du moteur sur un jardin n’en fait pas disparaître les autres', async () => {
    gardenService.listGardens.mockResolvedValue([
      { id: GARDEN, name: 'Potager', planningClearedOn: null },
      { id: 'garden_2', name: 'Balcon', planningClearedOn: null },
    ])
    engine.getGardenAdvice
      .mockRejectedValueOnce(new Error('moteur en panne'))
      .mockResolvedValueOnce(advice())

    const results = await getGardensAdvice(USER)

    expect(results[0].advice).toBeNull()
    expect(results[1].advice?.actions).toEqual([taskAction, engineAction])
  })
})

describe('cocher une action', () => {
  it('acquitte la tâche nommément et note le geste au journal', async () => {
    await markActionDone(USER, {
      gardenId: GARDEN,
      actionType: 'traitement',
      plantId: 'p1',
      taskId: 't1',
    })

    expect(taskService.completeTask).toHaveBeenCalledWith(USER, 't1')
    expect(logService.logCare).toHaveBeenCalledWith('p1', USER, { type: 'treatment' })
    expect(engine.invalidateGardenAdviceCache).toHaveBeenCalledWith(GARDEN)
  })

  it('n’acquitte aucune tâche pour une action du moteur', async () => {
    // Non-régression stricte : le chemin sans `taskId` doit être inchangé.
    await markActionDone(USER, { gardenId: GARDEN, actionType: 'arrosage', plantId: 'p1' })

    expect(taskService.completeTask).not.toHaveBeenCalled()
    expect(logService.logCare).toHaveBeenCalledWith('p1', USER, { type: 'watering' })
  })

  it('refuse avant d’écrire quoi que ce soit si le jardin n’est pas à l’utilisateur', async () => {
    gardenService.assertGardenOwned.mockRejectedValue(new Error('Jardin introuvable'))

    await expect(
      markActionDone(USER, { gardenId: GARDEN, actionType: 'arrosage', taskId: 't1' }),
    ).rejects.toThrow(/Jardin introuvable/)
    expect(taskService.completeTask).not.toHaveBeenCalled()
    expect(logService.logCare).not.toHaveBeenCalled()
  })

  it('laisse remonter le refus d’une tâche qui n’est pas à l’utilisateur', async () => {
    taskService.completeTask.mockRejectedValue(new Error('Tâche introuvable'))

    await expect(
      markActionDone(USER, { gardenId: GARDEN, actionType: 'arrosage', plantId: 'p1', taskId: 't1' }),
    ).rejects.toThrow(/Tâche introuvable/)
    // Le geste ne doit pas être noté pour une tâche qu'on n'a pas le droit de clore.
    expect(logService.logCare).not.toHaveBeenCalled()
  })

  it('rend l’identifiant du geste écrit, de quoi l’annuler', async () => {
    // `clearAllMocks` efface les appels, pas les implémentations : sans cela,
    // le refus posé par le test précédent vaudrait encore ici.
    taskService.completeTask.mockResolvedValue({})

    await expect(
      markActionDone(USER, { gardenId: GARDEN, actionType: 'arrosage', plantId: 'p1' }),
    ).resolves.toEqual({ careLogId: 'log_1' })

    // Une tâche sans plante n'écrit aucun geste : rien à annuler.
    await expect(
      markActionDone(USER, { gardenId: GARDEN, taskId: 't1' }),
    ).resolves.toEqual({ careLogId: null })
  })
})

describe('cocher plusieurs actions d’un coup', () => {
  const items = [
    { actionType: 'arrosage' as const, plantId: 'p1' },
    { actionType: 'arrosage' as const, plantId: 'p2' },
  ]

  it('note chaque geste et n’invalide le cache qu’une fois', async () => {
    logService.logCare
      .mockResolvedValueOnce({ id: 'log_1' })
      .mockResolvedValueOnce({ id: 'log_2' })

    await expect(markActionsDone(USER, { gardenId: GARDEN, items })).resolves.toEqual({
      done: 2,
      skipped: 0,
      careLogIds: ['log_1', 'log_2'],
    })

    expect(logService.logCare).toHaveBeenCalledTimes(2)
    expect(engine.invalidateGardenAdviceCache).toHaveBeenCalledTimes(1)
  })

  it('poursuit la tournée quand une plante a disparu', async () => {
    logService.logCare
      .mockRejectedValueOnce(new Error('Plante introuvable'))
      .mockResolvedValueOnce({ id: 'log_2' })

    // L'utilisateur a bien arrosé la seconde : la lui reprendre parce que la
    // première n'existe plus serait pire que de compter l'échec.
    await expect(markActionsDone(USER, { gardenId: GARDEN, items })).resolves.toEqual({
      done: 1,
      skipped: 1,
      careLogIds: ['log_2'],
    })
  })

  it('vérifie l’appartenance du jardin une seule fois, avant tout', async () => {
    gardenService.assertGardenOwned.mockRejectedValue(new Error('Jardin introuvable'))

    await expect(markActionsDone(USER, { gardenId: GARDEN, items })).rejects.toThrow(
      /Jardin introuvable/,
    )
    expect(logService.logCare).not.toHaveBeenCalled()
  })
})

describe('ignorer pour aujourd’hui', () => {
  it('inscrit le jour de l’utilisateur, pas celui du serveur', async () => {
    await clearPlanningToday(USER, { gardenId: GARDEN }, LATE_NIGHT)

    expect(gardenService.setPlanningClearedOn).toHaveBeenCalledWith(GARDEN, USER, TODAY)
  })

  it('« Rétablir » efface la date', async () => {
    await clearPlanningToday(USER, { gardenId: GARDEN, undo: true }, LATE_NIGHT)

    expect(gardenService.setPlanningClearedOn).toHaveBeenCalledWith(GARDEN, USER, null)
  })

  it('masque les actions du moteur du jour, jamais les tâches acceptées', async () => {
    gardenService.assertGardenOwned.mockResolvedValue({ id: GARDEN, planningClearedOn: TODAY })
    const laterAction = { ...engineAction, id: 'r1-plus-tard', dueDate: '2026-09-30' }
    const windowAction = {
      ...engineAction,
      id: 'r4-taille',
      kind: 'window',
      window: { start: '2026-08-01', end: '2026-09-30' },
      dueDate: '2026-09-30',
    }
    engine.getGardenAdvice.mockResolvedValue(
      advice([{ ...engineAction, dueDate: TODAY }, laterAction, windowAction]),
    )

    const result = await getGardenAdvice(GARDEN, USER, LATE_NIGHT)

    // La tâche de diagnostic reste : l'utilisateur l'a acceptée une à une.
    // « Plus tard » aussi : il n'a pas demandé à l'écarter.
    expect(result.actions.map((a) => a.id)).toEqual(['task:t1', 'r1-plus-tard'])
  })

  it('ne masque plus rien le lendemain', async () => {
    gardenService.assertGardenOwned.mockResolvedValue({
      id: GARDEN,
      planningClearedOn: '2026-08-20',
    })

    const result = await getGardenAdvice(GARDEN, USER, LATE_NIGHT)

    expect(result.actions).toEqual([taskAction, engineAction])
  })

  it('la fiche plante respecte le masquage de son jardin', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue({
      garden: { planningClearedOn: TODAY },
    })
    engine.getPlantAdvice.mockResolvedValue({
      plantInstanceId: 'p1',
      tasks: [{ ...engineAction, dueDate: TODAY }],
      alerts: [],
    })

    const result = await getPlantAdvice('p1', USER, LATE_NIGHT)

    expect(result.tasks).toEqual([taskAction])
  })
})

describe('annuler un geste', () => {
  it('efface le geste, rouvre la tâche et rafraîchit les conseils', async () => {
    await undoAction(USER, { gardenId: GARDEN, careLogId: 'log_1', taskId: 't1' })

    expect(logService.deleteCareLog).toHaveBeenCalledWith('log_1', USER)
    expect(taskService.reopenTask).toHaveBeenCalledWith(USER, 't1')
    expect(engine.invalidateGardenAdviceCache).toHaveBeenCalledWith(GARDEN)
  })

  it('n’efface rien si le jardin n’est pas à l’utilisateur', async () => {
    gardenService.assertGardenOwned.mockRejectedValue(new Error('Jardin introuvable'))

    await expect(
      undoAction(USER, { gardenId: GARDEN, careLogId: 'log_1' }),
    ).rejects.toThrow(/Jardin introuvable/)
    expect(logService.deleteCareLog).not.toHaveBeenCalled()
  })
})
