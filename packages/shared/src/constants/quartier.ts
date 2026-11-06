import { z } from 'zod'

/**
 * La sève du quartier (phase 7 du plan `~/Growi/Documentation/spec/17-plan-seve.md`).
 *
 * Un **défi coopératif par semaine**, tiré d'une bibliothèque saisonnière : le
 * quartier avance ensemble vers un objectif (« Paillons 60 plantes avant le
 * froid »), sans classement entre voisins. Décisions du 06/11/2026 :
 *
 * - le quartier est le **rayon Communauté** de chacun, **élargi** de proche en
 *   proche jusqu'à toute la France tant qu'il y a moins de
 *   `QUARTIER_MIN_GARDENERS` jardiniers dedans — sans quoi, à l'échelle des
 *   premiers testeurs, chaque défi se jouerait seul ;
 * - n'y comptent que les **profils publics** (Communauté activée) ;
 * - les gouttes nommées ne sont montrées qu'à ceux qui les ont offertes ou
 *   reçues ; le quartier n'en voit que le nombre ;
 * - les défis sont **écrits ici**, tirés chaque lundi selon la saison.
 */

/** En deçà, le quartier s'élargit au palier suivant. */
export const QUARTIER_MIN_GARDENERS = 8

/** Les paliers d'élargissement, en km, après le rayon choisi. `null` : toute la France. */
export const QUARTIER_RADIUS_STEPS = [50, 100, 200, 500] as const

/** Sève de fin de défi : pour avoir participé, et pour l'avoir réussi ensemble. */
export const QUARTIER_PARTICIPATION_SAP = 5
export const QUARTIER_SUCCESS_SAP = 20

/** Fenêtre de « Ce qui a circulé » et des « Secrets qui marchent ici ». */
export const QUARTIER_CIRCULATION_DAYS = 30
export const QUARTIER_SECRETS_DAYS = 180

/**
 * Un secret n'est cité qu'à partir de ce nombre de retours dans le quartier :
 * en dessous, « 1 voisin sur 1 » désignerait quelqu'un.
 */
export const QUARTIER_SECRET_MIN_VERDICTS = 3

/** Ce que compte un défi. Les gestes se lisent au journal (`CareLog`). */
export type QuartierMetric =
  | { kind: 'care'; types?: string[]; ruleIds?: string[]; noteIncludes?: string[] }
  | { kind: 'secret_trial' }
  | { kind: 'post' }
  | { kind: 'gift' }
  | { kind: 'listing_done' }

/** Où mène le bouton du défi. */
export const QUARTIER_ACTION_TARGETS = ['calendrier', 'plantes', 'publier', 'bourse', 'communaute'] as const
export type QuartierActionTarget = (typeof QUARTIER_ACTION_TARGETS)[number]

export interface QuartierChallengeDef {
  /** Figé : il est recopié dans `quartier_weeks` et `quartier_results`. */
  slug: string
  /** `{n}` reçoit l'objectif : « Paillons {n} plantes avant le froid ». */
  title: string
  /** Ce que compte la barre : « plante paillée » / « plantes paillées ». */
  unit: { one: string; many: string }
  metric: QuartierMetric
  /** Mois (1-12) où le défi peut être tiré. */
  months: number[]
  /** Objectif = `perGardener` × jardiniers du quartier, et au moins `minTarget`. */
  perGardener: number
  minTarget: number
  action: { label: string; target: QuartierActionTarget }
}

const ALL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * La bibliothèque. Un défi s'ajoute en fin de liste ; un slug ne se renomme
 * jamais. Chaque mois doit en proposer au moins deux, pour ne jamais tirer
 * deux semaines de suite le même (`quartier.test.ts` le vérifie).
 */
