import { z } from 'zod'

/**
 * Calendrier lunaire du jardinier — **option désactivée par défaut**
 * (décision du 05/11/2026), toujours présentée comme une tradition : aucune
 * preuve n'établit l'effet de la Lune sur les cultures.
 *
 * Calcul astronomique simplifié (termes principaux de Meeus, précision d'un à
 * deux degrés, largement suffisante pour un signe de 30°). Le zodiaque est
 * **sidéral**, comme dans les calendriers biodynamiques : la position de la
 * Lune devant les constellations, et non le zodiaque tropical des horoscopes.
 * Les calendriers du commerce utilisent les constellations réelles, de tailles
 * inégales ; nos signes égaux de 30° peuvent donc décaler un changement de
 * type de jour de quelques heures — sans importance pour un conseil du jour.
 */

export const LUNAR_DAY_TYPES = ['racine', 'feuille', 'fleur', 'fruit'] as const
export const lunarDayTypeSchema = z.enum(LUNAR_DAY_TYPES)
export type LunarDayType = z.infer<typeof lunarDayTypeSchema>

export const LUNAR_PHASES = [
  'nouvelle',
  'premier-croissant',
  'premier-quartier',
  'gibbeuse-croissante',
  'pleine',
  'gibbeuse-decroissante',
  'dernier-quartier',
  'dernier-croissant',
] as const
export const lunarPhaseSchema = z.enum(LUNAR_PHASES)
export type LunarPhase = z.infer<typeof lunarPhaseSchema>

export const LUNAR_PHASE_LABELS: Record<LunarPhase, string> = {
  nouvelle: 'Nouvelle lune',
  'premier-croissant': 'Premier croissant',
  'premier-quartier': 'Premier quartier',
  'gibbeuse-croissante': 'Lune gibbeuse croissante',
  pleine: 'Pleine lune',
  'gibbeuse-decroissante': 'Lune gibbeuse décroissante',
  'dernier-quartier': 'Dernier quartier',
  'dernier-croissant': 'Dernier croissant',
}

export const LUNAR_PHASE_EMOJIS: Record<LunarPhase, string> = {
  nouvelle: '🌑',
  'premier-croissant': '🌒',
  'premier-quartier': '🌓',
  'gibbeuse-croissante': '🌔',
  pleine: '🌕',
  'gibbeuse-decroissante': '🌖',
  'dernier-quartier': '🌗',
  'dernier-croissant': '🌘',
}

export const LUNAR_DAY_LABELS: Record<LunarDayType, string> = {
  racine: 'Jour racine',
  feuille: 'Jour feuille',
  fleur: 'Jour fleur',
  fruit: 'Jour fruit',
}

/** Ce que la tradition conseille ce type de jour. */
export const LUNAR_DAY_ADVICE: Record<LunarDayType, string> = {
  racine: 'Favorable aux carottes, radis, poireaux, pommes de terre — et au travail du sol.',
  feuille: 'Favorable aux salades, épinards, choux et aromatiques à feuilles. Bon jour pour tondre.',
  fleur: 'Favorable aux fleurs, aux bulbes, aux brocolis et aux artichauts.',
  fruit: 'Favorable aux tomates, courgettes, haricots, fraisiers et arbres fruitiers. Bon jour pour cueillir.',
}

/** La montée et la descente de la Lune, ce que la tradition en fait. */
export const LUNAR_COURSE_ADVICE = {
  ascending: 'Lune montante : la tradition y place les semis et la récolte de ce qui pousse hors de terre.',
  descending: 'Lune descendante : la tradition y place les plantations, le repiquage et la taille.',
} as const

export const lunarDaySchema = z.object({
  /** Jour de référence, `YYYY-MM-DD`. */
  date: z.string(),
  dayType: lunarDayTypeSchema,
  phase: lunarPhaseSchema,
  /** Fraction éclairée, de 0 à 1. */
  illumination: z.number(),
  ascending: z.boolean(),
})

