/**
 * Choix du secret de la semaine — fonctions pures, sans Prisma.
 *
 * Un secret par semaine et par jardin (décision du 05/11/2026). Le tirage est
 * pondéré et **déterministe** : graine `gardenId + semaine ISO`. Le résultat
 * est ensuite figé en base (`garden_tip_picks`) par `secrets.service`, si bien
 * qu'une plante ajoutée mercredi ou la météo qui tourne ne changent pas le
 * secret sous les yeux de l'utilisateur.
 */

import type { SecretConditions, SecretEvidence } from '@growi/shared'

// ─── Semaines ISO ──────────────────────────────────────────────────────────

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Lundi et dimanche de la semaine ISO d'un jour `YYYY-MM-DD`. */
export function isoWeekBounds(day: string): { start: string; end: string } {
  const date = parseDay(day)
  const offset = (date.getUTCDay() + 6) % 7 // lundi = 0
  const start = new Date(date)
  start.setUTCDate(date.getUTCDate() - offset)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start: formatDay(start), end: formatDay(end) }
}

/** Clé de semaine ISO, `2026-W45`. L'année est celle du jeudi de la semaine. */
export function isoWeekKey(day: string): string {
  const date = parseDay(day)
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ─── Conditions ────────────────────────────────────────────────────────────

/** Ce qu'il faut savoir d'une plante pour lui destiner un secret. */
export interface SecretPlant {
  id: string
  location: string
  healthStatus: string
  catalog: {
    category: string
    family: string | null
    scientificName: string
    edible: boolean
    toxic: boolean
  } | null
}

/** La météo du jour du tirage. Nulle quand elle est indisponible. */
export interface SecretWeather {
  tempMax: number
  tempMin: number
  /** Pluie tombée sur les trois derniers jours, en mm. */
  recentPrecip?: number
}

export interface MatchContext {
  month: number
  weather: SecretWeather | null
  lunarEnabled: boolean
}

/**
 * Ramène une famille à une forme comparable. Le catalogue écrit les deux :
 * « Solanaceae » et « Solanacées », « Astéracées » et « Asteraceae ».
 */
export function normalizeFamily(family: string): string {
  return family
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/acees$/, 'aceae')
}

function genusOf(scientificName: string): string {
  return (scientificName.trim().split(/\s+/)[0] ?? '').toLowerCase()
}

function includesCI(list: string[], value: string): boolean {
  return list.some((item) => item.toLowerCase() === value)
}

function familyIn(list: string[], family: string | null): boolean {
  if (!family) return false
  const normalized = normalizeFamily(family)
  return list.some((item) => normalizeFamily(item) === normalized)
}

/** Conditions de saison et de contexte, indépendantes de la plante. */
export function matchesContext(conditions: SecretConditions, ctx: MatchContext): boolean {
  if (conditions.lunarOnly && !ctx.lunarEnabled) return false
  if (conditions.months?.length && !conditions.months.includes(ctx.month)) return false

  const weather = conditions.weather
  if (weather) {
    // Un secret « du moment » ne se tire pas sans connaître le moment.
    if (!ctx.weather) return false
    if (weather.tempMaxAbove != null && !(ctx.weather.tempMax > weather.tempMaxAbove)) return false
    if (weather.tempMinBelow != null && !(ctx.weather.tempMin < weather.tempMinBelow)) return false
    if (weather.rainyRecently && !((ctx.weather.recentPrecip ?? 0) >= 5)) return false
  }
  return true
}

/** La plante répond-elle aux conditions botaniques et de culture ? */
export function matchesPlant(conditions: SecretConditions, plant: SecretPlant): boolean {
  const catalog = plant.catalog

  if (conditions.locations?.length && !conditions.locations.includes(plant.location as never)) {
    return false
  }
  if (conditions.healthStatus?.length && !conditions.healthStatus.includes(plant.healthStatus)) {
    return false
  }

  const needsCatalog =
    !!conditions.categories?.length ||
    !!conditions.families?.length ||
    !!conditions.genera?.length ||
    conditions.edible != null ||
    !!conditions.notToxic
  if (!catalog) return !needsCatalog

  if (conditions.categories?.length && !conditions.categories.includes(catalog.category)) return false
  if (conditions.edible != null && catalog.edible !== conditions.edible) return false
  if (conditions.notToxic && catalog.toxic) return false

  const genus = genusOf(catalog.scientificName)
  // Familles et genres se cumulent en OU : « les rosiers ou les cucurbitacées ».
  const botanical = [conditions.families, conditions.genera].some((list) => list?.length)
  if (botanical) {
    const byFamily = !!conditions.families?.length && familyIn(conditions.families, catalog.family)
    const byGenus = !!conditions.genera?.length && includesCI(conditions.genera, genus)
    if (!byFamily && !byGenus) return false
  }

  if (conditions.excludeFamilies?.length && familyIn(conditions.excludeFamilies, catalog.family)) {
    return false
  }
  if (conditions.excludeGenera?.length && includesCI(conditions.excludeGenera, genus)) return false

  return true
}

