import { describe, expect, it, vi } from 'vitest'

// Le service importe `next/cache` au chargement ; les helpers testés ici sont
// purs, mais l'import doit aboutir.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { lastWeeks, weekStart } = await import('../admin-stats.service')

/**
 * Seuls les découpages de semaine sont testés ici : ce sont eux qui décident
 * de la forme des courbes, et une erreur d'un jour y décale toute la série.
 * Les requêtes SQL, elles, ne se vérifient qu'en tournant contre Postgres —
 * c'est le rôle du parcours e2e du tableau de bord.
 */

describe('weekStart', () => {
  it('ramène au lundi précédent, en UTC', () => {
    // 2026-09-04 est un vendredi ; son lundi est le 31 août.
    expect(weekStart(new Date('2026-09-04T12:00:00.000Z'))).toBe('2026-08-31')
  })

  it('laisse un lundi à sa place', () => {
    expect(weekStart(new Date('2026-08-31T00:00:00.000Z'))).toBe('2026-08-31')
  })

  it('rattache le dimanche à la semaine qui s’achève, pas à la suivante', () => {
    // Le piège de `getUTCDay()` : dimanche vaut 0, un décalage naïf le
    // renverrait au lundi suivant.
    expect(weekStart(new Date('2026-09-06T23:59:00.000Z'))).toBe('2026-08-31')
    expect(weekStart(new Date('2026-09-07T00:00:00.000Z'))).toBe('2026-09-07')
  })

  it('raisonne en UTC et non dans le fuseau local', () => {
    // 2026-09-07T00:30 UTC est encore dimanche soir à Los Angeles ; c'est la
    // valeur UTC qui fait foi, comme pour `user_activities`.
    expect(weekStart(new Date('2026-09-07T00:30:00.000Z'))).toBe('2026-09-07')
  })
})

describe('lastWeeks', () => {
  it('renvoie le bon nombre de lundis, du plus ancien au plus récent', () => {
    const weeks = lastWeeks(4, new Date('2026-09-04T12:00:00.000Z'))
    expect(weeks).toEqual(['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'])
  })

  it('termine sur la semaine en cours', () => {
    const weeks = lastWeeks(26, new Date('2026-09-04T12:00:00.000Z'))
    expect(weeks).toHaveLength(26)
    expect(weeks.at(-1)).toBe('2026-08-31')
  })

  it('espace les semaines de sept jours exactement, même à cheval sur un mois', () => {
    const weeks = lastWeeks(6, new Date('2026-03-05T12:00:00.000Z'))
    for (let i = 1; i < weeks.length; i++) {
      const gap = Date.parse(weeks[i]) - Date.parse(weeks[i - 1])
      expect(gap).toBe(7 * 86_400_000)
    }
  })

  it('traverse un changement d’heure sans dériver', () => {
    // Le passage à l'heure d'été (fin mars) décale les jours locaux d'une
    // heure ; en UTC, l'écart doit rester de sept jours pleins.
    const weeks = lastWeeks(4, new Date('2026-04-08T12:00:00.000Z'))
    for (let i = 1; i < weeks.length; i++) {
      expect(Date.parse(weeks[i]) - Date.parse(weeks[i - 1])).toBe(7 * 86_400_000)
    }
  })
})
