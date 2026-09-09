/**
 * Catalogue des événements produit — **la seule liste qui fasse foi**.
 *
 * Un événement est un fait produit, nommé une fois, émis depuis le mobile, le
 * web ou le serveur avec exactement les mêmes propriétés. Le type ci-dessous
 * est une union discriminée par `name` : un nom absent du catalogue, ou une
 * propriété qui manque, **ne compile pas**. C'est tout l'intérêt — un
 * entonnoir ne se répare pas après coup, les données manquantes le sont pour
 * toujours.
 *
 * Trois règles à tenir en ajoutant un événement :
 *
 * 1. **Aucune propriété ne porte de texte saisi par un utilisateur.** Pas de
 *    message de chat, pas de nom de plante tapé à la main, pas de pseudo, pas
 *    d'adresse. `assertNoFreeText` sert de garde-fou en test.
 * 2. **On réutilise les types du domaine** (`CareLogType`, `ListingKind`,
 *    `AlertType`…) plutôt que d'écrire des chaînes libres : le jour où une
 *    valeur métier change, le catalogue ne compile plus, et c'est ce qu'on
 *    veut.
 * 3. **Nommage `domaine_action` en snake_case, en anglais** — convention
 *    PostHog, et pas d'accents dans les requêtes.
 *
 * Les propriétés communes (`surface`, `app_version`, `platform`,
 * `environment`) sont ajoutées par l'émetteur, jamais à la main.
 */

import type { ActionHorizon, AlertType } from '../schemas/planning'
import type { SocialProvider } from '../schemas/auth'
import type { CareLogType, HealthStatus } from '../constants/enums'
import type { ListingKind, ReportReason } from '../constants/community'

/** Canal d'inscription ou de connexion. */
export type AuthMethod = 'email' | SocialProvider

/** Pourquoi une connexion a échoué — jamais le message d'erreur brut. */
export type LoginFailureReason =
  | 'bad_credentials'
  | 'account_disabled'
  | 'token_invalid'
  | 'email_taken'
  | 'provider_unavailable'

/** D'où vient une plante ajoutée. */
export type PlantSource = 'catalog' | 'identify' | 'manual'

/**
 * Cause d'un échec d'appel au modèle.
 *
 * Ces valeurs sont celles que le serveur sait réellement distinguer (voir
 * `GeminiFailureCause` dans `lib/services/gemini.ts`) : le statut rendu par
 * l'API, la troncature, et l'échec de lecture du JSON. La spec citait
 * `image_too_large` — une image trop lourde est refusée bien avant l'appel,
 * par la validation, et ne produit donc aucun événement.
 */
export type AiFailureReason =
  | 'quota'
  | 'rate_limited'
  | 'gemini_unavailable'
  | 'bad_image'
  | 'truncated'
  | 'parse'
  | 'unknown'

/** Nature d'une notification poussée. */
export type PushKind = 'planning' | 'alert' | 'community'