export type LunarDay = z.infer<typeof lunarDaySchema>

// ─── Calcul ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
const MS_PER_DAY = 86_400_000

/**
 * Décalage entre zodiaque tropical et sidéral (ayanamsa de Lahiri), environ
 * 24,2° en 2026, qui croît de 50 secondes d'arc par an.
 */
function ayanamsa(d: number): number {
  return 23.853 + (d / 365.25) * 0.013969
}

function norm(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/** Jours depuis J2000.0. */
function daysSinceJ2000(date: Date): number {
  return (date.getTime() - J2000) / MS_PER_DAY
}

/** Longitude et latitude écliptiques géocentriques de la Lune, en degrés. */
function moonEcliptic(d: number): { lon: number; lat: number } {
  const L = 218.316 + 13.176396 * d
  const M = 134.963 + 13.064993 * d
  const F = 93.272 + 13.22935 * d
  const D = 297.85 + 12.190749 * d
  const Ms = 357.529 + 0.98560028 * d

  const lon =
    L +
    6.289 * Math.sin(M * DEG) +
    1.274 * Math.sin((2 * D - M) * DEG) +
    0.658 * Math.sin(2 * D * DEG) +
    0.214 * Math.sin(2 * M * DEG) -
    0.186 * Math.sin(Ms * DEG) -
    0.114 * Math.sin(2 * F * DEG)
  const lat = 5.128 * Math.sin(F * DEG)
  return { lon: norm(lon), lat }
}

/** Longitude écliptique du Soleil, en degrés. */
function sunLongitude(d: number): number {
  const g = 357.528 + 0.9856003 * d
  return norm(280.46 + 0.9856474 * d + 1.915 * Math.sin(g * DEG) + 0.02 * Math.sin(2 * g * DEG))
}

/** Déclinaison de la Lune, en degrés. */
function moonDeclination(d: number): number {
  const { lon, lat } = moonEcliptic(d)
  const eps = 23.439 * DEG
  return Math.asin(
    Math.sin(lat * DEG) * Math.cos(eps) + Math.cos(lat * DEG) * Math.sin(eps) * Math.sin(lon * DEG),
  ) / DEG
}

/** Signes du zodiaque sidéral, du Bélier aux Poissons, et l'élément de chacun. */
const DAY_TYPE_BY_SIGN: LunarDayType[] = [
  'fruit', 'racine', 'fleur', 'feuille', // Bélier (feu), Taureau (terre), Gémeaux (air), Cancer (eau)
  'fruit', 'racine', 'fleur', 'feuille', // Lion, Vierge, Balance, Scorpion
  'fruit', 'racine', 'fleur', 'feuille', // Sagittaire, Capricorne, Verseau, Poissons
]

function phaseOf(elongation: number): LunarPhase {
  const index = Math.floor(((elongation + 22.5) % 360) / 45)
  return LUNAR_PHASES[index] ?? 'nouvelle'
}

/**
 * Le jour lunaire à l'instant donné. Pour un conseil « du jour », on passe
 * midi du jour civil de l'utilisateur : c'est la position que la plupart des
 * calendriers retiennent.
 */
export function computeLunarDay(instant: Date, date: string): LunarDay {
  const d = daysSinceJ2000(instant)
  const { lon } = moonEcliptic(d)
  const sidereal = norm(lon - ayanamsa(d))
  const sign = Math.floor(sidereal / 30)

  const elongation = norm(lon - sunLongitude(d))
  const illumination = (1 - Math.cos(elongation * DEG)) / 2

  return {
    date,
    dayType: DAY_TYPE_BY_SIGN[sign] ?? 'fruit',
    phase: phaseOf(elongation),
    illumination: Math.round(illumination * 100) / 100,
    ascending: moonDeclination(d + 0.5) > moonDeclination(d - 0.5),
  }
}
