/**
 * Formulaire d'un secret de jardinier (`/admin/secrets`) : lecture du
 * `FormData` en objet brut, et résumé lisible des conditions.
 *
 * Pur — ni Prisma ni Next. La validation n'est **pas** faite ici mais par le
 * service (`secrets-admin.service`), qui reçoit l'objet tel quel : un champ
 * mal saisi doit revenir avec le message du service, pas disparaître en route.
 */

import {
  HEALTH_STATUS_LABELS,
  PLANT_CATEGORY_LABELS,
  PLANT_LOCATION_LABELS,
  type HealthStatus,
  type PlantCategory,
  type PlantLocation,
  type SecretConditions,
} from '@growi/shared'

/** Noms des champs de conditions dans le formulaire. */
export const CONDITION_FIELDS = {
  categories: 'cond.categories',
  families: 'cond.families',
  genera: 'cond.genera',
  excludeFamilies: 'cond.excludeFamilies',
  excludeGenera: 'cond.excludeGenera',
  months: 'cond.months',
  locations: 'cond.locations',
  edible: 'cond.edible',
  notToxic: 'cond.notToxic',
  healthStatus: 'cond.healthStatus',
  lunarOnly: 'cond.lunarOnly',
  tempMaxAbove: 'cond.tempMaxAbove',
  tempMinBelow: 'cond.tempMinBelow',
  rainyRecently: 'cond.rainyRecently',
} as const

const text = (formData: FormData, name: string): string => {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Vide → absent ; sinon un nombre — `NaN` compris, que le schéma refusera avec son libellé. */
const numberOrUndefined = (formData: FormData, name: string): number | undefined => {
  const value = text(formData, name).trim().replace(',', '.')
  return value === '' ? undefined : Number(value)
}

/** Une case cochée envoie « on », une case décochée n'envoie rien. */
const checked = (formData: FormData, name: string): boolean => formData.get(name) !== null

/** Une valeur par ligne — les ingrédients, qui peuvent contenir des virgules. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Virgules ou retours à la ligne — les familles et les genres. */
export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function readConditions(formData: FormData): SecretConditions {
  const strings = (name: string) => formData.getAll(name).filter((v): v is string => typeof v === 'string')
  const edible = text(formData, CONDITION_FIELDS.edible)

  const tempMaxAbove = numberOrUndefined(formData, CONDITION_FIELDS.tempMaxAbove)
  const tempMinBelow = numberOrUndefined(formData, CONDITION_FIELDS.tempMinBelow)
  const rainyRecently = checked(formData, CONDITION_FIELDS.rainyRecently)

  return {
    categories: strings(CONDITION_FIELDS.categories),
    families: splitList(text(formData, CONDITION_FIELDS.families)),
    genera: splitList(text(formData, CONDITION_FIELDS.genera)),
    excludeFamilies: splitList(text(formData, CONDITION_FIELDS.excludeFamilies)),
    excludeGenera: splitList(text(formData, CONDITION_FIELDS.excludeGenera)),
    months: strings(CONDITION_FIELDS.months).map(Number),
    locations: strings(CONDITION_FIELDS.locations) as PlantLocation[],
    edible: edible === 'true' ? true : edible === 'false' ? false : undefined,
    notToxic: checked(formData, CONDITION_FIELDS.notToxic) || undefined,
    healthStatus: strings(CONDITION_FIELDS.healthStatus),
    lunarOnly: checked(formData, CONDITION_FIELDS.lunarOnly) || undefined,
    weather:
      tempMaxAbove !== undefined || tempMinBelow !== undefined || rainyRecently
        ? { tempMaxAbove, tempMinBelow, rainyRecently: rainyRecently || undefined }
        : undefined,
  }
}

/** Le formulaire entier, en objet brut pour le service. `slug` n'est lu qu'à la création. */
export function readGardenTipForm(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    title: text(formData, 'title'),
    teaser: text(formData, 'teaser'),
    story: text(formData, 'story'),
    recipe: text(formData, 'recipe'),
    ingredients: splitLines(text(formData, 'ingredients')),
    evidence: text(formData, 'evidence'),
    cautions: text(formData, 'cautions'),
    prepDays: numberOrUndefined(formData, 'prepDays'),
    effortMinutes: numberOrUndefined(formData, 'effortMinutes'),
    cooldownDays: numberOrUndefined(formData, 'cooldownDays'),
    conditions: readConditions(formData),
  }
  if (formData.has('slug')) raw.slug = text(formData, 'slug').trim()
  const planche = readPlanche(formData)
  if (planche !== undefined) raw.planche = planche
  return raw
}

// ─── Résumé ────────────────────────────────────────────────────────────────

export const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const label = <T extends string>(labels: Record<T, string>, value: string) => labels[value as T] ?? value

/**
 * Les conditions en phrases courtes, pour l'aperçu : relire « Potager ·
 * mars–mai · dehors » se fait d'un coup d'œil, un JSON non.
 */
