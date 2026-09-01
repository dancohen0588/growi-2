/**
 * L'instruction système de l'agent conversationnel.
 *
 * Trois blocs : qui il est et ce qu'il s'interdit, le CONTEXTE de la plante
 * (assemblé par `plant-context.ts`), et l'ANCRAGE — ce que l'utilisateur avait
 * sous les yeux en ouvrant le fil. C'est l'ancrage qui fait la différence
 * entre « arrose quand la terre est sèche » et une réponse sur *sa* plante,
 * *son* diagnostic, *cette* tâche-là.
 *
 * Le message de l'utilisateur, lui, n'entre jamais ici : il arrive en tour
 * `user`. Une consigne glissée dans une note de soin ne peut donc pas se faire
 * passer pour une règle du système.
 */

import {
  ACTION_TYPE_LABELS,
  DIAGNOSIS_CONFIDENCE_LABELS,
  DIAGNOSIS_LIKELIHOOD_LABELS,
  DIAGNOSIS_PRIORITY_LABELS,
  type ActionType,
  type ChatActionSnapshot,
  type DiagnosisSuccess,
} from '@growi/shared'

const PERSONA = `Tu es Growi, l'assistant jardinage de l'application Growi. Tu aides l'utilisateur à s'occuper d'UNE plante précise, décrite dans le CONTEXTE ci-dessous. Tu réponds en français, tu TUTOIES toujours, ton bienveillant et concret.

RÈGLES
- Tu ne parles que de jardinage, de plantes et de leur entretien. Pour tout autre sujet, réponds en une phrase que tu ne peux aider que sur le jardin, sans t'excuser longuement.
- Réponses COURTES : 3 à 6 phrases, ou une liste de 3 à 5 puces maximum. L'utilisateur lit sur un téléphone. Il peut poser une question de suivi.
- Mise en forme autorisée : **gras** et listes à puces « - ». Pas de titres, pas de tableaux, pas de liens.
- APPUIE-TOI sur le CONTEXTE : cite la météo, l'exposition, le dernier arrosage, la fiche catalogue quand ils éclairent la réponse. Ne redemande jamais une information qui y figure.
- N'invente JAMAIS : si tu ne sais pas ou si le contexte manque, dis-le et propose ce que l'utilisateur peut vérifier lui-même.
- Gestes faisables par un amateur. Jamais de produit phytosanitaire sans avoir d'abord proposé une alternative douce.
- Tu ne suis pas cette plante dans le temps, tu ne recontactes personne, aucun expert n'est joignable : ne le laisse jamais entendre. Si l'utilisateur veut te montrer un problème, invite-le à joindre une photo ici ou à lancer un diagnostic depuis la fiche de la plante.
- Si une photo est jointe, décris ce que tu vois avant de conseiller ; si elle est illisible, dis-le.

OUTILS (propositions d'action)
Tu disposes de fonctions pour PROPOSER des actions dans l'application. Elles ne font rien tant que l'utilisateur ne les a pas confirmées d'un tap ; ne dis donc jamais « c'est fait » ou « j'ai planifié », dis « je te propose de… ». Appelle un outil seulement quand l'action découle naturellement de la conversation :
- proposePlanTask : quand tu recommandes un geste à faire à une date précise et qu'il n'est pas déjà dans le planning (voir ANCRAGE).
- proposeCareLog : quand l'utilisateur dit qu'il VIENT DE faire un geste (« j'ai arrosé ce matin »).
- proposeMarkDone : uniquement si l'ANCRAGE est une action du calendrier et que l'utilisateur indique l'avoir faite.
Au plus 2 propositions par réponse. Accompagne toujours une proposition d'un texte.`

/** Date courte à la française : « 3 sept. 2026 ». */
export function shortFrenchDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const yesNo = (value: boolean) => (value ? 'oui' : 'non')

/** L'ancrage d'un diagnostic : le résultat complet, rendu en texte. */
export function diagnosisAnchor(
  result: DiagnosisSuccess,
  meta: { createdAt: Date; tasksPlanned: boolean },
): string {
  const lines: string[] = [
    `Type : diagnostic du ${shortFrenchDate(meta.createdAt)}.`,
    `- Statut estimé : ${result.status}`,
    `- Confiance : ${DIAGNOSIS_CONFIDENCE_LABELS[result.confidence]}`,
    `- Résumé : ${result.summary}`,
  ]

  if (result.observations.length > 0) {
    lines.push('Observations :', ...result.observations.map((o) => `- ${o}`))
  }

  if (result.probableCauses.length > 0) {
    lines.push(
      'Causes probables :',
      ...result.probableCauses.map(
        (c) => `- ${c.label} (${DIAGNOSIS_LIKELIHOOD_LABELS[c.likelihood]}) : ${c.explanation}`,
      ),
    )
  }

  if (result.recommendations.length > 0) {
    lines.push(
      'Recommandations :',
      ...result.recommendations.map((r, i) => {
        const details = [
          DIAGNOSIS_PRIORITY_LABELS[r.priority],
          r.timeframe,
          r.actionType ? ACTION_TYPE_LABELS[r.actionType] : null,
          r.dueInDays != null ? `dans ${r.dueInDays} j` : null,
        ]
          .filter(Boolean)
          .join(', ')
        return `${i + 1}. ${r.action} (${details})`
      }),
    )
  }

  if (result.followUp) lines.push(`Suivi proposé : ${result.followUp}`)

  // Sans cette ligne, l'agent reproposerait de planifier ce qui l'est déjà.
  lines.push(`Recommandations déjà planifiées : ${yesNo(meta.tasksPlanned)}`)

  return lines.join('\n')
}

/** L'ancrage d'une action du calendrier, d'après le cliché pris à l'ouverture. */
export function actionAnchor(
  action: ChatActionSnapshot,
  meta: { origin: string; done: boolean },
): string {
  return [
    'Type : action du calendrier.',
    `- Titre : ${action.shortLabel}`,
    `- Consigne : ${action.label}`,
    `- Geste : ${ACTION_TYPE_LABELS[action.type as ActionType] ?? action.type}`,
    `- Échéance : ${action.dueDate}`,
    `- Priorité : ${action.priority}`,
    `- Origine : ${meta.origin}`,
    `- Déjà faite : ${yesNo(meta.done)}`,
  ].join('\n')
}

export const PLANT_ANCHOR = 'Type : question libre sur la plante.'

/** Assemble l'instruction système soumise au modèle. */
export function buildChatSystemInstruction(input: {
  /** Le bloc `CONTEXTE`, tel que `contextBlock` le rend. */
  context: string
  anchor: string
}): string {
  return `${PERSONA}\n\n${input.context}\n\nANCRAGE\n${input.anchor}`
}
