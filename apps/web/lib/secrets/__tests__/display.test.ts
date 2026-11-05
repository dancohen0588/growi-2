import { describe, expect, it } from 'vitest'

import type { GardenSecret } from '@growi/shared'

import type { GardenAction } from '@/lib/recommendation/types'

import {
  effortLabel,
  isSecretAction,
  prepLabel,
  recipeSteps,
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