// ─── Tirage ────────────────────────────────────────────────────────────────

export interface SecretCandidate {
  slug: string
  evidence: SecretEvidence
  cooldownDays: number
  conditions: SecretConditions
}

export interface SelectInput {
  gardenId: string
  /** Jour de l'utilisateur, `YYYY-MM-DD`. */
  today: string
  tips: SecretCandidate[]
  plants: SecretPlant[]
  weather: SecretWeather | null
  lunarEnabled: boolean
  /** « Pas pour moi » : jamais reproposés. */
  dismissed: ReadonlySet<string>
  /** Dévoilés au moins une fois. */
  revealed: ReadonlySet<string>
  /** Dernier essai par secret, toutes plantes confondues. */
  lastTriedAt: ReadonlyMap<string, Date>
  /** Le secret de la semaine précédente — pour varier. */
  previous?: { slug: string; evidence: SecretEvidence } | null
}

export interface WeeklyPick {
  slug: string
  plantId: string
}

/**
 * FNV-1a 32 bits suivi du brassage final de MurmurHash3, ramené dans [0, 1).
 * Sans ce brassage, deux graines qui ne diffèrent que par leur fin (`W45`,
 * `W46`) tombent sur des valeurs voisines, et le tirage ne varie presque pas
 * d'une semaine à l'autre. Rien de cryptographique ici.
 */
export function unitHash(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return (hash >>> 0) / 0x1_0000_0000
}

/**
 * Pertinence d'un secret : un déclencheur précis l'emporte sur une condition
 * de saison. La météo d'abord — c'est elle qui fait d'un secret de saison un
 * secret « du moment » —, puis la botanique.
 */
function relevance(conditions: SecretConditions): number {
  if (conditions.weather) return 3
  if (conditions.genera?.length || conditions.families?.length) return 2
  return 1
}

/**
 * Le secret de la semaine, et la plante à laquelle il s'adresse. Nul quand
 * rien ne convient — l'hiver d'un balcon vide, une bibliothèque épuisée.
 */
export function selectWeeklySecret(input: SelectInput): WeeklyPick | null {
  const month = Number(input.today.slice(5, 7))
  const ctx: MatchContext = { month, weather: input.weather, lunarEnabled: input.lunarEnabled }
  const now = new Date(`${input.today}T12:00:00.000Z`).getTime()
  const week = isoWeekKey(input.today)

  const weighted: Array<{ slug: string; plants: SecretPlant[]; weight: number }> = []

  for (const tip of [...input.tips].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (input.dismissed.has(tip.slug)) continue
    if (!matchesContext(tip.conditions, ctx)) continue

    const tried = input.lastTriedAt.get(tip.slug)
    if (tried && now - tried.getTime() < tip.cooldownDays * 86_400_000) continue

    const plants = input.plants
      .filter((plant) => matchesPlant(tip.conditions, plant))
      .sort((a, b) => a.id.localeCompare(b.id))
    if (plants.length === 0) continue

    // Nouveauté : jamais vu vaut double, déjà essayé ne revient qu'en appoint.
    const novelty = tried ? 0.3 : input.revealed.has(tip.slug) ? 1 : 2
    // Diversité : deux « Tradition » de suite, c'est un de trop.
    const diversity =
      input.previous && input.previous.slug !== tip.slug && input.previous.evidence === tip.evidence ? 0.6 : 1

    weighted.push({ slug: tip.slug, plants, weight: relevance(tip.conditions) * novelty * diversity })
  }

  // Jamais deux semaines de suite le même secret — sauf s'il est le seul.
  const pool =
    weighted.length > 1 ? weighted.filter((item) => item.slug !== input.previous?.slug) : weighted

  const total = pool.reduce((sum, item) => sum + item.weight, 0)
  if (total <= 0) return null

  let target = unitHash(`${input.gardenId}:${week}`) * total
  let chosen = pool[pool.length - 1]
  for (const item of pool) {
    target -= item.weight
    if (target < 0) {
      chosen = item
      break
    }
  }

  const plantIndex = Math.floor(unitHash(`${input.gardenId}:${week}:${chosen.slug}`) * chosen.plants.length)
  return { slug: chosen.slug, plantId: chosen.plants[plantIndex].id }
}