export const QUARTIER_CHALLENGES: QuartierChallengeDef[] = [
  {
    slug: 'paillage',
    title: 'Paillons {n} plantes avant le froid',
    unit: { one: 'plante paillée', many: 'plantes paillées' },
    metric: { kind: 'care', ruleIds: ['r13-mulching'], noteIncludes: ['paill'] },
    months: [3, 4, 10, 11, 12],
    perGardener: 3,
    minTarget: 15,
    action: { label: 'Noter un paillage', target: 'calendrier' },
  },
  {
    slug: 'hivernage',
    title: 'Mettons {n} plantes à l’abri du gel',
    unit: { one: 'plante protégée', many: 'plantes protégées' },
    metric: { kind: 'care', ruleIds: ['r14-winter-prep', 'r10-frost-alert'], noteIncludes: ['hivern', 'voile', 'abri'] },
    months: [11, 12, 1, 2],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Voir mes gestes du jour', target: 'calendrier' },
  },
  {
    slug: 'taille',
    title: 'Taillons {n} plantes ensemble',
    unit: { one: 'taille notée', many: 'tailles notées' },
    metric: { kind: 'care', types: ['pruning'] },
    months: [2, 3, 6, 9, 11],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Noter une taille', target: 'plantes' },
  },
  {
    slug: 'semis',
    title: 'Lançons {n} semis cette semaine',
    unit: { one: 'semis lancé', many: 'semis lancés' },
    metric: { kind: 'care', types: ['sowing'] },
    months: [2, 3, 4, 5, 8],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Noter un semis', target: 'plantes' },
  },
  {
    slug: 'rempotage',
    title: 'Rempotons {n} plantes',
    unit: { one: 'rempotage', many: 'rempotages' },
    metric: { kind: 'care', types: ['repotting'] },
    months: [3, 4, 9],
    perGardener: 1,
    minTarget: 8,
    action: { label: 'Noter un rempotage', target: 'plantes' },
  },
  {
    slug: 'arrosage-malin',
    title: 'Notons {n} arrosages au bon moment',
    unit: { one: 'arrosage noté', many: 'arrosages notés' },
    metric: { kind: 'care', types: ['watering'] },
    months: [5, 6, 7, 8, 9],
    perGardener: 8,
    minTarget: 40,
    action: { label: 'Voir les arrosages du jour', target: 'calendrier' },
  },
  {
    slug: 'fleurs-fanees',
    title: 'Coupons les fleurs fanées de {n} plantes',
    unit: { one: 'plante nettoyée', many: 'plantes nettoyées' },
    metric: { kind: 'care', ruleIds: ['r15-deadheading'], noteIncludes: ['fan'] },
    months: [5, 6, 7, 8, 9],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Voir mes gestes du jour', target: 'calendrier' },
  },
  {
    slug: 'recolte',
    title: 'Récoltons {n} fois cette semaine',
    unit: { one: 'récolte', many: 'récoltes' },
    metric: { kind: 'care', types: ['harvest'] },
    months: [6, 7, 8, 9, 10],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Noter une récolte', target: 'plantes' },
  },
  {
    slug: 'nourrir',
    title: 'Nourrissons {n} plantes',
    unit: { one: 'apport noté', many: 'apports notés' },
    metric: { kind: 'care', types: ['fertilizing'] },
    months: [4, 5, 6],
    perGardener: 2,
    minTarget: 10,
    action: { label: 'Noter un apport', target: 'plantes' },
  },
  {
    slug: 'secrets',
    title: 'Testons {n} Secrets de jardinier',
    unit: { one: 'Secret testé', many: 'Secrets testés' },
    metric: { kind: 'secret_trial' },
    months: ALL_YEAR,
    perGardener: 1,
    minTarget: 5,
    action: { label: 'Voir le Secret de la semaine', target: 'calendrier' },
  },
  {
    slug: 'photos',
    title: 'Partageons {n} photos de nos jardins',
    unit: { one: 'photo partagée', many: 'photos partagées' },
    metric: { kind: 'post' },
    months: [4, 5, 6, 7, 8, 9, 10],
    perGardener: 1,
    minTarget: 5,
    action: { label: 'Publier une photo', target: 'publier' },
  },
  {
    slug: 'mercis',
    title: 'Offrons {n} gouttes entre voisins',
    unit: { one: 'goutte offerte', many: 'gouttes offertes' },
    metric: { kind: 'gift' },
    months: ALL_YEAR,
    perGardener: 1,
    minTarget: 5,
    action: { label: 'Remercier un voisin', target: 'communaute' },
  },
  {
    slug: 'bourse',
    title: 'Faisons circuler {n} graines et boutures',
    unit: { one: 'échange mené à bien', many: 'échanges menés à bien' },
    metric: { kind: 'listing_done' },
    months: [2, 3, 4, 5, 9, 10],
    perGardener: 0.5,
    minTarget: 3,
    action: { label: 'Ouvrir la bourse', target: 'bourse' },
  },
]

