import { describe, expect, it } from 'vitest'

import {
  buildSeasonPrompt,
  mergeSeasonProposal,
  missingSeasonFields,
  parseSeasonProposal,
  type CatalogSeasonInput,
} from '../season-enrichment'

function plant(overrides: Partial<CatalogSeasonInput> = {}): CatalogSeasonInput {
  return {
    commonName: 'Rosier',
    scientificName: 'Rosa × hybrida',
    family: 'Rosaceae',
    category: 'FLOWERS',
    indoor: false,
    outdoor: true,
    edible: false,
    dormancyMonths: null,
    floweringMonths: null,
    transplantMonths: null,
    pruningMonths: null,
    fertilizerMonths: null,
    treatmentSeasons: null,
    winterProtectionType: null,
    mulchRecommended: false,
    careTipWinter: null,
    ...overrides,
  }
}

const proposal = JSON.stringify({
  dormancyMonths: [12, 1, 2, 1],
  floweringMonths: [6, 5, 7],
  transplantMonths: null,
  pruningMonths: [3],
  fertilizerMonths: [],
  treatmentSeasons: ['SPRING', 'AUTUMN'],
  winterProtectionType: 'MULCH',
  mulchRecommended: true,
  careTipWinter: 'Butte le pied avec du compost avant les grands froids.',
})

describe('missingSeasonFields', () => {
  it('ne demande que les champs vides', () => {
    const missing = missingSeasonFields(plant({ pruningMonths: '[3]', mulchRecommended: true }))
    expect(missing).not.toContain('pruningMonths')
    expect(missing).not.toContain('mulchRecommended')
    expect(missing).toContain('dormancyMonths')
  })
})

describe('parseSeasonProposal', () => {
  it('trie, dédoublonne, et tient une liste vide pour « pas de valeur »', () => {
    const parsed = parseSeasonProposal(proposal)!
    expect(parsed.dormancyMonths).toEqual([1, 2, 12])
    expect(parsed.floweringMonths).toEqual([5, 6, 7])
    expect(parsed.fertilizerMonths).toBeNull()
  })

  it('refuse un mois impossible ou un JSON cassé', () => {
    expect(parseSeasonProposal('{ pas du json')).toBeNull()
    expect(parseSeasonProposal(proposal.replace('[3]', '[13]'))).toBeNull()
  })
})

describe('mergeSeasonProposal', () => {
  it('écrit au format des règles, sans toucher ce qui est renseigné', () => {
    const update = mergeSeasonProposal(
      plant({ floweringMonths: '[6,7,8,9]' }),
      parseSeasonProposal(proposal)!,
    )
    expect(update).toEqual({
      dormancyMonths: '[1,2,12]',
      pruningMonths: '[3]',
      treatmentSeasons: '["SPRING","AUTUMN"]',
      winterProtectionType: 'MULCH',
      mulchRecommended: true,
      careTipWinter: 'Butte le pied avec du compost avant les grands froids.',
    })
  })

  it('ne donne ni hivernage ni paillage à une plante qui ne sort pas', () => {
    const update = mergeSeasonProposal(
      plant({ indoor: true, outdoor: false, category: 'INDOOR' }),
      parseSeasonProposal(proposal)!,
    )
    expect(update.winterProtectionType).toBeUndefined()
    expect(update.mulchRecommended).toBeUndefined()
  })
})

describe('buildSeasonPrompt', () => {
  it('situe la plante et le climat', () => {
    const prompt = buildSeasonPrompt(plant())
    expect(prompt).toContain('Rosa × hybrida')
    expect(prompt).toContain('France métropolitaine')
  })
})