export function describeConditions(conditions: SecretConditions): string[] {
  const lines: string[] = []
  if (conditions.categories?.length) {
    lines.push(`Catégories : ${conditions.categories.map((c) => label<PlantCategory>(PLANT_CATEGORY_LABELS, c)).join(', ')}`)
  }
  const botanical = [...(conditions.families ?? []), ...(conditions.genera ?? [])]
  if (botanical.length) lines.push(`Familles ou genres : ${botanical.join(', ')}`)
  const excluded = [...(conditions.excludeFamilies ?? []), ...(conditions.excludeGenera ?? [])]
  if (excluded.length) lines.push(`Sauf : ${excluded.join(', ')}`)
  if (conditions.months?.length) lines.push(`Mois : ${conditions.months.map((m) => MONTH_SHORT[m - 1] ?? m).join(', ')}`)
  if (conditions.locations?.length) {
    lines.push(`Emplacements : ${conditions.locations.map((l) => label<PlantLocation>(PLANT_LOCATION_LABELS, l)).join(', ')}`)
  }
  if (conditions.edible === true) lines.push('Plantes comestibles seulement')
  if (conditions.edible === false) lines.push('Plantes non comestibles seulement')
  if (conditions.notToxic) lines.push('Jamais une plante toxique')
  if (conditions.healthStatus?.length) {
    lines.push(`Santé : ${conditions.healthStatus.map((h) => label<HealthStatus>(HEALTH_STATUS_LABELS, h)).join(', ')}`)
  }
  const weather = conditions.weather
  if (weather?.tempMaxAbove != null) lines.push(`Si le maximum dépasse ${weather.tempMaxAbove} °C`)
  if (weather?.tempMinBelow != null) lines.push(`Si le minimum descend sous ${weather.tempMinBelow} °C`)
  if (weather?.rainyRecently) lines.push('Après de la pluie récente')
  if (conditions.lunarOnly) lines.push('Seulement avec le calendrier lunaire activé')
  return lines
}

// ─── Planche ───────────────────────────────────────────────────────────────

/**
 * Noms des champs de la planche. Les cases sont indexées dans l'ordre
 * d'affichage (`planche.panels.0.art`) : l'éditeur renumérote à chaque
 * réordonnancement, la lecture trie par index.
 */
export const PLANCHE_FIELDS = {
  /** `none` (pas de planche) ou `set`. Absent : le formulaire ne touche pas à la planche. */
  mode: 'planche.mode',
  panel: (index: number, field: 'art' | 'caption' | 'emphasis') => `planche.panels.${index}.${field}`,
  cautionArt: 'planche.caution.art',
  cautionTitle: 'planche.caution.title',
  cautionText: 'planche.caution.text',
} as const

const PANEL_ART = /^planche\.panels\.(\d+)\.art$/

/**
 * La planche saisie, en objet brut — validée ensuite par le service avec
 * `secretPlancheSchema`, qui en renvoie les défauts en français.
 *
 * - `undefined` : le formulaire n'a pas de section planche — on n'y touche pas ;
 * - `null` : « Pas de planche », le secret repasse en texte ;
 * - sinon `{ panels, caution }` ; un passage en gras vide vaut absent, une
 *   précaution sans dessin vaut pas de précaution.
 */
const oneLine = (value: string) => value.replace(/\s*\r?\n\s*/g, ' ')

export function readPlanche(formData: FormData): Record<string, unknown> | null | undefined {
  const mode = text(formData, PLANCHE_FIELDS.mode)
  if (mode === '') return undefined
  if (mode === 'none') return null

  const indexes = [...formData.keys()]
    .flatMap((key) => {
      const match = PANEL_ART.exec(key)
      return match ? [Number(match[1])] : []
    })
    .sort((a, b) => a - b)

  const panels = [...new Set(indexes)].map((index) => {
    const emphasis = text(formData, PLANCHE_FIELDS.panel(index, 'emphasis')).trim()
    return {
      art: text(formData, PLANCHE_FIELDS.panel(index, 'art')),
      // Une légende tient sur une ligne : un `textarea` envoie du CRLF, et un
      // retour à la ligne y casserait le gras et la mise en page de la case.
      caption: oneLine(text(formData, PLANCHE_FIELDS.panel(index, 'caption'))),
      ...(emphasis ? { emphasis } : {}),
    }
  })

  const cautionArt = text(formData, PLANCHE_FIELDS.cautionArt)
  const caution = cautionArt
    ? {
        art: cautionArt,
        title: oneLine(text(formData, PLANCHE_FIELDS.cautionTitle)),
        text: oneLine(text(formData, PLANCHE_FIELDS.cautionText)),
      }
    : null

  return { panels, caution }
}

/** Déplace l'élément `index` de `delta` places ; hors bornes, la liste est rendue telle quelle. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}
