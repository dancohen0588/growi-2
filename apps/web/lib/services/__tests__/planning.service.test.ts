import { beforeEach, describe, expect, it, vi } from 'vitest'

// L'écran d'accueil du mobile ne doit proposer que ce qui reste à faire :
// tous les jardins, sans doublon, et sans les gestes déjà notés aujourd'hui.

const adviceService = vi.hoisted(() => ({ getGardensAdvice: vi.fn() }))
const logService = vi.hoisted(() => ({ findCareTypesByPlantSince: vi.fn() }))
const userService = vi.hoisted(() => ({ getUserLocation: vi.fn() }))
const weatherService = vi.hoisted(() => ({ getWeatherForecast: vi.fn() }))

vi.mock('@/lib/services/advice.service', () => adviceService)
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/services/user.service', () => userService)
vi.mock('@/lib/services/weather.service', () => weatherService)

const { getTodayPlanning } = await import('../planning.service')

const USER_ID = 'user_1'
const NOW = new Date('2026-08-21T09:00:00')
const TODAY = '2026-08-21'

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1-watering-standard:plant_1',
    type: 'arrosage',
    label: 'Arrose le basilic',
    shortLabel: 'Arroser',
    plantId: 'plant_1',
    dueDate: TODAY,
    done: false,
    priority: 'high',
    ...overrides,
  }
}

function garden(id: string, name: string, actions: unknown[], alerts: unknown[] = []) {
  return { garden: { id, name }, advice: { actions, alerts } }
}

beforeEach(() => {
  vi.clearAllMocks()
  logService.findCareTypesByPlantSince.mockResolvedValue(new Map())
  userService.getUserLocation.mockResolvedValue(null)
})

describe('getTodayPlanning', () => {
  it('rend les jardins avec leurs tâches du jour', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [action()]),
      garden('g2', 'Balcon', [action({ id: 'r9-fertilizing:plant_2', plantId: 'plant_2' })]),
    ])

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.date).toBe(TODAY)
    expect(planning.gardens.map((g) => g.name)).toEqual(['Potager', 'Balcon'])
    expect(planning.gardens[0]!.actions).toHaveLength(1)
    expect(planning.gardens[1]!.actions).toHaveLength(1)
  })

  it('écarte les tâches à venir et celles déjà faites par le moteur', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [
        action(),
        action({ id: 'demain', dueDate: '2026-08-22' }),
        action({ id: 'faite', done: true }),
      ]),
    ])

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.gardens[0]!.actions.map((a) => a.id)).toEqual([
      'r1-watering-standard:plant_1',
    ])
  })

  it('garde une tâche en retard', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [action({ dueDate: '2026-08-18' })]),
    ])

    expect((await getTodayPlanning(USER_ID, NOW)).gardens[0]!.actions).toHaveLength(1)
  })

  it('retire une tâche dont le geste est déjà au journal aujourd\'hui', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [action(), action({ id: 'taille', type: 'taille' })]),
    ])
    logService.findCareTypesByPlantSince.mockResolvedValue(
      new Map([['plant_1', new Set(['watering'])]]),
    )

    const planning = await getTodayPlanning(USER_ID, NOW)

    // L'arrosage a été noté ; la taille reste à faire sur la même plante.
    expect(planning.gardens[0]!.actions.map((a) => a.id)).toEqual(['taille'])
  })

  it('retient une récolte notée, que les dates de la plante ne trahissent pas', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [action({ id: 'recolte', type: 'recolte' })]),
    ])
    logService.findCareTypesByPlantSince.mockResolvedValue(
      new Map([['plant_1', new Set(['harvest'])]]),
    )

    expect((await getTodayPlanning(USER_ID, NOW)).gardens[0]!.actions).toHaveLength(0)
  })

  it('ne montre qu\'une fois la tâche d\'une plante sans jardin', async () => {
    // Le moteur rattache les plantes orphelines à chaque jardin : sans dédoublonnage
    // la même tâche apparaîtrait autant de fois qu'il y a de jardins.
    adviceService.getGardensAdvice.mockResolvedValue([
      garden('g1', 'Potager', [action()]),
      garden('g2', 'Balcon', [action()]),
    ])

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.gardens[0]!.actions).toHaveLength(1)
    expect(planning.gardens[1]!.actions).toHaveLength(0)
  })

  it('reste affichable quand le moteur a échoué sur un jardin', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([
      { garden: { id: 'g1', name: 'Potager' }, advice: null },
    ])

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.gardens[0]).toMatchObject({ name: 'Potager', actions: [], alerts: [] })
  })

  it('joint la météo du jour quand l\'utilisateur a des coordonnées', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([])
    userService.getUserLocation.mockResolvedValue({ latitude: 48.85, longitude: 2.35 })
    weatherService.getWeatherForecast.mockResolvedValue({
      locationName: 'Paris',
      current: { temperature: 24 },
      forecast: [{ date: '2026-08-20' }, { date: TODAY, tempMax: 28 }],
    })

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.weather).toMatchObject({ locationName: 'Paris', today: { tempMax: 28 } })
  })

  it('affiche le planning même si la météo est indisponible', async () => {
    adviceService.getGardensAdvice.mockResolvedValue([garden('g1', 'Potager', [action()])])
    userService.getUserLocation.mockResolvedValue({ latitude: 48.85, longitude: 2.35 })
    weatherService.getWeatherForecast.mockRejectedValue(new Error('Open-Meteo muet'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const planning = await getTodayPlanning(USER_ID, NOW)

    expect(planning.weather).toBeNull()
    expect(planning.gardens[0]!.actions).toHaveLength(1)
    consoleError.mockRestore()
  })
})
