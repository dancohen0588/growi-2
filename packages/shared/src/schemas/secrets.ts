import { z } from 'zod'

import { isCautionArt, isSecretArt } from '../secrets/art'
import { idSchema, nullish } from './common'

/**
 * « Secrets de jardinier » — les astuces de tradition que le planning propose
 * une fois par semaine (coquilles d'œuf, purin d'ortie, eau de banane…).
 *
 * Spec : `~/Growi/Documentation/spec/16-analyse-moteur-reco-secrets.md`.
 * La bibliothèque vit en base (`garden_tips`), éditable depuis `/admin/secrets`.
 */

// ─── Niveau de preuve ──────────────────────────────────────────────────────

/**
 * Le niveau de preuve est **affiché sur la carte** (décision du 05/11/2026) :
 * un remède sans effet présenté comme sûr fait perdre la confiance au premier
 * échec. Le mystère vient du dévoilement, pas d'une promesse.
 */
export const SECRET_EVIDENCES = ['PROVEN', 'PLAUSIBLE', 'FOLK', 'MYTH'] as const
export const secretEvidenceSchema = z.enum(SECRET_EVIDENCES)
export type SecretEvidence = z.infer<typeof secretEvidenceSchema>

export const SECRET_EVIDENCE_LABELS: Record<SecretEvidence, string> = {
  PROVEN: 'Éprouvé',
  PLAUSIBLE: 'Ça peut aider',
  FOLK: 'Tradition',
  MYTH: 'Légende démêlée',
}

/** Une phrase pour dire ce que vaut le badge, dans le détail. */
export const SECRET_EVIDENCE_HINTS: Record<SecretEvidence, string> = {
  PROVEN: 'Son effet est bien documenté.',
  PLAUSIBLE: 'Un effet réel mais partiel, qui dépend du contexte. Essaie sur un pied, garde l’autre en témoin.',
  FOLK: 'Transmis de génération en génération, sans preuve solide. Le plaisir d’essayer compte autant que le résultat.',
  MYTH: 'Une idée répandue qui ne tient pas — et ce qui marche à la place.',
}

export const SECRET_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export const secretStatusSchema = z.enum(SECRET_STATUSES)
export type SecretStatus = z.infer<typeof secretStatusSchema>

// ─── Conditions ────────────────────────────────────────────────────────────

const monthSchema = z.number().int().min(1).max(12)

/**
 * À quelles plantes, et quand, un secret s'adresse. Toutes les conditions
 * présentes doivent être remplies (ET) ; une condition absente ne filtre rien.
 */
export const secretConditionsSchema = z.object({
  /** Catégories du catalogue (`VEGETABLE`, `FLOWERS`…). */
  categories: z.array(z.string()).optional(),
  /**
   * Familles botaniques, en latin (`Rosaceae`). Le catalogue en écrit aussi en
   * français (« Solanacées ») : la comparaison les ramène à la même forme.
   */
  families: z.array(z.string()).optional(),
  /**
   * Genres — le premier mot du nom scientifique (`Rosa`, `Hydrangea`). Plus
   * stable qu'un slug du catalogue, et couvre toutes les variétés d'un coup.
   */
  genera: z.array(z.string()).optional(),
  /** Familles exclues — les plantes de terre de bruyère pour les cendres. */
  excludeFamilies: z.array(z.string()).optional(),
  excludeGenera: z.array(z.string()).optional(),
  months: z.array(monthSchema).optional(),
  locations: z.array(z.enum(['OUTDOOR', 'INDOOR', 'GREENHOUSE', 'BALCONY'])).optional(),
  edible: z.boolean().optional(),
  /** Exclut les plantes marquées toxiques au catalogue. */
  notToxic: z.boolean().optional(),
  /** Seulement une plante qui va bien — ou au contraire qui souffre. */
  healthStatus: z.array(z.string()).optional(),
  /** Seulement si l'utilisateur a activé le calendrier lunaire. */
  lunarOnly: z.boolean().optional(),
  /** Déclencheur météo : un secret « de saison » devient « du moment ». */
  weather: z
    .object({
      tempMaxAbove: z.number().optional(),
      tempMinBelow: z.number().optional(),
      rainyRecently: z.boolean().optional(),
    })
    .optional(),
})

export type SecretConditions = z.infer<typeof secretConditionsSchema>

// ─── La planche ────────────────────────────────────────────────────────────

const artKeySchema = z
  .string()
  .max(80)
  .refine(isSecretArt, { message: 'Dessin inconnu : il doit exister dans packages/shared/src/secrets/art.ts.' })

/**
 * Une case de la planche : un dessin du registre et sa légende. `emphasis` est
 * un fragment exact de la légende, mis en gras.
 */
export const secretPanelSchema = z
  .object({
    art: artKeySchema.refine((key) => !isCautionArt(key), { message: 'Ce dessin est une précaution, pas une case.' }),
    caption: z.string().trim().min(3).max(140),
    emphasis: z.string().trim().max(80).optional(),
  })
  .refine((panel) => !panel.emphasis || panel.caption.includes(panel.emphasis), {
    message: 'Le passage en gras doit être recopié tel quel depuis la légende.',
    path: ['emphasis'],
  })

export type SecretPanel = z.infer<typeof secretPanelSchema>

/**
 * La planche BD d'un secret (direction validée le 05/11/2026) : de une à
 * quatre cases d'étape, et une case de précaution. Un secret sans planche
 * s'affiche en texte, comme avant.
 */
