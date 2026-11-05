import { describe, expect, it } from 'vitest'

import { CONDITION_FIELDS, describeConditions, readGardenTipForm } from '../secret-form'

function formData(entries: Array<[string, string]>): FormData {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

describe('readGardenTipForm', () => {
  it('lit les champs, une ligne par ingrédient, et les conditions structurées', () => {
    const raw = readGardenTipForm(
      formData([
        ['title', 'Le purin d’ortie'],
        ['teaser', 'Une mauvaise herbe, un seau, et deux semaines de patience.'],
        ['recipe', 'Étape 1\nÉtape 2'],
        ['ingredients', 'orties, sans graines\n\n eau de pluie '],
        ['evidence', 'PLAUSIBLE'],
        ['prepDays', '14'],
        ['effortMinutes', ''],
        ['cooldownDays', '90'],
        [CONDITION_FIELDS.categories, 'VEGETABLE'],
        [CONDITION_FIELDS.categories, 'HERBS'],
        [CONDITION_FIELDS.families, 'Solanaceae, Rosaceae;'],
        [CONDITION_FIELDS.months, '4'],
        [CONDITION_FIELDS.months, '5'],
        [CONDITION_FIELDS.locations, 'OUTDOOR'],
        [CONDITION_FIELDS.edible, 'false'],
        [CONDITION_FIELDS.notToxic, 'on'],
        [CONDITION_FIELDS.tempMaxAbove, '22,5'],
      ]),
    )

    expect(raw).toMatchObject({
      ingredients: ['orties, sans graines', 'eau de pluie'],
      prepDays: 14,
      effortMinutes: undefined,
      cooldownDays: 90,
      conditions: {
        categories: ['VEGETABLE', 'HERBS'],
        families: ['Solanaceae', 'Rosaceae'],
        months: [4, 5],
        locations: ['OUTDOOR'],
        edible: false,
        notToxic: true,
        lunarOnly: undefined,
        weather: { tempMaxAbove: 22.5, tempMinBelow: undefined, rainyRecently: undefined },
      },
    })
    // Sans champ `slug` (fiche d'édition), la clé n'existe pas.
    expect(raw).not.toHaveProperty('slug')
  })

  it('« Indifférent » ne pose ni comestible ni météo', () => {
    const raw = readGardenTipForm(formData([[CONDITION_FIELDS.edible, ''], ['slug', ' mon-secret ']]))
    expect(raw.conditions).toMatchObject({ edible: undefined, weather: undefined })
    expect(raw.slug).toBe('mon-secret')
  })
})

describe('describeConditions', () => {
  it('résume en français', () => {
    expect(
      describeConditions({ categories: ['VEGETABLE'], months: [3, 4], locations: ['OUTDOOR'], excludeGenera: ['Hydrangea'] }),
    ).toEqual(['Catégories : Potager', 'Sauf : Hydrangea', 'Mois : mars, avr.', 'Emplacements : Extérieur'])
    expect(describeConditions({})).toEqual([])
  })
})
