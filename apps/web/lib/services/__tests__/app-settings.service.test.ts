import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  appSetting: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  $queryRaw: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const {
  acquireGenerationLock,
  getBlogCadence,
  getLastGenerationAt,
  isGenerationDue,
  setBlogCadence,
} = await import('../app-settings.service')

const DAY = 24 * 60 * 60 * 1000
const MONDAY = new Date('2026-09-28T07:00:00Z')
const daysBefore = (days: number) => new Date(MONDAY.getTime() - days * DAY)

beforeEach(() => vi.clearAllMocks())

describe('cadence', () => {
  it('vaut « toutes les deux semaines » tant que personne ne l\'a réglée', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue(null)
    expect(await getBlogCadence()).toBe('biweekly')
  })

  it('retombe sur la valeur par défaut si la base contient une valeur illisible', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({ key: 'blog.cadence', value: 'quotidien' })
    expect(await getBlogCadence()).toBe('biweekly')
  })

  it('refuse d\'enregistrer une cadence inconnue', async () => {
    await expect(setBlogCadence('daily' as never)).rejects.toThrow()
    expect(prismaMock.appSetting.upsert).not.toHaveBeenCalled()
  })

  it('lit une date de dernière génération, ou null', async () => {
    prismaMock.appSetting.findUnique.mockResolvedValueOnce({ value: '2026-09-14T07:00:40.000Z' })
    expect(await getLastGenerationAt()).toEqual(new Date('2026-09-14T07:00:40.000Z'))

    prismaMock.appSetting.findUnique.mockResolvedValueOnce({ value: 42 })
    expect(await getLastGenerationAt()).toBeNull()
  })
})

describe('génération due', () => {
  it('est due si aucune génération n\'a jamais eu lieu', () => {
    expect(isGenerationDue('monthly', null, MONDAY)).toBe(true)
  })

  it.each([
    ['weekly', 7, true],
    ['weekly', 5, false],
    ['biweekly', 14, true],
    ['biweekly', 7, false],
    ['monthly', 28, true],
    ['monthly', 21, false],
  ] as const)('%s, %i jours après : %s', (cadence, days, due) => {
    expect(isGenerationDue(cadence, daysBefore(days), MONDAY)).toBe(due)
  })

  it('ne rate pas le lundi suivant pour quelques secondes de retard', () => {
    // Lundi précédent, génération finie 40 s après le passage du cron.
    const last = new Date(daysBefore(7).getTime() + 40_000)
    expect(isGenerationDue('weekly', last, MONDAY)).toBe(true)
  })
})

describe('verrou', () => {
  it('est pris quand Postgres a écrit la ligne', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ key: 'blog.generation_lock' }])
    expect(await acquireGenerationLock(MONDAY)).toBe(true)
  })

  it('est refusé quand un passage récent le tient', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    expect(await acquireGenerationLock(MONDAY)).toBe(false)
  })

  it('ne l\'écrase qu\'au-delà de cinq minutes, en une seule instruction', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    await acquireGenerationLock(MONDAY)

    const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0]
    expect(strings.join('?')).toMatch(/ON CONFLICT \(key\) DO UPDATE[\s\S]*WHERE[\s\S]*RETURNING key/)
    expect(values).toContain(new Date(MONDAY.getTime() - 5 * 60 * 1000).toISOString())
  })
})
