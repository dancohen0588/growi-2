import { describe, expect, it } from 'vitest'

import type { GardenSecret } from '@growi/shared'

import type { GardenAction } from '@/lib/recommendation/types'

import {
  effortLabel,
  isSecretAction,
  plancheFollowUp,
  practicalLine,
  prepLabel,
  recipeSteps,
  secretOpenLabel,
  splitEmphasis,
  splitSecretActions,
  triedMessage,
} from '../display'

function action(id: string, overrides: Partial<GardenAction> = {}): GardenAction {
  return {
    id,
    type: 'arrosage',
    label: `Action ${id}`,
    shortLabel: 'Arroser',
    dueDate: '2026-11-05',
    done: false,
    priority: 'medium',
    ...overrides,
  }
}

function secret(stage: GardenSecret['stage'], slug = 'coquilles-oeuf'): GardenSecret {
  return {
    slug,
    stage,
    title: 'Coquilles d’œuf',
    teaser: 'Ce que tes coquilles peuvent faire pour tes tomates.',
    evidence: 'PLAUSIBLE',
    story: null,
    recipe: 'Écrase les coquilles.\nÉpands-les au pied.',
    ingredients: ['Coquilles d’œuf'],
    cautions: null,
    prepDays: 0,
    effortMinutes: 10,
  }
}

function secretAction(id: string, stage: GardenSecret['stage']): GardenAction {
  return action(id, { type: 'autre', ruleId: `r20-secret`, secret: secret(stage) })
}

describe('splitSecretActions', () => {
  it('sort les secrets des listes ordinaires, sans toucher à l’ordre du reste', () => {
    const actions = [
      action('task-1', { source: 'task' }),
      secretAction('s-discover', 'discover'),
      action('a-2'),
      action('a-3', { type: 'autre' }),
    ]

    const { secrets, ordinary } = splitSecretActions(actions)

    expect(secrets.map((a) => a.id)).toEqual(['s-discover'])
    expect(ordinary.map((a) => a.id)).toEqual(['task-1', 'a-2', 'a-3'])
  })

  it('un « autre » ordinaire reste dans la liste : seul `secret` décide', () => {
    const { secrets, ordinary } = splitSecretActions([action('paillage', { type: 'autre', ruleId: 'r13-mulch' })])
    expect(secrets).toEqual([])
    expect(ordinary).toHaveLength(1)
  })

  it('met la préparation prête d’abord, puis la question, puis la découverte', () => {
    const { secrets } = splitSecretActions([
      secretAction('d', 'discover'),
      secretAction('f', 'feedback'),
      secretAction('r', 'ready'),
    ])
    expect(secrets.map((a) => a.secret.stage)).toEqual(['ready', 'feedback', 'discover'])
  })

  it('garde l’ordre du service à étape égale (deux jardins, deux découvertes)', () => {
    const { secrets } = splitSecretActions([secretAction('jardin-a', 'discover'), secretAction('jardin-b', 'discover')])
    expect(secrets.map((a) => a.id)).toEqual(['jardin-a', 'jardin-b'])
  })

  it('dédoublonne un secret vu dans deux jardins', () => {
    const { secrets } = splitSecretActions([secretAction('same', 'feedback'), secretAction('same', 'feedback')])
    expect(secrets).toHaveLength(1)
  })

  it('isSecretAction ne retient que les actions porteuses d’un secret', () => {
    expect(isSecretAction(secretAction('s', 'discover'))).toBe(true)
    expect(isSecretAction(action('a'))).toBe(false)
  })
})

describe('recipeSteps', () => {
  it('coupe aux retours à la ligne et ignore les lignes vides', () => {
    expect(recipeSteps('Écrase.\n\n  Épands.  \r\nArrose.')).toEqual(['Écrase.', 'Épands.', 'Arrose.'])
  })

  it('retire une numérotation ou une puce déjà écrite', () => {
    expect(recipeSteps('1. Remplis un seau\n2) Ajoute les orties\n- Couvre\n• Attends')).toEqual([
      'Remplis un seau',
      'Ajoute les orties',
      'Couvre',
      'Attends',
    ])
  })

  it('ne mange pas un nombre qui fait partie de la phrase', () => {
    expect(recipeSteps('1 kg d’orties pour 10 litres d’eau')).toEqual(['1 kg d’orties pour 10 litres d’eau'])
  })

  it('rend une liste vide pour une recette absente', () => {
    expect(recipeSteps(null)).toEqual([])
    expect(recipeSteps('')).toEqual([])
  })
})

