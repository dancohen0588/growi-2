import { describe, expect, it } from 'vitest'

import { SECRET_EVIDENCES, secretConditionsSchema, secretSlugSchema, updateGardenTipSchema } from '@growi/shared'

import { SECRET_LIBRARY } from '../library'
import { seedId, seedInsertSql } from '../seed-sql'

// La bibliothèque de départ doit passer les contrôles de l'admin : sans quoi
// la première retouche d'un secret échouerait sur un champ qu'on n'a pas touché.

describe('bibliothèque de départ', () => {
  it('compte les 24 secrets de la spec, sans doublon', () => {
    expect(SECRET_LIBRARY).toHaveLength(24)
    expect(new Set(SECRET_LIBRARY.map((tip) => tip.slug)).size).toBe(24)
  })

  it.each(SECRET_LIBRARY.map((tip) => [tip.slug, tip] as const))('%s respecte le formulaire de l’admin', (_slug, tip) => {
    expect(secretSlugSchema.safeParse(tip.slug).success).toBe(true)
    expect(SECRET_EVIDENCES).toContain(tip.evidence)
    expect(secretConditionsSchema.safeParse(tip.conditions).success).toBe(true)

    const parsed = updateGardenTipSchema.safeParse({
      title: tip.title,
      teaser: tip.teaser,
      story: tip.story ?? '',
      recipe: tip.recipe,
      ingredients: tip.ingredients,
      evidence: tip.evidence,
      cautions: tip.cautions ?? '',
      prepDays: tip.prepDays ?? 0,
      effortMinutes: tip.effortMinutes,
      cooldownDays: tip.cooldownDays ?? 120,
      conditions: tip.conditions,
      status: 'PUBLISHED',
    })
    expect(parsed.success, parsed.success ? '' : parsed.error.message).toBe(true)
  })

  it('ne prononce jamais le mot « IA »', () => {
    const text = JSON.stringify(SECRET_LIBRARY)
    expect(text).not.toMatch(/(^|[^\p{L}])IA([^\p{L}]|$)/u)
    expect(text).not.toMatch(/intelligence artificielle/i)
  })

  it('accompagne d’une précaution tout ce qui n’est pas une légende', () => {
    const risky = ['cendres', 'eau-cuisson', 'marc-cafe', 'purin-ortie', 'bicarbonate', 'savon-noir']
    for (const slug of risky) {
      expect(SECRET_LIBRARY.find((tip) => tip.slug === slug)?.cautions, slug).toBeTruthy()
    }
  })

  it('génère un SQL qui n’écrase rien et des identifiants stables', () => {
    const sql = seedInsertSql(SECRET_LIBRARY)
    expect(sql).toContain('ON CONFLICT ("slug") DO NOTHING')
    expect(sql.match(/^ {2}\('tip_/gm)).toHaveLength(24)
    expect(seedId('lune')).toBe(seedId('lune'))
    expect(seedInsertSql([{ ...SECRET_LIBRARY[0]!, title: "L'apostrophe" }])).toContain("'L''apostrophe'")
  })
})