export function quartierChallenge(slug: string): QuartierChallengeDef | undefined {
  return QUARTIER_CHALLENGES.find((challenge) => challenge.slug === slug)
}

/** Un objectif rond, qui grandit avec le quartier : 7 × 3 → 25, jamais moins que le plancher. */
export function quartierTarget(challenge: QuartierChallengeDef, gardeners: number): number {
  const raw = Math.max(challenge.minTarget, challenge.perGardener * Math.max(0, gardeners))
  const step = raw >= 100 ? 10 : 5
  return Math.max(challenge.minTarget, Math.ceil(raw / step) * step)
}

export function quartierTitle(challenge: QuartierChallengeDef, target: number): string {
  return challenge.title.replace('{n}', String(target))
}

export function quartierUnit(challenge: QuartierChallengeDef, count: number): string {
  return count > 1 ? challenge.unit.many : challenge.unit.one
}

/** FNV-1a + brassage final de Murmur, dans [0, 1) — comme le tirage des secrets. */
function unitHash(seed: string): number {
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
 * Le défi d'une semaine : tiré parmi ceux de la saison (le mois du jeudi de la
 * semaine ISO), jamais celui de la semaine précédente. Déterministe pour une
 * clé de semaine — mais le serveur **fige** son tirage en base, pour qu'une
 * retouche de la bibliothèque ne change pas un défi en cours.
 */
export function pickQuartierChallenge(
  week: string,
  month: number,
  previousSlug: string | null,
): QuartierChallengeDef {
  const inSeason = QUARTIER_CHALLENGES.filter((challenge) => challenge.months.includes(month))
  const candidates = inSeason.filter((challenge) => challenge.slug !== previousSlug)
  const pool = candidates.length ? candidates : inSeason.length ? inSeason : QUARTIER_CHALLENGES
  return pool[Math.floor(unitHash(`quartier:${week}`) * pool.length)]
}

// ─── API ───────────────────────────────────────────────────────────────────

const isoDateTime = z.string().datetime({ offset: true })

/** `GET /api/v1/community/quartier`. */
export const quartierSchema = z.object({
  /** Le rayon retenu, élargi au besoin ; `null` : toute la France. */
  radiusKm: z.number().int().nullable(),
  /** Le rayon que l'utilisateur a choisi, pour dire qu'on l'a élargi. */
  chosenRadiusKm: z.number().int(),
  /** Profils publics dans le quartier, l'utilisateur compris. */
  gardeners: z.number().int().min(0),
  challenge: z
    .object({
      slug: z.string(),
      week: z.string(),
      title: z.string(),
      /** « plantes paillées », accordé à `progress`. */
      unitLabel: z.string(),
      target: z.number().int().min(1),
      progress: z.number().int().min(0),
      participants: z.number().int().min(0),
      /** Les initiales de quelques participants, sans plus. */
      participantInitials: z.array(z.string()),
      mine: z.number().int().min(0),
      endsAt: isoDateTime,
      daysLeft: z.number().int().min(0),
      reached: z.boolean(),
      participationSap: z.number().int(),
      successSap: z.number().int(),
      action: z.object({ label: z.string(), target: z.enum(QUARTIER_ACTION_TARGETS) }),
    })
    .nullable(),
  circulation: z.object({
    days: z.number().int(),
    exchanges: z.number().int().min(0),
    gifts: z.number().int().min(0),
    secretsTried: z.number().int().min(0),
  }),
  secrets: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      worked: z.number().int().min(0),
      total: z.number().int().min(1),
    }),
  ),
  thanks: z.object({
    /** Gouttes offertes dans le quartier cette semaine, toutes confondues. */
    weekCount: z.number().int().min(0),
    /** Celles que l'utilisateur a offertes ou reçues cette semaine. */
    mine: z.array(
      z.object({
        direction: z.enum(['received', 'sent']),
        handle: z.string(),
        reason: z.string(),
        message: z.string().nullable(),
        createdAt: isoDateTime,
      }),
    ),
  }),
})
export type Quartier = z.infer<typeof quartierSchema>
