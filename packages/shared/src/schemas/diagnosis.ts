import { z } from 'zod'

import { healthStatusSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'
import { actionTypeSchema } from './planning'

/**
 * Contrats du diagnostic IA — `POST /api/v1/plants/[id]/diagnose` et les
 * routes d'historique.
 *
 * À la différence de l'identification, qui part d'une photo inconnue, le
 * diagnostic porte toujours sur une `PlantInstance` de l'utilisateur : le
 * modèle reçoit la photo *et* le contexte que Growi connaît déjà (fiche
 * catalogue, jardin, météo, journal d'entretien).
 */

/** Confiance du modèle dans son propre diagnostic. */
export const DIAGNOSIS_CONFIDENCES = ['high', 'medium', 'low'] as const
export const diagnosisConfidenceSchema = z.enum(DIAGNOSIS_CONFIDENCES)
export type DiagnosisConfidence = z.infer<typeof diagnosisConfidenceSchema>

/** Probabilité d'une cause parmi les hypothèses avancées. */
export const DIAGNOSIS_LIKELIHOODS = ['likely', 'possible', 'unlikely'] as const
export const diagnosisLikelihoodSchema = z.enum(DIAGNOSIS_LIKELIHOODS)
export type DiagnosisLikelihood = z.infer<typeof diagnosisLikelihoodSchema>

/** Urgence d'une recommandation. */
export const DIAGNOSIS_PRIORITIES = ['urgent', 'soon', 'watch'] as const
export const diagnosisPrioritySchema = z.enum(DIAGNOSIS_PRIORITIES)
export type DiagnosisPriority = z.infer<typeof diagnosisPrioritySchema>

export const DIAGNOSIS_LIKELIHOOD_LABELS: Record<DiagnosisLikelihood, string> = {
  likely: 'Probable',
  possible: 'Possible',
  unlikely: 'Peu probable',
}

export const DIAGNOSIS_PRIORITY_LABELS: Record<DiagnosisPriority, string> = {
  urgent: 'Urgent',
  soon: 'Bientôt',
  watch: 'À surveiller',
}

export const DIAGNOSIS_CONFIDENCE_LABELS: Record<DiagnosisConfidence, string> = {
  high: 'Confiance élevée',
  medium: 'Confiance moyenne',
  low: 'Confiance faible',
}

export const diagnosisCauseSchema = z.object({
  /** « Coup de chaleur », « Oïdium »… */
  label: z.string(),
  likelihood: diagnosisLikelihoodSchema,
  /** 1-2 phrases, cite le contexte quand il éclaire la cause. */
  explanation: z.string(),
})

export type DiagnosisCause = z.infer<typeof diagnosisCauseSchema>

export const diagnosisRecommendationSchema = z.object({
  /** À l'impératif, en détail : « Arrose abondamment ce soir, au pied ». */
  action: z.string(),
  /**
   * Le même geste en trois ou quatre mots — « Arroser au pied ».
   *
   * C'est lui qui titre la carte du planning ; `action` devient le détail.
   * Facultatif comme les deux champs suivants : les diagnostics antérieurs
   * n'en ont pas, et la planification sait alors abréger `action` elle-même.
   */
  shortAction: z.string().optional(),
  priority: diagnosisPrioritySchema,
  /** « aujourd'hui », « cette semaine »… */
  timeframe: z.string(),
  /**
   * Geste du planning correspondant, quand la recommandation en désigne un.
   *
   * Ces deux champs sont **facultatifs** : les diagnostics déjà en base ont été
   * écrits avant qu'on les demande au modèle, et leur payload doit rester
   * lisible. La planification a ses replis (priorité → échéance, `autre` par
   * défaut) pour les traiter comme les autres.
   */
  actionType: actionTypeSchema.optional(),
  /** Échéance en jours à partir d'aujourd'hui — 0 = aujourd'hui. */
  dueInDays: z.number().int().min(0).optional(),
})

export type DiagnosisRecommendation = z.infer<typeof diagnosisRecommendationSchema>

/**
 * Diagnostic abouti.
 *
 * Les bornes de cardinalité (2-4 observations, 2-5 recommandations) sont
 * demandées au modèle dans le prompt mais **non imposées ici** : un modèle qui
 * rend une observation de moins donne un résultat parfaitement exploitable, le
 * rejeter coûterait un appel entier à l'utilisateur.
 */
/**
 * Ce qu'il advient d'une tâche déjà ouverte quand un nouveau diagnostic arrive.
 *
 * Deux diagnostics à une semaine d'écart sur le même rosier donnaient deux
 * jeux de tâches qui coexistaient — y compris quand le second disait « plante
 * saine ». Le dernier diagnostic fait foi sur ce qu'il a lui-même engendré,
 * mais c'est l'utilisateur qui tranche : chaque verdict est modifiable.
 */
export const TASK_VERDICTS = ['keep', 'drop'] as const
export const taskVerdictSchema = z.enum(TASK_VERDICTS)
export type TaskVerdict = z.infer<typeof taskVerdictSchema>

/** Verdict rendu par le modèle — facultatif, voir `openTasksReview`. */
export const modelTaskVerdictSchema = z.object({
  taskId: z.string(),
  verdict: taskVerdictSchema,
  /** Une ligne, à la 2e personne : « Le nouveau traitement la remplace. » */
  reason: z.string(),
})

export const diagnosisSuccessSchema = z.object({
  diagnosed: z.literal(true),
  status: healthStatusSchema,
  confidence: diagnosisConfidenceSchema,
  /** Une phrase — c'est elle qui s'affiche dans l'historique. */
  summary: z.string(),
  observations: z.array(z.string()),
  probableCauses: z.array(diagnosisCauseSchema),
  recommendations: z.array(diagnosisRecommendationSchema),
  followUp: z.string().nullable(),
  /**
   * Sort des tâches déjà ouvertes sur la plante, quand le modèle se prononce.
   *
   * **Facultatif**, comme `shortAction` et `dueInDays` : les diagnostics
   * antérieurs n'en ont pas, et la revue retombe alors sur ses règles
   * déterministes. Quand il est présent, il l'emporte, verdict par verdict.
   */
  openTasksReview: z.array(modelTaskVerdictSchema).optional(),
})

export type DiagnosisSuccess = z.infer<typeof diagnosisSuccessSchema>

export const diagnosisFailureSchema = z.object({
  diagnosed: z.literal(false),
  /** Actionnable : « Reprends la photo en plein jour, feuilles bien visibles ». */
  reason: z.string(),
})

export type DiagnosisFailure = z.infer<typeof diagnosisFailureSchema>

export const diagnosisResultSchema = z.discriminatedUnion('diagnosed', [
  diagnosisSuccessSchema,
  diagnosisFailureSchema,
])

export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>

/**
 * Réponse de `POST …/diagnose`.
 *
 * `currentHealthStatus` accompagne toujours le résultat : c'est en le
 * comparant à `status` que l'UI décide d'afficher — ou non — le bloc de
 * confirmation de mise à jour. Le statut n'est jamais appliqué d'office.
 */
export type DiagnoseApiResponse = DiagnosisResult & {
  /** `null` quand `diagnosed: false` — rien n'est écrit en base dans ce cas. */
  diagnosisId: string | null
  photoUrl: string | null
  currentHealthStatus: z.infer<typeof healthStatusSchema>
  /** Date de planification des recommandations, `null` tant qu'elle n'a pas eu lieu. */
  tasksPlannedAt: string | null
}

/** Entrée de l'historique des diagnostics d'une plante. */
export const diagnosisListItemSchema = z.object({
  id: idSchema,
  createdAt: isoDateTimeSchema,
  photoUrl: z.string(),
  status: healthStatusSchema,
  confidence: diagnosisConfidenceSchema,
  summary: z.string(),
  /** L'utilisateur a-t-il appliqué le statut proposé à sa plante ? */
  statusApplied: z.boolean(),
  /**
   * Quand les recommandations ont été planifiées, `null` sinon.
   *
   * C'est cette date qui décide de l'état du bouton « Planifier ces actions »,
   * y compris en relecture d'historique : sans elle, rouvrir un diagnostic
   * reproposerait de planifier ce qui l'est déjà.
   */
  tasksPlannedAt: nullish(isoDateTimeSchema),
})

export type DiagnosisListItem = z.infer<typeof diagnosisListItemSchema>

/** Diagnostic complet tel que renvoyé par `GET …/diagnoses/[id]`. */
export const diagnosisDetailSchema = diagnosisListItemSchema.extend({
  plantInstanceId: idSchema,
  result: diagnosisSuccessSchema,
})

export type DiagnosisDetail = z.infer<typeof diagnosisDetailSchema>

/**
 * Corps de `POST …/diagnose` : une photo neuve en data URL base64 (4 Mo max,
 * comme l'identification) **ou** la photo déjà présente sur la fiche.
 * Exactement l'un des deux.
 */
export const diagnoseRequestSchema = z
  .object({
    imageBase64: z.string().min(1).optional(),
    useExistingPhoto: z.literal(true).optional(),
  })
  .refine((v) => Boolean(v.imageBase64) !== Boolean(v.useExistingPhoto), {
    message: 'Fournir imageBase64 ou useExistingPhoto, et un seul des deux.',
  })

export type DiagnoseRequest = z.infer<typeof diagnoseRequestSchema>

/**
 * Corps de `POST …/apply`.
 *
 * Le littéral `true` peut sembler superflu — il rend l'intention explicite et
 * interdit qu'un corps vide, ou un `{ apply: false }` mal construit côté
 * client, déclenche une écriture sur la fiche plante.
 */
export const applyDiagnosisSchema = z.object({ apply: z.literal(true) })

export type ApplyDiagnosis = z.infer<typeof applyDiagnosisSchema>

/**
 * Corps de `POST …/plan`.
 *
 * `supersede` porte les tâches que l'utilisateur a marquées « retirer » dans la
 * revue. Absent ou vide, rien n'est retiré : planifier reste possible sans
 * jamais passer par la revue.
 */
export const planDiagnosisSchema = z.object({
  supersede: z.array(idSchema).max(50).optional(),
})

export type PlanDiagnosisInput = z.infer<typeof planDiagnosisSchema>

/** Réponse de `POST …/plan` — planification des recommandations en tâches. */
export const planDiagnosisResponseSchema = z.object({
  tasksCreated: z.number().int().min(0),
  tasksPlannedAt: isoDateTimeSchema,
  /** Tâches retirées du planning par ce diagnostic. */
  superseded: z.number().int().min(0).optional(),
})

export type PlanDiagnosisResponse = z.infer<typeof planDiagnosisResponseSchema>

// ─── Revue des actions en cours ────────────────────────────────────────────

/** Une tâche ouverte, avec le verdict proposé et sa raison. */
export const taskReviewItemSchema = z.object({
  taskId: idSchema,
  type: actionTypeSchema,
  shortLabel: z.string(),
  label: z.string(),
  dueDate: z.string(),
  createdAt: isoDateTimeSchema,
  verdict: taskVerdictSchema,
  /** Une ligne qui dit pourquoi ce verdict — jamais un verdict nu. */
  reason: z.string(),
  /** Le modèle s'est-il prononcé, ou est-ce la règle déterministe ? */
  fromModel: z.boolean(),
})

export type TaskReviewItem = z.infer<typeof taskReviewItemSchema>

/** Une tâche déjà retirée par un diagnostic plus récent. */
export const supersededTaskSchema = z.object({
  taskId: idSchema,
  shortLabel: z.string(),
  supersededAt: isoDateTimeSchema,
})

export type SupersededTask = z.infer<typeof supersededTaskSchema>

/**
 * Réponse de `GET …/diagnoses/[id]/review`.
 *
 * `tasks` est vide quand la plante n'a aucune tâche ouverte : la section ne
 * s'affiche alors pas, et le parcours de diagnostic ne change en rien.
 */
export const diagnosisReviewSchema = z.object({
  tasks: z.array(taskReviewItemSchema),
  /** Ce que *ce* diagnostic a engendré et qu'un plus récent a retiré. */
  superseded: z.array(supersededTaskSchema),
})

export type DiagnosisReview = z.infer<typeof diagnosisReviewSchema>
