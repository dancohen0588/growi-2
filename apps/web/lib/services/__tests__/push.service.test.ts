import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ALERT_CONFIG, type AlertConfig } from '@growi/shared'

// La tournée du matin écrit à de vraies personnes : ce qu'elle décide de ne
// pas envoyer compte autant que ce qu'elle envoie.

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  pushToken: { upsert: vi.fn(), deleteMany: vi.fn() },
}))
const planningService = vi.hoisted(() => ({ getTodayPlanning: vi.fn() }))
const expoPush = vi.hoisted(() => ({ sendPushMessages: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/planning.service', () => planningService)
vi.mock('@/lib/push/expo-push', () => expoPush)

const {
  composeReminder,
  registerPushToken,
  sendDailyReminders,
  unregisterPushToken,
  wantsPushNow,
} = await import('../push.service')

const NOW = new Date('2026-08-22T06:00:00Z')

function config(overrides: Partial<AlertConfig> = {}): AlertConfig {
  return { ...DEFAULT_ALERT_CONFIG, ...overrides }
}

function planning(actions: unknown[], alerts: unknown[] = []) {
  return { date: '2026-08-22', gardens: [{ id: 'g1', name: 'Potager', actions, alerts }] }
}

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    type: 'arrosage',
    shortLabel: 'Arroser',
    plantName: 'Basilic',
    dueDate: '2026-08-22',
    done: false,
    priority: 'high',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  expoPush.sendPushMessages.mockResolvedValue({ sent: 0, invalidTokens: [], failed: 0 })
  prismaMock.pushToken.deleteMany.mockResolvedValue({ count: 0 })
})

describe('wantsPushNow', () => {
  it('respecte le canal choisi', () => {
    expect(wantsPushNow(config({ channel: 'push' }), 9 * 60)).toBe(true)
    expect(wantsPushNow(config({ channel: 'both' }), 9 * 60)).toBe(true)
    expect(wantsPushNow(config({ channel: 'email' }), 9 * 60)).toBe(false)
    expect(wantsPushNow(config({ channel: 'none' }), 9 * 60)).toBe(false)
  })

  it('se tait pendant les heures calmes, minuit compris', () => {
    const quiet = config({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' })

    expect(wantsPushNow(quiet, 23 * 60)).toBe(false) // avant minuit
    expect(wantsPushNow(quiet, 2 * 60)).toBe(false) // après minuit
    expect(wantsPushNow(quiet, 6 * 60 + 59)).toBe(false) // juste avant la fin
    expect(wantsPushNow(quiet, 7 * 60)).toBe(true) // pile à la fin
    expect(wantsPushNow(quiet, 9 * 60)).toBe(true)
  })

  it('gère une plage calme qui ne franchit pas minuit', () => {
    const nap = config({ quietHoursEnabled: true, quietHoursStart: '13:00', quietHoursEnd: '15:00' })

    expect(wantsPushNow(nap, 14 * 60)).toBe(false)
    expect(wantsPushNow(nap, 12 * 60)).toBe(true)
  })

  it('se tait quand tous les rappels sont désactivés', () => {
    const silent = config({
      wateringReminder: false,
      pruningReminder: false,
      repottingReminder: false,
      seedingAlerts: false,
      harvestAlerts: false,
      frostAlert: false,
      heatAlert: false,
    })

    expect(wantsPushNow(silent, 9 * 60)).toBe(false)
  })
})

describe('composeReminder', () => {
  it('accorde le titre au nombre de gestes', () => {
    expect(composeReminder(1, ['Arroser Basilic'], 0).title).toContain('Un geste')
    expect(composeReminder(4, ['Arroser Basilic'], 0).title).toContain('4 gestes')
  })

  it('cite trois gestes au plus, puis compte le reste', () => {
    const { body } = composeReminder(5, ['A', 'B', 'C', 'D', 'E'], 0)
    expect(body).toBe('A, B, C et 2 de plus.')
  })

  it('mentionne les alertes météo quand il y en a', () => {
    expect(composeReminder(1, ['Arroser Basilic'], 2).body).toContain('2 alerte')
    expect(composeReminder(1, ['Arroser Basilic'], 0).body).not.toContain('alerte')
  })
})

describe('sendDailyReminders', () => {
  const userWithToken = {
    id: 'u1',
    timezone: 'Europe/Paris',
    alertConfig: null,
    pushTokens: [{ token: 'ExponentPushToken[abc]' }],
  }

  it('envoie un message par appareil du compte', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { ...userWithToken, pushTokens: [{ token: 'tok-1' }, { token: 'tok-2' }] },
    ])
    planningService.getTodayPlanning.mockResolvedValue(planning([action(), action({ id: 'a2' })]))
    expoPush.sendPushMessages.mockResolvedValue({ sent: 2, invalidTokens: [], failed: 0 })

    const result = await sendDailyReminders(NOW)

    const [messages] = expoPush.sendPushMessages.mock.calls[0]
    expect(messages.map((m: { to: string }) => m.to)).toEqual(['tok-1', 'tok-2'])
    expect(messages[0].badge).toBe(2)
    expect(result).toMatchObject({ considered: 1, notified: 1, sent: 2 })
  })

  it('sépare le geste de la plante, et s\'en passe quand il n\'y en a pas', async () => {
    prismaMock.user.findMany.mockResolvedValue([userWithToken])
    planningService.getTodayPlanning.mockResolvedValue(
      planning([
        action({ plantName: 'Basilic ' }),
        action({ id: 'a2', shortLabel: 'Pailler le massif', plantName: null }),
      ]),
    )
    expoPush.sendPushMessages.mockResolvedValue({ sent: 1, invalidTokens: [], failed: 0 })

    await sendDailyReminders(NOW)

    const [messages] = expoPush.sendPushMessages.mock.calls[0]
    expect(messages[0].body).toBe('Arroser — Basilic, Pailler le massif.')
  })

  it('ne dérange personne quand il n\'y a rien à faire', async () => {
    prismaMock.user.findMany.mockResolvedValue([userWithToken])
    planningService.getTodayPlanning.mockResolvedValue(planning([]))

    const result = await sendDailyReminders(NOW)

    expect(expoPush.sendPushMessages).toHaveBeenCalledWith([], expect.anything())
    expect(result.notified).toBe(0)
  })

  it('ignore les tâches qui ne sont pas encore dues', async () => {
    prismaMock.user.findMany.mockResolvedValue([userWithToken])
    planningService.getTodayPlanning.mockResolvedValue(
      planning([action({ dueDate: '2026-08-25' })]),
    )

    await sendDailyReminders(NOW)

    expect(expoPush.sendPushMessages).toHaveBeenCalledWith([], expect.anything())
  })

  it('saute un compte qui a coupé le push', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { ...userWithToken, alertConfig: { ...DEFAULT_ALERT_CONFIG, channel: 'none' } },
    ])

    const result = await sendDailyReminders(NOW)

    expect(planningService.getTodayPlanning).not.toHaveBeenCalled()
    expect(result.notified).toBe(0)
  })

  it('poursuit la tournée quand le planning d\'un compte échoue', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.user.findMany.mockResolvedValue([
      { ...userWithToken, id: 'u1' },
      { ...userWithToken, id: 'u2', pushTokens: [{ token: 'tok-2' }] },
    ])
    planningService.getTodayPlanning
      .mockRejectedValueOnce(new Error('moteur en panne'))
      .mockResolvedValueOnce(planning([action()]))
    expoPush.sendPushMessages.mockResolvedValue({ sent: 1, invalidTokens: [], failed: 0 })

    const result = await sendDailyReminders(NOW)

    expect(result.notified).toBe(1)
    expect(result.sent).toBe(1)
    consoleError.mockRestore()
  })

  it('supprime les jetons qu\'Expo déclare morts', async () => {
    prismaMock.user.findMany.mockResolvedValue([userWithToken])
    planningService.getTodayPlanning.mockResolvedValue(planning([action()]))
    expoPush.sendPushMessages.mockResolvedValue({
      sent: 0,
      invalidTokens: ['tok-mort'],
      failed: 1,
    })

    const result = await sendDailyReminders(NOW)

    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['tok-mort'] } },
    })
    expect(result.invalidTokensRemoved).toBe(1)
  })
})

describe('enregistrement des appareils', () => {
  it('rattache un jeton déjà connu au compte courant', async () => {
    await registerPushToken('u2', { token: 'tok', platform: 'ios' })

    // Un téléphone qui change de main ne doit pas continuer à recevoir les
    // rappels de son ancien propriétaire.
    expect(prismaMock.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'tok' },
      create: { userId: 'u2', token: 'tok', platform: 'ios' },
      update: { userId: 'u2', platform: 'ios' },
    })
  })

  it('ne supprime que le jeton du compte qui le demande', async () => {
    await unregisterPushToken('u1', 'tok')

    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'tok', userId: 'u1' },
    })
  })
})
