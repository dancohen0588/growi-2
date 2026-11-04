import { describe, expect, it } from 'vitest'

import { dashboardSummarySchema, pickDailyIndex } from '../schemas/summary'

describe('pickDailyIndex', () => {
  it('renvoie -1 quand il n’y a rien à tirer', () => {
    expect(pickDailyIndex('u1:2026-11-03', 0)).toBe(-1)
  })

  it('reste dans les bornes', () => {
    for (let day = 1; day <= 28; day++) {
      const index = pickDailyIndex(`u1:2026-02-${String(day).padStart(2, '0')}`, 7)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(7)
    }
  })

  it('est stable pour une même graine — la photo ne change pas au rafraîchissement', () => {
    expect(pickDailyIndex('u1:2026-11-03', 9)).toBe(pickDailyIndex('u1:2026-11-03', 9))
  })

  it('varie d’un jour à l’autre sur un mois', () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) =>
        pickDailyIndex(`u1:2026-11-${String(i + 1).padStart(2, '0')}`, 9),
      ),
    )
    // Pas une garantie jour par jour, mais un tirage figé se verrait ici.
    expect(picks.size).toBeGreaterThan(4)
  })
})

describe('dashboardSummarySchema.heroPhoto', () => {
  const base = {
    gardens: 1,
    plants: 2,
    plantsToWater: 0,
    tasksToday: 0,
    tasksLate: 0,
    tasksWeek: 0,
    alerts: 0,
    alertsHigh: 0,
    plantsWarning: 0,
    plantsCritical: 0,
  }

  it('accepte un serveur antérieur qui ne l’envoie pas', () => {
    expect(dashboardSummarySchema.parse(base).heroPhoto).toBeUndefined()
  })

  it('accepte null et une photo complète', () => {
    expect(dashboardSummarySchema.parse({ ...base, heroPhoto: null }).heroPhoto).toBeNull()
    const photo = {
      plantId: 'p1',
      plantName: 'Clématite',
      gardenName: 'Potager',
      photoUrl: 'https://example.supabase.co/storage/v1/object/public/plant-photos/x.jpg',
    }
    expect(dashboardSummarySchema.parse({ ...base, heroPhoto: photo }).heroPhoto).toEqual(photo)
  })
})
