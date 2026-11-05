import { describe, expect, it } from 'vitest'

import {
  isoWeekBounds,
  isoWeekKey,
  matchesContext,
  matchesPlant,
  normalizeFamily,
  selectWeeklySecret,
  type SecretCandidate,
  type SecretPlant,
  type SelectInput,
} from '../select'

function plant(id: string, overrides: Partial<SecretPlant['catalog']> = {}, extra: Partial<SecretPlant> = {}): SecretPlant {
  return {
    id,
    location: 'OUTDOOR',
    healthStatus: 'HEALTHY',
    catalog: {
      category: 'FLOWERS',
      family: 'Rosaceae',
      scientificName: 'Rosa gallica',
      edible: false,
      toxic: false,
      ...overrides,
    },
    ...extra,
  }
}

function tip(slug: string, conditions: SecretCandidate['conditions'] = {}, evidence: SecretCandidate['evidence'] = 'FOLK'): SecretCandidate {
  return { slug, evidence, cooldownDays: 120, conditions }
}

function input(overrides: Partial<SelectInput> = {}): SelectInput {
  return {
    gardenId: 'garden_1',
    today: '2026-11-05',
    tips: [tip('a'), tip('b'), tip('c')],
    plants: [plant('p1'), plant('p2')],
    weather: null,
    lunarEnabled: false,
    dismissed: new Set(),
    revealed: new Set(),
    lastTriedAt: new Map(),
    ...overrides,
  }
}

describe('semaines ISO', () => {
  it('commence la semaine le lundi', () => {
    expect(isoWeekBounds('2026-11-05')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(isoWeekBounds('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(isoWeekBounds('2026-11-09').start).toBe('2026-11-09')
  })

  it('rattache les premiers jours de janvier à la bonne année', () => {
    expect(isoWeekKey('2026-11-05')).toBe('2026-W45')
    // Le 1er janvier 2027 est un vendredi : il appartient à la dernière semaine de 2026.
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01')
  })
})

describe('conditions', () => {
  it('confond familles latines et françaises', () => {
    expect(normalizeFamily('Solanacées')).toBe(normalizeFamily('Solanaceae'))
    expect(matchesPlant({ families: ['Solanaceae'] }, plant('p', { family: 'Solanacées' }))).toBe(true)
  })

  it('accepte une famille OU un genre', () => {
    const conditions = { families: ['Cucurbitaceae'], genera: ['Rosa'] }
    expect(matchesPlant(conditions, plant('rose'))).toBe(true)
    expect(matchesPlant(conditions, plant('courge', { family: 'Cucurbitacées', scientificName: 'Cucurbita pepo' }))).toBe(true)
    expect(matchesPlant(conditions, plant('tomate', { family: 'Solanaceae', scientificName: 'Solanum lycopersicum' }))).toBe(false)
  })

  it('écarte les plantes de terre de bruyère des cendres', () => {
    const conditions = { excludeFamilies: ['Ericaceae'], excludeGenera: ['Hydrangea'] }
    expect(matchesPlant(conditions, plant('arbousier', { family: 'Ericaceae', scientificName: 'Arbutus unedo' }))).toBe(false)
    expect(matchesPlant(conditions, plant('hortensia', { family: 'Hydrangeaceae', scientificName: 'Hydrangea macrophylla' }))).toBe(false)
    expect(matchesPlant(conditions, plant('rose'))).toBe(true)
  })

  it('ne destine un secret botanique qu’à une plante du catalogue', () => {
    const libre: SecretPlant = { id: 'x', location: 'INDOOR', healthStatus: 'HEALTHY', catalog: null }
    expect(matchesPlant({ genera: ['Rosa'] }, libre)).toBe(false)
    expect(matchesPlant({ locations: ['INDOOR'] }, libre)).toBe(true)
  })

  it('exige la météo pour un secret « du moment »', () => {
    const conditions = { weather: { tempMaxAbove: 22 } }
    expect(matchesContext(conditions, { month: 7, weather: null, lunarEnabled: false })).toBe(false)
    expect(matchesContext(conditions, { month: 7, weather: { tempMax: 25, tempMin: 14 }, lunarEnabled: false })).toBe(true)
    expect(matchesContext(conditions, { month: 7, weather: { tempMax: 19, tempMin: 10 }, lunarEnabled: false })).toBe(false)
  })

  it('ne propose le secret lunaire qu’avec l’option', () => {
    expect(matchesContext({ lunarOnly: true }, { month: 5, weather: null, lunarEnabled: false })).toBe(false)
    expect(matchesContext({ lunarOnly: true }, { month: 5, weather: null, lunarEnabled: true })).toBe(true)
  })
})

describe('selectWeeklySecret', () => {
  it('est stable pour une même semaine et un même jardin', () => {
    const monday = selectWeeklySecret(input({ today: '2026-11-02' }))
    const sunday = selectWeeklySecret(input({ today: '2026-11-08' }))
    expect(monday).not.toBeNull()
    expect(sunday).toEqual(monday)
  })

  it('varie d’une semaine et d’un jardin à l’autre', () => {
    const picks = new Set<string>()
    for (let week = 0; week < 12; week++) {
      const day = new Date(Date.UTC(2026, 0, 5 + week * 7)).toISOString().slice(0, 10)
      for (const gardenId of ['g1', 'g2', 'g3']) picks.add(selectWeeklySecret(input({ today: day, gardenId }))!.slug)
    }
    expect(picks.size).toBe(3)
  })

  it('ne repropose jamais un secret refusé', () => {
    for (let i = 0; i < 20; i++) {
      const pick = selectWeeklySecret(input({ gardenId: `g${i}`, dismissed: new Set(['a', 'b']) }))
      expect(pick?.slug).toBe('c')
    }
  })

  it('respecte le délai avant de reproposer un secret essayé', () => {
    const recently = new Map([['a', new Date('2026-10-01')], ['b', new Date('2026-10-01')]])
    expect(selectWeeklySecret(input({ lastTriedAt: recently }))?.slug).toBe('c')

    const longAgo = new Map([['a', new Date('2025-01-01')], ['b', new Date('2025-01-01')], ['c', new Date('2025-01-01')]])
    expect(selectWeeklySecret(input({ lastTriedAt: longAgo }))).not.toBeNull()
  })

  it('ne choisit qu’une plante à laquelle le secret s’adresse', () => {
    const tomate = plant('tomate', { family: 'Solanaceae', scientificName: 'Solanum lycopersicum', category: 'VEGETABLE' })
    const pick = selectWeeklySecret(input({ tips: [tip('oeillets', { genera: ['Solanum'] })], plants: [plant('rose'), tomate] }))
    expect(pick).toEqual({ slug: 'oeillets', plantId: 'tomate' })
  })

  it('ne rend rien quand aucun secret ne convient', () => {
    expect(selectWeeklySecret(input({ tips: [tip('ete', { months: [7] })] }))).toBeNull()
    expect(selectWeeklySecret(input({ plants: [] }))).toBeNull()
  })

  it('ne repropose pas le secret de la semaine précédente, sauf s’il est le seul', () => {
    for (let i = 0; i < 40; i++) {
      const pick = selectWeeklySecret(input({ gardenId: `g${i}`, previous: { slug: 'a', evidence: 'FOLK' } }))
      expect(pick?.slug).not.toBe('a')
    }
    expect(selectWeeklySecret(input({ tips: [tip('a')], previous: { slug: 'a', evidence: 'FOLK' } }))?.slug).toBe('a')
  })
})
