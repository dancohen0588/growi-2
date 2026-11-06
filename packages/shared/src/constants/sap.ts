import { z } from 'zod'

/**
 * La Sève — ce que rapportent les gestes utiles au jardin et aux autres.
 *
 * Plan : `~/Growi/Documentation/spec/17-plan-seve.md` ; maquettes Claude
 * Design « Growi — La Sève ». Le principe : **ni classement, ni perte, ni
 * série à tenir**. La sève d'un compte n'est visible que par lui ; elle forme
 * des cernes, et l'on peut offrir des gouttes à un voisin pour le remercier.
 *
 * Tout ce qui suit est partagé tel quel par le serveur (qui crédite), le web
 * et le mobile (qui affichent) : un barème recopié dans l'app finirait par
 * promettre « +3 » là où le serveur donne « +2 ».
 */

// ─── Ce qui rapporte ───────────────────────────────────────────────────────

/**
 * `SapEntry.kind`.
 *
 * Un type s'ajoute en fin de liste et ne se renomme jamais : il est écrit
 * dans le journal de chaque compte.
 */
export const SAP_KINDS = [
  /** Un geste d'entretien noté (`CareLog`). */
  'care',
  /** Une tâche du planning cochée au plus tard le jour prévu. */
  'task_on_time',
  /** Une plante ajoutée au jardin, à la main ou par identification. */
  'plant_added',
  /** « Ça a marché ? » — le verdict posé sur l'essai d'un Secret. */
  'secret_feedback',
  /** Une publication de la Communauté. */
  'post',
  /** Un commentaire sur la publication de quelqu'un d'autre. */
  'comment',
  /** Une annonce de la bourse menée à son terme (`done`). */
  'listing_done',
  /** Une goutte offerte par un voisin. */
  'gift_received',
] as const
export const sapKindSchema = z.enum(SAP_KINDS)
export type SapKind = z.infer<typeof sapKindSchema>

export interface SapRule {
  /** Sève gagnée à chaque fois. */
  amount: number
  /**
   * Nombre de gains de ce type par jour **de l'utilisateur**, au-delà duquel
   * le geste n'en rapporte plus. `null` : pas de plafond — soit le geste est
   * déjà unique par nature (un verdict par essai), soit le plafond est
   * ailleurs (les gouttes reçues, limitées côté donneur).
   */
  dailyCap: number | null
}

/**
 * Le barème v1 (plan §2).
 *
 * Les plafonds empêchent qu'un compte se « farme » — noter vingt arrosages
 * d'une même plante, publier dix photos floues. Le partage rapporte plus que
 * l'usage solo : c'est l'esprit voulu.
 */
export const SAP_RULES: Record<SapKind, SapRule> = {
  care: { amount: 1, dailyCap: 10 },
  task_on_time: { amount: 2, dailyCap: 10 },
  plant_added: { amount: 2, dailyCap: 5 },
  secret_feedback: { amount: 5, dailyCap: null },
  post: { amount: 3, dailyCap: 1 },
  comment: { amount: 1, dailyCap: 5 },
  listing_done: { amount: 10, dailyCap: 2 },
  gift_received: { amount: 1, dailyCap: null },
}

/**
 * Libellé d'un gain quand le serveur n'en a pas figé de plus précis
 * (`SapEntry.label`). Écrit pour se lire après le montant : « +2 · Tâche
 * faite à temps ».
 */
export const SAP_KIND_LABELS: Record<SapKind, string> = {
  care: 'Geste noté',
  task_on_time: 'Tâche faite à temps',
  plant_added: 'Nouvelle plante',
  secret_feedback: 'Ton retour sur un Secret',
  post: 'Photo publiée',
  comment: 'Réponse à un voisin',
  listing_done: 'Échange à la bourse',
  gift_received: 'Goutte reçue',
}

// ─── Les cernes ────────────────────────────────────────────────────────────

