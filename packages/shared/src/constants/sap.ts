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
