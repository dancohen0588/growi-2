/**
 * SQL d'insertion de la bibliothèque de départ — `ON CONFLICT DO NOTHING` :
 * une astuce déjà en base, peut-être retouchée depuis l'admin, n'est jamais
 * écrasée. Sert à générer la migration et au script `secrets:seed --sql`.
 */

import { createHash } from 'node:crypto'

import { secretConditionsSchema } from '@growi/shared'

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
      `'PUBLISHED'`,
    ].join(', ')})`
  })

  return [
    'INSERT INTO "garden_tips" ("id", "slug", "title", "teaser", "story", "recipe", "ingredients", "evidence", "cautions", "prepDays", "effortMinutes", "cooldownDays", "conditions", "status") VALUES',
    rows.join(',\n'),
    'ON CONFLICT ("slug") DO NOTHING;',
  ].join('\n')
}