export type GrowiEvent =
  // ─── Compte et onboarding ────────────────────────────────────────────────
  | { name: 'signup_completed'; props: { method: AuthMethod } }
  | { name: 'login_completed'; props: { method: AuthMethod } }
  | { name: 'login_failed'; props: { method: AuthMethod; reason: LoginFailureReason } }
  | { name: 'onboarding_screen_viewed'; props: { step: number; screen_id: string } }
  | { name: 'onboarding_completed'; props: { duration_s: number; skipped: boolean } }
  | { name: 'onboarding_skipped'; props: { at_step: number } }
  | { name: 'push_permission_answered'; props: { granted: boolean } }
  | { name: 'location_permission_answered'; props: { granted: boolean } }
  | { name: 'account_deleted'; props: Record<string, never> }

  // ─── Jardin et plantes ───────────────────────────────────────────────────
  | {
      name: 'garden_created'
      props: { has_location: boolean; from_cadastre: boolean; zones_count: number }
    }
  | { name: 'garden_plan_opened'; props: { garden_id: string } }
  | {
      name: 'plant_added'
      props: { source: PlantSource; garden_id: string | null; plants_total: number }
    }
  | { name: 'plant_removed'; props: { plants_total: number } }
  | {
      name: 'plant_detail_viewed'
      props: { from: 'garden' | 'list' | 'calendar' | 'identify' | 'community' }
    }
  | { name: 'care_logged'; props: { type: CareLogType; from: 'detail' | 'planning' | 'chat' } }

  // ─── Identification ──────────────────────────────────────────────────────
  | { name: 'identify_started'; props: { source: 'camera' | 'library' } }
  | {
      name: 'identify_completed'
      props: {
        model: string
        latency_ms: number
        input_tokens: number | null
        output_tokens: number | null
        image_bytes: number
        candidates_count: number
        /**
         * Le modèle rend un niveau, pas un score : `high | medium | low`.
         * Inventer un nombre à partir de là donnerait une fausse précision,
         * et les moyennes qu'on en tirerait ne voudraient rien dire.
         */
        top_confidence: 'high' | 'medium' | 'low' | null
        quota_remaining: number | null
      }
    }
  | { name: 'identify_failed'; props: { reason: AiFailureReason; model: string | null } }
  /** Le vrai indicateur de qualité du modèle : quel candidat a été retenu. */
  | { name: 'identify_result_accepted'; props: { rank: number } }
  | { name: 'identify_result_rejected'; props: Record<string, never> }

  // ─── Diagnostic ──────────────────────────────────────────────────────────
  | { name: 'diagnosis_started'; props: { has_photo: boolean; has_symptoms_text: boolean } }
  | {
      name: 'diagnosis_completed'
      props: {
        model: string
        latency_ms: number
        input_tokens: number | null
        output_tokens: number | null
        severity: HealthStatus
        actions_proposed: number
      }
    }
  | { name: 'diagnosis_failed'; props: { reason: AiFailureReason } }
  | {
      name: 'diagnosis_actions_applied'
      props: { actions_count: number; actions_edited: boolean }
    }
  | { name: 'diagnosis_reviewed'; props: { outcome: 'better' | 'same' | 'worse' } }

  // ─── Planning ────────────────────────────────────────────────────────────
  | { name: 'planning_viewed'; props: { horizon: ActionHorizon; actions_today: number } }
  | {
      name: 'planning_action_done'
      props: { type: CareLogType; bulk: boolean; count: number; overdue_days: number | null }
    }
  | { name: 'planning_action_undone'; props: Record<string, never> }
  /**
   * `count` est nul quand le serveur ne sait pas combien d'actions ont été
   * mises en sourdine : le masquage pose une date sur le jardin, il ne
   * parcourt pas le planning — le recalculer pour compter coûterait plus cher
   * que le geste lui-même.
   */
  | { name: 'planning_cleared_today'; props: { count: number | null } }
  | { name: 'alert_shown'; props: { kind: AlertType } }
  | { name: 'alert_opened'; props: { kind: AlertType } }

  // ─── Assistant ───────────────────────────────────────────────────────────
  | { name: 'assistant_opened'; props: { from: 'plant' | 'garden' | 'home' | 'action' } }
  | { name: 'assistant_message_sent'; props: { conversation_turn: number; has_tools: boolean } }
  | {
      name: 'assistant_reply_completed'
      props: {
        model: string
        latency_ms: number
        input_tokens: number | null
        output_tokens: number | null
        tools_called: string[]
        truncated: boolean
      }
    }
  | { name: 'assistant_proposal_accepted'; props: { proposal_type: string } }
  | { name: 'assistant_quota_hit'; props: Record<string, never> }

  // ─── Communauté ──────────────────────────────────────────────────────────
  | { name: 'community_activated'; props: Record<string, never> }
  | { name: 'community_feed_viewed'; props: { posts_count: number; scope: 'nearby' | 'following' } }
  | { name: 'post_published'; props: { has_photo: boolean } }
  | { name: 'post_liked'; props: Record<string, never> }
  | { name: 'comment_posted'; props: Record<string, never> }
  | { name: 'listing_published'; props: { kind: ListingKind } }
  | { name: 'listing_interest_sent'; props: Record<string, never> }
  | { name: 'thread_message_sent'; props: { thread_kind: 'listing' | 'direct' } }
  | { name: 'user_followed'; props: Record<string, never> }
  | { name: 'user_blocked'; props: Record<string, never> }
  | { name: 'content_reported'; props: { reason: ReportReason } }

  // ─── Notifications et contenu ────────────────────────────────────────────
  | { name: 'push_sent'; props: { kind: PushKind; tokens_count: number } }
  | { name: 'push_opened'; props: { kind: PushKind } }
  | { name: 'push_token_invalid'; props: { platform: 'ios' | 'android' } }
  | { name: 'article_viewed'; props: { slug: string; from: 'home' | 'list' | 'push' } }
  | { name: 'contact_sent'; props: Record<string, never> }