/**
 * Seuils des cernes : le n-ième cerne est formé à `SAP_RING_THRESHOLDS[n-1]`.
 *
 * Rapprochés au début pour qu'un nouveau venu forme son premier cerne dans la
 * semaine, puis de plus en plus espacés. Au-delà de la liste, un cerne tous
 * les `SAP_RING_STEP_AFTER`.
 */
export const SAP_RING_THRESHOLDS = [50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000] as const
export const SAP_RING_STEP_AFTER = 1000

/** Le seuil du cerne `n` (1 pour le premier). */
export function sapRingThreshold(n: number): number {
  if (n < 1) return 0
  if (n <= SAP_RING_THRESHOLDS.length) return SAP_RING_THRESHOLDS[n - 1]
  const last = SAP_RING_THRESHOLDS[SAP_RING_THRESHOLDS.length - 1]
  return last + (n - SAP_RING_THRESHOLDS.length) * SAP_RING_STEP_AFTER
}

export interface SapRings {
  /** Cernes formés. */
  count: number
  /** Seuil du dernier cerne formé (0 avant le premier). */
  floor: number
  /** Seuil du cerne en train de se former. */
  next: number
  /** Avancement du cerne en cours, de 0 à 1. */
  progress: number
  /** Sève qu'il manque pour le former. */
  remaining: number
}

/**
 * Où en est la coupe du tronc pour un total donné.
 *
 * Fonction pure, appelée aux trois endroits qui l'affichent : le serveur la
 * renvoie dans le résumé, mais le mobile la recalcule pour animer le gain
 * avant même que la réponse arrive.
 */
export function sapRings(total: number): SapRings {
  const safe = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0

  let count = 0
  while (sapRingThreshold(count + 1) <= safe) count++

  const floor = sapRingThreshold(count)
  const next = sapRingThreshold(count + 1)
  const span = next - floor

  return {
    count,
    floor,
    next,
    progress: span > 0 ? (safe - floor) / span : 0,
    remaining: next - safe,
  }
}

// ─── Les gouttes offertes ──────────────────────────────────────────────────

/** Gouttes qu'un compte peut offrir par semaine ISO de son fuseau. */
export const SAP_GIFTS_PER_WEEK = 3

/** Longueur maximale du petit mot qui accompagne une goutte. */
export const SAP_GIFT_MESSAGE_MAX_LENGTH = 140

/** Pour quoi l'on remercie — `SapGift.reason`. */
export const SAP_GIFT_REASONS = ['conseil', 'bouture', 'jardin', 'aide'] as const
export const sapGiftReasonSchema = z.enum(SAP_GIFT_REASONS)
export type SapGiftReason = z.infer<typeof sapGiftReasonSchema>

/** Les pastilles de la feuille « Offrir une goutte ». */
export const SAP_GIFT_REASON_LABELS: Record<SapGiftReason, string> = {
  conseil: 'Son conseil',
  bouture: 'Sa bouture',
  jardin: 'Son jardin',
  aide: 'Son aide',
}

/** Ce que lit le receveur : « Camille t'a offert une goutte pour ta bouture ». */
export const SAP_GIFT_REASON_PHRASES: Record<SapGiftReason, string> = {
  conseil: 'pour ton conseil',
  bouture: 'pour ta bouture',
  jardin: 'pour ton jardin',
  aide: 'pour ton aide',
}

// ─── Ce que montre l'écran « Ta sève » ─────────────────────────────────────

export type SapRuleGroup = 'jardin' | 'partage'

export interface SapRuleDisplay {
  /** L'action, à l'infinitif : « Noter un geste ». */
  title: string
  /** Une précision sous le titre — un plafond, un « pour qui ». */
  hint: string | null
  group: SapRuleGroup
}