export const secretPlancheSchema = z.object({
  panels: z.array(secretPanelSchema).min(1).max(4),
  caution: nullish(
    z.object({
      art: artKeySchema.refine(isCautionArt, { message: 'Ce dessin est une case, pas une précaution.' }),
      title: z.string().trim().min(3).max(60),
      text: z.string().trim().min(3).max(200),
    }),
  ),
})

export type SecretPlanche = z.infer<typeof secretPlancheSchema>

// ─── Le secret porté par une action du planning ────────────────────────────

/**
 * Trois moments d'un secret dans le planning :
 * - `discover` — le secret de la semaine, à dévoiler ;
 * - `ready` — une préparation lancée (purin, macération) est prête ;
 * - `feedback` — « Ça a marché ? », une semaine après l'essai.
 * Seul `discover` compte dans le rythme d'un secret par semaine.
 */
export const SECRET_STAGES = ['discover', 'ready', 'feedback'] as const
export const secretStageSchema = z.enum(SECRET_STAGES)
export type SecretStage = z.infer<typeof secretStageSchema>

export const gardenSecretSchema = z.object({
  slug: z.string(),
  stage: secretStageSchema,
  title: z.string(),
  /** L'accroche, visible avant le dévoilement. */
  teaser: z.string(),
  evidence: secretEvidenceSchema,
  /** L'histoire, le pourquoi de la tradition. */
  story: nullish(z.string()),
  /** La recette, en étapes courtes séparées par des retours à la ligne. */
  recipe: z.string(),
  ingredients: z.array(z.string()),
  cautions: nullish(z.string()),
  /** Jours de préparation avant usage — 0 si l'on s'en sert tout de suite. */
  prepDays: z.number().int(),
  effortMinutes: nullish(z.number().int()),
  /** Pour `ready` et `feedback` : le geste « je tente » d'origine. */
  trialCareLogId: z.string().optional(),
  /** La planche BD — absente tant que le secret n'est pas dessiné. */
  planche: nullish(secretPlancheSchema),
})

export type GardenSecret = z.infer<typeof gardenSecretSchema>

/** Règles du moteur qui portent un secret — voir `CareLog.ruleId`. */
export const SECRET_RULE_IDS = {
  discover: 'r20-secret',
  ready: 'r20-secret-ready',
  feedback: 'r20-secret-feedback',
} as const satisfies Record<SecretStage, string>

export const secretSlugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

// ─── Retour d'expérience et refus ──────────────────────────────────────────

export const SECRET_VERDICTS = ['WORKED', 'MEH', 'FAILED'] as const
export const secretVerdictSchema = z.enum(SECRET_VERDICTS)
export type SecretVerdict = z.infer<typeof secretVerdictSchema>

export const SECRET_VERDICT_LABELS: Record<SecretVerdict, string> = {
  WORKED: 'Oui, ça a marché',
  MEH: 'Bof, pas flagrant',
  FAILED: 'Non, rien vu',
}

/** Corps de `POST /api/v1/secrets/feedback`. */
export const secretFeedbackSchema = z.object({
  /** Le geste « je tente » auquel répond le verdict. */
  careLogId: idSchema,
  verdict: secretVerdictSchema,
})

export type SecretFeedbackInput = z.infer<typeof secretFeedbackSchema>

/** Corps de `POST /api/v1/secrets/dismiss` — « Pas pour moi ». */
export const dismissSecretSchema = z.object({
  slug: secretSlugSchema,
})

export type DismissSecretInput = z.infer<typeof dismissSecretSchema>

// ─── Grimoire ──────────────────────────────────────────────────────────────

/**
 * Une entrée du grimoire. Un secret non découvert ne montre que son titre,
 * son accroche et son badge : la recette se mérite.
 */
export const grimoireEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  teaser: z.string(),
  evidence: secretEvidenceSchema,
  discovered: z.boolean(),
  /** Dernier essai — ISO. */
  triedAt: nullish(z.string()),
  /** Nombre d'essais, toutes plantes confondues. */
  trials: z.number().int(),
  verdict: nullish(secretVerdictSchema),
  dismissed: z.boolean(),
  /** Seulement pour un secret découvert. */
  recipe: nullish(z.string()),
  story: nullish(z.string()),
  ingredients: z.array(z.string()),
  cautions: nullish(z.string()),
  /** Seulement pour un secret découvert, et dessiné. */
  planche: nullish(secretPlancheSchema),
})

export type GrimoireEntry = z.infer<typeof grimoireEntrySchema>

export const grimoireSchema = z.object({
  discovered: z.number().int(),
  total: z.number().int(),
  entries: z.array(grimoireEntrySchema),
})

export type Grimoire = z.infer<typeof grimoireSchema>

// ─── Administration ────────────────────────────────────────────────────────

/** Un texte facultatif : vide ou blanc vaut absent. */
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  )

/** Formulaire de `/admin/secrets/[id]`. */
export const updateGardenTipSchema = z.object({
  title: z.string().trim().min(3).max(80),
  teaser: z.string().trim().min(10).max(160),
  story: optionalText(800),
  recipe: z.string().trim().min(20).max(1500),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(12),
  evidence: secretEvidenceSchema,
  cautions: optionalText(500),
  prepDays: z.number().int().min(0).max(60),
  effortMinutes: z.number().int().min(1).max(240).optional(),
  cooldownDays: z.number().int().min(7).max(730),
  conditions: secretConditionsSchema,
  status: secretStatusSchema,
  /** `null` retire la planche : le secret repasse en texte. */
  planche: secretPlancheSchema.nullable().optional(),
})

export type UpdateGardenTipInput = z.infer<typeof updateGardenTipSchema>