describe('libellés', () => {
  it('prepLabel ne dit rien pour une recette immédiate', () => {
    expect(prepLabel(0)).toBeNull()
    expect(prepLabel(1)).toBe('Prêt dans 1 jour')
    expect(prepLabel(15)).toBe('Prêt dans 15 jours')
  })

  it('effortLabel passe aux heures au-delà de 59 minutes', () => {
    expect(effortLabel(null)).toBeNull()
    expect(effortLabel(10)).toBe('10 min')
    expect(effortLabel(60)).toBe('1 h')
    expect(effortLabel(95)).toBe('1 h 35')
  })

  it('triedMessage annonce la suite selon la préparation', () => {
    expect(triedMessage(0)).toMatch(/une semaine/)
    expect(triedMessage(1)).toMatch(/demain/)
    expect(triedMessage(15)).toMatch(/dans 15 jours/)
  })
})

describe('splitEmphasis', () => {
  it('met en gras le passage, au milieu de la légende', () => {
    expect(
      splitEmphasis('Garde l’eau de cuisson des légumes, sans sel ni matière grasse.', 'sans sel ni matière grasse'),
    ).toEqual([
      { text: 'Garde l’eau de cuisson des légumes, ', strong: false },
      { text: 'sans sel ni matière grasse', strong: true },
      { text: '.', strong: false },
    ])
  })

  it('ne produit pas de segment vide en début ou en fin de légende', () => {
    expect(splitEmphasis('Refroidir complètement', 'Refroidir')).toEqual([
      { text: 'Refroidir', strong: true },
      { text: ' complètement', strong: false },
    ])
    expect(splitEmphasis('Laisse refroidir', 'refroidir')).toEqual([
      { text: 'Laisse ', strong: false },
      { text: 'refroidir', strong: true },
    ])
  })

  it('ne souligne que la première occurrence', () => {
    expect(splitEmphasis('eau, puis eau', 'eau').filter((segment) => segment.strong)).toHaveLength(1)
  })

  it('laisse la légende entière sans passage, ou avec un passage introuvable', () => {
    const whole = [{ text: 'Arrose ta plante avec.', strong: false }]
    expect(splitEmphasis('Arrose ta plante avec.')).toEqual(whole)
    expect(splitEmphasis('Arrose ta plante avec.', '   ')).toEqual(whole)
    expect(splitEmphasis('Arrose ta plante avec.', 'du robinet')).toEqual(whole)
  })

  it('ne rend jamais de HTML : un passage balisé reste du texte', () => {
    const segments = splitEmphasis('Une <b>légende</b>', '<b>légende</b>')
    expect(segments).toEqual([
      { text: 'Une ', strong: false },
      { text: '<b>légende</b>', strong: true },
    ])
  })
})

describe('planche', () => {
  const planche = {
    panels: [{ art: 'eau-cuisson/1', caption: 'Garde l’eau de cuisson.' }],
  }

  it('secretOpenLabel ouvre une planche, et fait découvrir un secret en texte', () => {
    expect(secretOpenLabel({ planche })).toBe('Ouvrir la planche')
    expect(secretOpenLabel({ planche: null })).toBe('Découvrir le secret')
    expect(secretOpenLabel({})).toBe('Découvrir le secret')
  })

  it('plancheFollowUp annonce la suite : le verdict, ou la préparation prête', () => {
    expect(plancheFollowUp(0)).toBe('Dans une semaine, on te demandera si ça a marché.')
    expect(plancheFollowUp(1)).toBe('Ta préparation sera prête demain : on te préviendra ici.')
    expect(plancheFollowUp(15)).toBe('Ta préparation sera prête dans 15 jours : on te préviendra ici.')
  })

  it('practicalLine réunit l’effort et la préparation, ou ne dit rien', () => {
    expect(practicalLine({ effortMinutes: 2, prepDays: 0 })).toBe('2 min')
    expect(practicalLine({ effortMinutes: 20, prepDays: 15 })).toBe('20 min · prêt dans 15 jours')
    expect(practicalLine({ effortMinutes: null, prepDays: 0 })).toBeNull()
  })
})