/**
 * La liste « Faire monter ta sève », dans l'ordre d'affichage.
 *
 * Partagée pour que le web et le mobile annoncent le même barème que celui
 * que le serveur applique : les montants viennent de `SAP_RULES`, jamais
 * d'ici. Les plafonds cités doivent suivre `SAP_RULES[kind].dailyCap`
 * (`sap.test.ts` le vérifie).
 */
export const SAP_RULE_DISPLAY: Record<SapKind, SapRuleDisplay> = {
  care: { title: 'Noter un geste', hint: '10 par jour au plus', group: 'jardin' },
  task_on_time: { title: 'Faire une tâche du planning à temps', hint: 'Le jour prévu ou avant', group: 'jardin' },
  plant_added: { title: 'Ajouter ou identifier une plante', hint: '5 par jour au plus', group: 'jardin' },
  secret_feedback: {
    title: 'Dire si un Secret a marché',
    hint: 'Ton retour aide à démêler les astuces des légendes',
    group: 'partage',
  },
  post: { title: 'Publier une photo', hint: 'Une par jour', group: 'partage' },
  comment: { title: 'Répondre à un voisin', hint: '5 par jour au plus', group: 'partage' },
  listing_done: { title: 'Mener un échange à la bourse', hint: 'Quand ton annonce trouve preneur', group: 'partage' },
  gift_received: { title: 'Recevoir une goutte d’un voisin', hint: 'Son merci pour un conseil, une bouture…', group: 'partage' },
}

/** « Premier cerne », « Deuxième cerne »… puis « 11ᵉ cerne ». */
const RING_ORDINALS = [
  'Premier',
  'Deuxième',
  'Troisième',
  'Quatrième',
  'Cinquième',
  'Sixième',
  'Septième',
  'Huitième',
  'Neuvième',
  'Dixième',
] as const

export function sapRingName(n: number): string {
  return n >= 1 && n <= RING_ORDINALS.length ? `${RING_ORDINALS[n - 1]} cerne` : `${n}ᵉ cerne`
}

/** « 1ᵉʳ », « 4ᵉ » — pour « ton 4ᵉ cerne se forme ». */
export function sapRingOrdinal(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`
}

// ─── Les phrases ───────────────────────────────────────────────────────────

/**
 * Partagées par le web et le mobile, pour que la carte de l'Accueil et
 * l'écran « Ta sève » disent la même chose des deux côtés.
 */

type RingsLike = Pick<SapRings, 'count' | 'progress' | 'remaining'>
interface SapEntryLike {
  kind: SapKind
  label?: string | null
}

/** Pour les lecteurs d'écran : « Coupe de ton tronc : 3 cernes formés, le 4ᵉ à 20 % ». */
export function sapRingsLabel(rings: RingsLike): string {
  const percent = Math.round(rings.progress * 100)
  const next = sapRingOrdinal(rings.count + 1)
  if (rings.count === 0) return `Coupe de ton tronc : ton ${next} cerne à ${percent} %`
  const formed = rings.count === 1 ? '1 cerne formé' : `${rings.count} cernes formés`
  return `Coupe de ton tronc : ${formed}, le ${next} à ${percent} %`
}

/** « Ton 4ᵉ cerne se forme · encore 160 » */
export function sapFormingLine(rings: RingsLike): string {
  return `Ton ${sapRingOrdinal(rings.count + 1)} cerne se forme · encore ${rings.remaining}`
}

/** « 3 cernes · ton 4ᵉ se forme » — sous le total, sur le bloc forest. */
export function sapRingsLine(rings: RingsLike): string {
  const next = sapRingOrdinal(rings.count + 1)
  if (rings.count === 0) return `Ton ${next} cerne se forme`
  return `${rings.count} cerne${rings.count > 1 ? 's' : ''} · ton ${next} se forme`
}

/** Ce qui a rapporté : le libellé figé par le serveur, sinon celui du type. */
export function sapEntryLabel(entry: SapEntryLike): string {
  return entry.label?.trim() || SAP_KIND_LABELS[entry.kind]
}

/** « +2 », jamais « 2 » : un gain se lit comme un gain. */
export function formatSapAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`
}

