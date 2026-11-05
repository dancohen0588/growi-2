import { describe, expect, it } from 'vitest'

import {
  CONDITION_FIELDS,
  PLANCHE_FIELDS,
  describeConditions,
  moveItem,
  readGardenTipForm,
  readPlanche,
} from '../secret-form'

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

describe('readPlanche', () => {
  it('ne touche pas à la planche quand le formulaire n’en parle pas', () => {
    expect(readPlanche(formData([['title', 'x']]))).toBeUndefined()
    expect(readGardenTipForm(formData([['title', 'x']]))).not.toHaveProperty('planche')
  })

  it('« Pas de planche » vaut null, même avec des cases restées dans le formulaire', () => {
    const data = formData([
      [PLANCHE_FIELDS.mode, 'none'],
      [PLANCHE_FIELDS.panel(0, 'art'), 'eau-cuisson/1'],
    ])
    expect(readPlanche(data)).toBeNull()
    expect(readGardenTipForm(data)).toHaveProperty('planche', null)
  })

  it('lit les cases dans l’ordre des index, pas dans celui du formulaire', () => {
    const data = formData([
      [PLANCHE_FIELDS.mode, 'set'],
      [PLANCHE_FIELDS.panel(1, 'art'), 'eau-cuisson/2'],
      [PLANCHE_FIELDS.panel(1, 'caption'), 'Laisse-la refroidir.'],
      [PLANCHE_FIELDS.panel(1, 'emphasis'), '  '],
      [PLANCHE_FIELDS.panel(0, 'art'), 'eau-cuisson/1'],
      [PLANCHE_FIELDS.panel(0, 'caption'), 'Garde l’eau, sans sel.'],
      [PLANCHE_FIELDS.panel(0, 'emphasis'), ' sans sel '],
      [PLANCHE_FIELDS.panel(10, 'art'), 'eau-cuisson/3'],
      [PLANCHE_FIELDS.panel(10, 'caption'), 'Arrose.'],
    ])
    expect(readPlanche(data)).toEqual({
      panels: [
        { art: 'eau-cuisson/1', caption: 'Garde l’eau, sans sel.', emphasis: 'sans sel' },
        { art: 'eau-cuisson/2', caption: 'Laisse-la refroidir.' },
        { art: 'eau-cuisson/3', caption: 'Arrose.' },
      ],
      caution: null,
    })
  })

  it('lit la précaution, et l’ignore sans dessin', () => {
    const withCaution = formData([
      [PLANCHE_FIELDS.mode, 'set'],
      [PLANCHE_FIELDS.cautionArt, 'eau-cuisson/caution'],
      [PLANCHE_FIELDS.cautionTitle, 'Jamais salée.'],
      [PLANCHE_FIELDS.cautionText, 'Le sel brûle les racines.'],
    ])
    expect(readPlanche(withCaution)).toEqual({
      panels: [],
      caution: { art: 'eau-cuisson/caution', title: 'Jamais salée.', text: 'Le sel brûle les racines.' },
    })

    const withoutArt = formData([
      [PLANCHE_FIELDS.mode, 'set'],
      [PLANCHE_FIELDS.cautionTitle, 'Reste d’une saisie'],
    ])
    expect(readPlanche(withoutArt)).toEqual({ panels: [], caution: null })
  })
})

describe('moveItem', () => {
  it('monte et descend d’une place', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('rend une copie inchangée hors bornes, sans muter l’original', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(list, 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(list, 5, -1)).toEqual(['a', 'b'])
    expect(moveItem(list, 0, 1)).not.toBe(list)
    expect(list).toEqual(['a', 'b'])
  })
})
