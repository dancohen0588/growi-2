import { beforeEach, describe, expect, it, vi } from 'vitest'

// La fusion des tâches planifiées avec les actions du moteur, sur les quatre
// portes d'entrée du service. En rater une, c'est une surface entière — le
// calendrier web, l'Accueil mobile — où les tâches n'apparaîtraient jamais.

const engine = vi.hoisted(() => ({
  getGardenAdvice: vi.fn(),
  getPlantAdvice: vi.fn(),
  invalidateGardenAdviceCache: vi.fn(),
}))
const gardenService = vi.hoisted(() => ({
  assertGardenOwned: vi.fn(),
  findLatestGarden: vi.fn(),
  listGardens: vi.fn(),
}))
const logService = vi.hoisted(() => ({ logCare: vi.fn() }))
const taskService = vi.hoisted(() => ({
  listOpenTasksAsActions: vi.fn(),
  completeTask: vi.fn(),
}))

vi.mock('@/lib/recommendation/garden-advice-service', () => engine)
vi.mock('@/lib/services/garden.service', () => gardenService)
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/services/task.service', () => taskService)

const {
  getCurrentGardenAdvice,
  getGardenAdvice,
  getGardensAdvice,
  getPlantAdvice,
  markActionDone,
} = await import('../advice.service')

const USER = 'user_1'
const GARDEN = 'garden_1'

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
  gardenService.assertGardenOwned.mockResolvedValue(undefined)
  gardenService.findLatestGarden.mockResolvedValue({ id: GARDEN, name: 'Potager' })
  gardenService.listGardens.mockResolvedValue([{ id: GARDEN, name: 'Potager' }])
  taskService.listOpenTasksAsActions.mockResolvedValue([taskAction])
})

describe('fusion sur les quatre portes d’entrée', () => {
  it('getGardenAdvice ajoute les tâches aux actions du moteur', async () => {
    const result = await getGardenAdvice(GARDEN, USER)

    // Les tâches passent devant : l'utilisateur les a validées lui-même.
    expect(result.actions).toEqual([taskAction, engineAction])
    expect(taskService.listOpenTasksAsActions).toHaveBeenCalledWith(USER, { gardenId: GARDEN })
  })

  it('getCurrentGardenAdvice aussi — c’est par là que passe le calendrier web', async () => {
    const result = await getCurrentGardenAdvice(USER)

    expect(result?.advice?.actions).toEqual([taskAction, engineAction])
  })

  it('getGardensAdvice aussi — c’est par là que passe l’Accueil mobile', async () => {
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
      { id: GARDEN, name: 'Potager' },
      { id: 'garden_2', name: 'Balcon' },
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
})
