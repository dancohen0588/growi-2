/**
 * SQL d'insertion de la bibliothèque de départ — `ON CONFLICT DO NOTHING` :
 * une astuce déjà en base, peut-être retouchée depuis l'admin, n'est jamais
 * écrasée. Sert à générer la migration et au script `secrets:seed --sql`.
 */

import { createHash } from 'node:crypto'

import { secretConditionsSchema, secretPlancheSchema } from '@growi/shared'

import type { SecretSeed } from './library'

function literal(value: string | null | undefined): string {
  if (value == null) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function textArray(values: string[]): string {
  return values.length === 0 ? `ARRAY[]::TEXT[]` : `ARRAY[${values.map(literal).join(', ')}]::TEXT[]`
}

/** Identifiant stable dérivé du slug : relancer la génération donne le même SQL. */
export function seedId(slug: string): string {
  return `tip_${createHash('sha256').update(slug).digest('hex').slice(0, 20)}`
}

/**
 * Pose la planche des secrets **nommés** qui n'en ont pas encore en base —
 * ceux d'un lot de dessins qu'on livre. Une planche retouchée depuis l'admin
 * n'est jamais écrasée.
 *
 * Les slugs sont explicites, jamais « toute la bibliothèque » : un admin qui a
 * retiré une planche (`NULL`) la verrait sinon revenir au lot suivant.
 */
export function seedPlancheSql(seeds: SecretSeed[], slugs: readonly string[]): string {
  const drawn = seeds.filter((seed) => seed.planche && slugs.includes(seed.slug))
  if (drawn.length === 0) return ''
  const rows = drawn.map(
    (seed) => `  (${literal(seed.slug)}, ${literal(JSON.stringify(secretPlancheSchema.parse(seed.planche)))}::jsonb)`,
  )
  return [
    'UPDATE "garden_tips" AS t SET "planche" = v.planche, "updatedAt" = now()',
    `FROM (VALUES\n${rows.join(',\n')}\n) AS v(slug, planche)`,
    'WHERE t."slug" = v.slug AND t."planche" IS NULL;',
  ].join('\n')
}

export function seedInsertSql(seeds: SecretSeed[]): string {
  const rows = seeds.map((seed) => {
    const conditions = secretConditionsSchema.parse(seed.conditions)
    return `  (${[
      literal(seedId(seed.slug)),
      literal(seed.slug),
      literal(seed.title),
      literal(seed.teaser),
      literal(seed.story),
      literal(seed.recipe),
      textArray(seed.ingredients),
      literal(seed.evidence),
      literal(seed.cautions),
      String(seed.prepDays ?? 0),
      seed.effortMinutes == null ? 'NULL' : String(seed.effortMinutes),
      String(seed.cooldownDays ?? 120),
      `${literal(JSON.stringify(conditions))}::jsonb`,
      seed.planche ? `${literal(JSON.stringify(secretPlancheSchema.parse(seed.planche)))}::jsonb` : 'NULL',
      `'PUBLISHED'`,
    ].join(', ')})`
  })

  return [
    'INSERT INTO "garden_tips" ("id", "slug", "title", "teaser", "story", "recipe", "ingredients", "evidence", "cautions", "prepDays", "effortMinutes", "cooldownDays", "conditions", "planche", "status") VALUES',
    rows.join(',\n'),
    'ON CONFLICT ("slug") DO NOTHING;',
  ].join('\n')
}