/**
 * Ce que dit l'annonce d'un gain qui en regroupe plusieurs (« Tout arrosé »
 * en crédite autant que de plantes) : le libellé quand il n'y en a qu'un, le
 * type et le nombre quand ils sont tous du même type.
 */
export function sapGainsLabel(entries: SapEntryLike[]): string {
  if (entries.length === 0) return 'Merci pour ton jardin'
  if (entries.length === 1) return sapEntryLabel(entries[0])
  const [first] = entries
  if (entries.every((entry) => entry.kind === first.kind)) {
    return `${SAP_KIND_LABELS[first.kind]} ×${entries.length}`
  }
  return 'Merci pour tes gestes'
}

// ─── Ce que débloquent les cernes (phase 6) ────────────────────────────────

/**
 * Décisions du 06/11/2026 : deux récompenses en v1, le **Secret en
 * avant-première** (un secret encore jamais vu rejoint le grimoire) et le
 * **thème d'Accueil** (un habillage du haut de l'Accueil). Les thèmes tombent
 * aux cernes 2, 4 et 6 ; **tous les autres cernes**, y compris au-delà,
 * donnent un secret, tant qu'il en reste à découvrir.
 *
 * Une récompense est **acquise pour toujours** : la sève ne se perd pas, et un
 * geste annulé qui ferait repasser sous un seuil ne reprend rien.
 */
export const SAP_HOME_THEMES = ['sous-bois', 'prairie', 'crepuscule'] as const
export const sapHomeThemeSchema = z.enum(SAP_HOME_THEMES)
export type SapHomeTheme = z.infer<typeof sapHomeThemeSchema>

export const SAP_HOME_THEME_LABELS: Record<SapHomeTheme, string> = {
  'sous-bois': 'Sous-bois',
  prairie: 'Prairie',
  crepuscule: 'Crépuscule',
}

/** Le cerne qui débloque chaque thème. */
export const SAP_THEME_RINGS: Record<SapHomeTheme, number> = {
  'sous-bois': 2,
  prairie: 4,
  crepuscule: 6,
}

export const SAP_REWARD_KINDS = ['secret', 'theme'] as const
export const sapRewardKindSchema = z.enum(SAP_REWARD_KINDS)
export type SapRewardKind = z.infer<typeof sapRewardKindSchema>

/** Ce que débloque le cerne `n` — fixé d'avance, pour pouvoir l'annoncer. */
export function sapRingReward(n: number): { kind: 'theme'; theme: SapHomeTheme } | { kind: 'secret' } {
  const theme = SAP_HOME_THEMES.find((key) => SAP_THEME_RINGS[key] === n)
  return theme ? { kind: 'theme', theme } : { kind: 'secret' }
}

/** « À débloquer : un Secret en avant-première » — la promesse d'un cerne à venir. */
export function sapRingRewardPromise(n: number): string {
  const reward = sapRingReward(n)
  return reward.kind === 'theme'
    ? `le thème d’Accueil « ${SAP_HOME_THEME_LABELS[reward.theme]} »`
    : 'un Secret en avant-première'
}

/** Ce qu'a donné un cerne formé, pour la liste des cernes. */
export function sapRewardUnlockedLine(reward: {
  kind: SapRewardKind
  value?: string | null
  title?: string | null
}): string {
  if (reward.kind === 'theme') return `Débloqué : le thème d’Accueil « ${reward.title ?? 'nouveau'} »`
  if (!reward.value) return 'Ton grimoire était déjà complet'
  return reward.title ? `Débloqué : « ${reward.title} » en avant-première` : 'Débloqué : un Secret en avant-première'
}

/** Ce que donnera un cerne à venir. */
export function sapRewardPendingLine(n: number): string {
  return `À débloquer : ${sapRingRewardPromise(n)}`
}
