/**
 * Les fonctions que l'agent peut appeler — et leur garde.
 *
 * Une fonction ici ne fait rien : elle **propose**. Ce que le modèle renvoie
 * est une intention, revalidée par Zod avant d'être écrite dans le message, et
 * relue en base au moment où l'utilisateur confirme. Le modèle ne touche donc
 * jamais aux données, même s'il hallucine un appel.
 */

import { SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import {
  ACTION_TYPES,
  CARE_LOG_TYPES,
  DIAGNOSIS_PRIORITIES,
  careLogProposalPayloadSchema,
  markDoneProposalPayloadSchema,
  planTaskProposalPayloadSchema,
  type CareLogProposalPayload,
  type PlanTaskProposalPayload,
} from '@growi/shared'

export const CHAT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'proposePlanTask',
    description:
      "Propose d'ajouter une tâche au planning de l'utilisateur pour cette plante. À utiliser quand tu recommandes un geste à faire à une date précise et qu'il n'est pas déjà planifié.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        actionType: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: [...ACTION_TYPES],
          description: "Geste du planning. « autre » dès qu'aucun ne correspond vraiment.",
        },
        shortLabel: {
          type: SchemaType.STRING,
          description:
            "Titre de la carte : 3 à 5 mots, verbe à l'infinitif, sans nom de plante ni ponctuation finale.",
        },
        label: {
          type: SchemaType.STRING,
          description: "Consigne complète à l'impératif, tutoiement, 1 à 2 phrases.",
        },
        dueInDays: {
          type: SchemaType.INTEGER,
          description: "Délai en jours : 0 pour aujourd'hui, 1 pour demain, jusqu'à 60.",
        },
        priority: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: [...DIAGNOSIS_PRIORITIES],
          description: 'urgent (aujourd’hui), soon (cette semaine), watch (ce mois-ci).',
        },
      },
      required: ['actionType', 'shortLabel', 'label', 'dueInDays', 'priority'],
    },
  },
  {
    name: 'proposeCareLog',
    description:
      "Propose de noter au journal un geste que l'utilisateur dit AVOIR DÉJÀ FAIT (« j'ai arrosé ce matin »). Jamais pour un geste à venir.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: [...CARE_LOG_TYPES],
          description: 'Geste noté au journal.',
        },
        note: { type: SchemaType.STRING, description: 'Précision courte, facultative.' },
        productUsed: {
          type: SchemaType.STRING,
          description: 'Produit employé, si l’utilisateur l’a nommé.',
        },
        occurredAt: {
          type: SchemaType.STRING,
          description: 'Jour du geste au format AAAA-MM-JJ. Omets-le si c’est aujourd’hui.',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'proposeMarkDone',
    description:
      "Propose de cocher comme faite l'action du calendrier sur laquelle porte cette conversation. Utilisable uniquement si l'ANCRAGE est une action, et si l'utilisateur indique l'avoir faite.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
]

/** Une proposition telle que le modèle l'a formulée, avant qu'on l'habille. */
export type ToolCallDraft =
  | { kind: 'plan_task'; payload: PlanTaskProposalPayload }
  | { kind: 'care_log'; payload: CareLogProposalPayload }
  | { kind: 'mark_done'; payload: Record<string, never> }

/**
 * Valide un appel d'outil.
 *
 * Rend `null` sur tout ce qui ne tient pas : nom inconnu, arguments hors
 * schéma, énumération inventée. Un appel invalide est ignoré — le silence vaut
 * mieux qu'une carte d'action que le serveur ne saurait pas exécuter.
 */
export function parseToolCall(name: string, args: unknown): ToolCallDraft | null {
  switch (name) {
    case 'proposePlanTask': {
      const parsed = planTaskProposalPayloadSchema.safeParse(args)
      return parsed.success ? { kind: 'plan_task', payload: parsed.data } : null
    }
    case 'proposeCareLog': {
      const parsed = careLogProposalPayloadSchema.safeParse(args)
      return parsed.success ? { kind: 'care_log', payload: parsed.data } : null
    }
    case 'proposeMarkDone': {
      // Le modèle passe volontiers `{}` ou rien du tout ; les deux conviennent.
      const parsed = markDoneProposalPayloadSchema.safeParse(args ?? {})
      return parsed.success ? { kind: 'mark_done', payload: {} } : null
    }
    default:
      return null
  }
}