/** Tous les noms du catalogue. */
export type GrowiEventName = GrowiEvent['name']

/** Les propriétés d'un événement donné, par son nom. */
export type GrowiEventProps<N extends GrowiEventName> = Extract<GrowiEvent, { name: N }>['props']

/**
 * Propriétés de **personne** — un état, pas un événement : elles sont
 * écrasées à chaque mise à jour et décrivent le compte tel qu'il est
 * aujourd'hui. C'est ce qui permet de filtrer un tableau de bord sur « les
 * testeurs » ou « ceux qui ont activé la communauté ».
 */
export interface PersonProperties {
  signup_method: AuthMethod
  /** Date ISO. */
  signup_at: string
  onboarding_completed: boolean
  gardens_count: number
  plants_count: number
  community_activated: boolean
  push_granted: boolean
  last_platform: 'ios' | 'android' | 'web'
  /**
   * Posé **à la main** sur les comptes de la Friends & Family, jamais par le
   * code : c'est ce qui permet d'exclure Quentin et Dan des tableaux de bord.
   */
  is_tester_ff: boolean
}

/**
 * Propriétés ajoutées automatiquement par l'émetteur, sur chaque événement.
 * Aucun appelant ne les passe : les répéter, c'est prendre le risque qu'elles
 * divergent d'un écran à l'autre.
 */
export const COMMON_PROPS_KEYS = ['surface', 'app_version', 'platform', 'environment'] as const

export type CommonPropKey = (typeof COMMON_PROPS_KEYS)[number]

/**
 * Longueur maximale d'une chaîne dans les propriétés d'un événement.
 *
 * Ce n'est pas une limite technique mais un **détecteur de texte libre** : nos
 * valeurs sont des énumérations, des slugs et des identifiants, tous très
 * courts. Une chaîne plus longue est presque toujours une phrase saisie par
 * quelqu'un, qui n'a rien à faire dans un outil d'analyse.
 */
export const MAX_PROP_LENGTH = 64

/**
 * Vérifie qu'aucune propriété ne porte de texte libre.
 *
 * Utilisée en test sur un échantillon d'événements ; on ne l'appelle pas à
 * chaque envoi, car un garde-fou qui lève en production ferait tomber l'app
 * pour une raison d'observabilité — exactement ce qu'on s'interdit.
 *
 * @throws Error en nommant la propriété fautive.
 */
export function assertNoFreeText(props: Record<string, unknown>, eventName = 'inconnu'): void {
  for (const [key, value] of Object.entries(props)) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (typeof item === 'string' && item.length > MAX_PROP_LENGTH) {
        throw new Error(
          `[analytics] ${eventName}.${key} dépasse ${MAX_PROP_LENGTH} caractères : ` +
            'une propriété d’événement ne doit jamais porter de texte saisi par un utilisateur.',
        )
      }
    }
  }
}
