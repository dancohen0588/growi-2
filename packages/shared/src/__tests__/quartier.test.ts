import { describe, expect, it } from 'vitest'

import {
  QUARTIER_CHALLENGES,
  QUARTIER_PARTICIPATION_SAP,
  QUARTIER_SUCCESS_SAP,
  pickQuartierChallenge,
  quartierChallenge,
  quartierTarget,
  quartierTitle,
  quartierUnit,
} from '../constants/quartier'
import { SAP_RULES } from '../constants/sap'

describe('bibliothèque des défis', () => {
  it('des slugs uniques', () => {
    const slugs = QUARTIER_CHALLENGES.map((challenge) => challenge.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('au moins deux défis par mois, pour ne jamais rejouer la semaine précédente', () => {
    for (let month = 1; month <= 12; month++) {
      const count = QUARTIER_CHALLENGES.filter((challenge) => challenge.months.includes(month)).length
      expect(count, `mois ${month}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('chaque titre reçoit son objectif', () => {
    for (const challenge of QUARTIER_CHALLENGES) expect(challenge.title).toContain('{n}')
  })

  it('les montants de fin de défi sont ceux du barème', () => {
    expect(SAP_RULES.challenge_participation.amount).toBe(QUARTIER_PARTICIPATION_SAP)
    expect(SAP_RULES.challenge_success.amount).toBe(QUARTIER_SUCCESS_SAP)
  })
})

describe('objectif', () => {
  const paillage = quartierChallenge('paillage')!

  it('grandit avec le quartier, arrondi, jamais sous le plancher', () => {
    expect(quartierTarget(paillage, 1)).toBe(15)
    expect(quartierTarget(paillage, 8)).toBe(25)
    expect(quartierTarget(paillage, 40)).toBe(120)
  })

  it('se lit dans le titre et l’unité', () => {
    expect(quartierTitle(paillage, 25)).toBe('Paillons 25 plantes avant le froid')
    expect(quartierUnit(paillage, 1)).toBe('plante paillée')
    expect(quartierUnit(paillage, 12)).toBe('plantes paillées')
  })
})

describe('tirage de la semaine', () => {
  it('déterministe, dans la saison', () => {
    const first = pickQuartierChallenge('2026-W45', 11, null)
    expect(pickQuartierChallenge('2026-W45', 11, null)).toBe(first)
    expect(first.months).toContain(11)
  })

  it('jamais deux semaines de suite le même', () => {
    for (let week = 1; week <= 52; week++) {
      const key = `2026-W${String(week).padStart(2, '0')}`
      const previous = pickQuartierChallenge(key, 6, null)
      expect(pickQuartierChallenge(key, 6, previous.slug).slug).not.toBe(previous.slug)
    }
  })
})
