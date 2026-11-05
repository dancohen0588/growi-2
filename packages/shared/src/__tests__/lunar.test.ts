import { describe, expect, it } from 'vitest'

import { computeLunarDay } from '../schemas/lunar'

// Repères publiés (IMCCE) : nouvelle lune le 9/11/2026, pleine lune le 24/11/2026,
// premier quartier le 17/11/2026, dernier quartier le 1/12/2026.
const at = (iso: string) => computeLunarDay(new Date(`${iso}T12:00:00Z`), iso)

describe('computeLunarDay', () => {
  it('retrouve les phases publiées', () => {
    expect(at('2026-11-09').phase).toBe('nouvelle')
    expect(at('2026-11-24').phase).toBe('pleine')
    expect(at('2026-11-17').phase).toBe('premier-quartier')
    expect(at('2026-12-01').phase).toBe('dernier-quartier')
  })

  it('donne une fraction éclairée cohérente avec la phase', () => {
    expect(at('2026-11-09').illumination).toBeLessThan(0.05)
    expect(at('2026-11-24').illumination).toBeGreaterThan(0.95)
  })

  it('parcourt les quatre types de jour en une dizaine de jours', () => {
    const types = new Set<string>()
    for (let day = 1; day <= 10; day++) {
      types.add(at(`2026-11-${String(day).padStart(2, '0')}`).dayType)
    }
    expect(types.size).toBe(4)
  })

  it('alterne lune montante et descendante sur un mois', () => {
    const courses = Array.from({ length: 28 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 10, 1 + i, 12))
      return computeLunarDay(date, date.toISOString().slice(0, 10)).ascending
    })
    expect(courses).toContain(true)
    expect(courses).toContain(false)
  })
})
