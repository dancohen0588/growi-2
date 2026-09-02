/**
 * Service diagnostic IA d'une plante.
 *
 * Ce qui distingue le diagnostic de l'identification n'est pas le modèle mais
 * ce qu'on lui donne à lire : la photo arrive accompagnée de tout ce que Growi
 * sait déjà de cette plante-là — sa fiche catalogue, son jardin, la météo du
 * lieu, les derniers gestes notés. C'est l'assemblage de ce contexte, assuré
 * par `lib/services/plant-context.ts`, qui fait la valeur du service ; l'appel
 * au modèle, lui, est celui de `lib/services/gemini.ts`.
 *
 * Le statut de santé proposé n'est **jamais** appliqué d'office : il faut un
 * geste explicite de l'utilisateur (`applyDiagnosisStatus`). Une IA qui
 * repeindrait une plante en « critique » sans qu'on le lui demande ferait plus
 * de mal que de bien.
 */

import {
  diagnosisFailureSchema,
  diagnosisSuccessSchema,
  type DiagnoseApiResponse,
  type DiagnoseRequest,
  type DiagnosisDetail,
  type DiagnosisListItem,
  type DiagnosisSuccess,
  type HealthStatus,
} from '@growi/shared'
import type { Diagnosis } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import {
  generateJson,
  parseImagePayload,
  requireGeminiKey,
  stripFence,
  toArrayBuffer,
  type GeminiImage,
} from '@/lib/services/gemini'
import { logHealth } from '@/lib/services/log.service'
import {
  buildPlantContextText,
  contextBlock,
  PLANT_CONTEXT_INCLUDE,
  type PlantWithRelations,
} from '@/lib/services/plant-context'
import { uploadPhoto } from '@/lib/storage'

const SYSTEM_PROMPT = `Tu es un expert botaniste de l'application Growi. Tu analyses la photo d'une plante que l'utilisateur possède déjà, en la croisant avec le CONTEXTE fourni, pour établir un diagnostic de santé.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans \`\`\`json, sans commentaires.

Schéma JSON attendu :
{
  "diagnosed": true,
  "status": "HEALTHY" | "WARNING" | "CRITICAL",
  "confidence": "high" | "medium" | "low",
  "summary": "Une phrase qui résume l'état de la plante",
  "observations": ["2 à 4 constats courts et factuels tirés de la photo"],
  "probableCauses": [
    {
      "label": "Nom court de la cause",
      "likelihood": "likely" | "possible" | "unlikely",
      "explanation": "1-2 phrases ; cite le contexte quand il éclaire la cause"
    }
  ],
  "recommendations": [
    {
      "action": "Consigne complète à l'impératif, 2e personne du singulier",
      "shortAction": "La même en 3 à 5 mots, pour titrer la carte",
      "priority": "urgent" | "soon" | "watch",
      "timeframe": "aujourd'hui" | "cette semaine" | "ce mois-ci",
      "actionType": "arrosage" | "taille" | "semis" | "rempotage" | "fertilisation" | "traitement" | "recolte" | "autre",
      "dueInDays": 0
    }
  ],
  "followUp": "Phrase de suivi, ou null"
}

Si la photo ne permet pas de juger (floue, plante non visible, sujet qui n'est pas une plante), réponds :
{
  "diagnosed": false,
  "reason": "Ce que l'utilisateur doit faire pour obtenir un diagnostic exploitable"
}

Règles :
- Tout en français, et TUTOIE l'utilisateur partout — dans "summary", "observations", "probableCauses" comme dans "recommendations". Jamais de vouvoiement.
- Ton bienveillant et concret.
- 2 à 4 observations, 2 à 5 recommandations.
- "probableCauses" explique un PROBLÈME : 1 à 3 causes quand la plante en a un. Si "status" vaut "HEALTHY", laisse le tableau VIDE — « arrosage optimal » n'est pas une cause, et remplir cette section sur une plante saine ne fait qu'inquiéter pour rien.
- Accorde "priority" et "timeframe" : "urgent" va avec « aujourd'hui », "soon" avec « cette semaine », "watch" avec « ce mois-ci ». Pas d'action urgente renvoyée à la semaine prochaine.
- "shortAction" titre la carte du planning : 3 à 5 mots, verbe à l'impératif, sans nom de plante ni ponctuation finale. « Retire et détruis immédiatement les parties les plus atteintes pour éviter la propagation » → « Retirer les feuilles atteintes ». C'est un titre, pas un résumé de la phrase : il doit se lire d'un coup d'œil, le détail restant dans "action".
- "actionType" range la recommandation parmi les gestes du planning, pour qu'elle puisse devenir une tâche datée. Prends "autre" dès qu'aucun geste ne correspond vraiment — une observation à mener, une aération, un déplacement. Exemples : « Arrose abondamment ce soir » → "arrosage" ; « Retire les feuilles atteintes » → "taille" ; « Pulvérise une solution au bicarbonate » → "traitement" ; « Surveille l'apparition de nouvelles taches » → "autre".
- "dueInDays" est le délai en jours, cohérent avec "timeframe" : 0 pour aujourd'hui, 2 à 3 pour cette semaine, 7 à 30 pour ce mois-ci. Entier positif ou nul.
- CROISE la photo et le contexte : le même jaunissement ne se lit pas pareil après trois jours à 34 °C ou après deux semaines de pluie. Cite le contexte dans "explanation" quand il éclaire vraiment la cause.
- N'invente JAMAIS une maladie : en cas de doute, confidence "low" et causes en "possible".
- Une plante en bonne santé est un diagnostic valable : status "HEALTHY", et des recommandations d'entretien courant.
- Recommandations faisables par un amateur. Jamais de produit phytosanitaire sans avoir proposé d'abord une alternative douce.
- Si le contexte manque (pas de météo, pas de fiche catalogue), diagnostique sur ce que tu vois sans le signaler à l'utilisateur.
- Si la plante photographiée ne correspond PAS à l'espèce enregistrée au contexte, diagnostique quand même ce que tu vois : signale simplement l'écart dans "observations" et baisse "confidence". Ne refuse jamais pour ce motif — la fiche peut avoir été mal renseignée.
- "followUp" ne propose que ce que l'utilisateur peut faire seul dans l'app, typiquement relancer un diagnostic après un délai. Écris-le à la 2e personne, sans jamais parler de toi : « Reprends une photo dans 7 jours pour voir l'évolution », et non « … pour que je puisse évaluer ». Tu ne suis pas cette plante, tu ne recontactes personne, et aucun expert n'est joignable : ne le laisse pas entendre.`

// ─── Contexte ──────────────────────────────────────────────────────────────

/**
 * Assemble le bloc CONTEXTE soumis au modèle. Exporté pour les tests.
 *
 * Les sections elles-mêmes vivent dans `plant-context.ts` : le chat les lit
 * aussi, et deux copies auraient divergé au premier champ ajouté.
 */
export async function buildDiagnosisContext(
  userId: string,
  plant: PlantWithRelations,
  now: Date = new Date(),
): Promise<string> {
  return contextBlock(await buildPlantContextText(userId, plant, now), now)
}

// ─── Photo ─────────────────────────────────────────────────────────────────

const DATA_URL_PREFIX = /^data:image\//

/**
 * Récupère la photo déjà attachée à la fiche pour la soumettre au modèle.
 *
 * @throws ServiceError('INVALID_INPUT') si la fiche n'a pas de photo,
 * ServiceError('UNAVAILABLE') si le stockage ne la rend pas.
 */
async function fetchExistingPhoto(photoUrl: string | null): Promise<GeminiImage> {
  if (!photoUrl) {
    throw new ServiceError(
      'INVALID_INPUT',
      "Cette plante n'a pas encore de photo. Prends-en une pour lancer le diagnostic.",
    )
  }

  // Une photo déjà stockée peut être un data URL en test, ou une URL Supabase.
  if (DATA_URL_PREFIX.test(photoUrl)) return parseImagePayload(photoUrl)

  let response: Response
  try {
    response = await fetch(photoUrl)
  } catch (err) {
    console.error('[diagnosis] photo de la fiche injoignable', err)
    throw new ServiceError('UNAVAILABLE', "La photo de la fiche n'a pas pu être relue.")
  }

  if (!response.ok) {
    throw new ServiceError('UNAVAILABLE', "La photo de la fiche n'a pas pu être relue.")
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
  return { mimeType, data: bytes.toString('base64') }
}

// ─── Diagnostic ────────────────────────────────────────────────────────────

function failure(reason: string, plant: { healthStatus: string }): DiagnoseApiResponse {
  return {
    diagnosed: false,
    reason,
    diagnosisId: null,
    photoUrl: null,
    currentHealthStatus: plant.healthStatus as HealthStatus,
    // Rien n'a été écrit, donc rien à planifier.
    tasksPlannedAt: null,
  }
}

/**
 * Diagnostique une plante de l'utilisateur à partir d'une photo.
 *
 * Ne lève pas quand le modèle échoue : renvoie `diagnosed: false` avec un
 * motif affichable, comme le fait l'identification. Rien n'est écrit en base
 * dans ce cas — un diagnostic raté n'a pas sa place dans l'historique.
 *
 * @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur,
 * ServiceError('INVALID_INPUT') si l'image est inexploitable,
 * ServiceError('UNAVAILABLE') si la clé API manque.
 */
export async function diagnosePlant(
  userId: string,
  plantInstanceId: string,
  input: DiagnoseRequest,
): Promise<DiagnoseApiResponse> {
  const apiKey = requireGeminiKey('Service de diagnostic indisponible (clé API manquante).')

  const plant = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    include: PLANT_CONTEXT_INCLUDE,
  })
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')

  const image = input.useExistingPhoto
    ? await fetchExistingPhoto(plant.photoUrl)
    : parseImagePayload(input.imageBase64)

  const context = await buildDiagnosisContext(userId, plant)

  const response = await generateJson(
    [{ text: SYSTEM_PROMPT }, { text: context }, { inlineData: image }],
    { apiKey, maxOutputTokens: 2000, logLabel: 'diagnose-plant' },
  )

  if (!response.ok) return failure(response.reason, plant)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(response.raw))
  } catch {
    return failure("Erreur d'analyse, veuillez réessayer.", plant)
  }

  // Un modèle qui rend un JSON hors schéma est traité comme un échec d'analyse
  // et non comme une erreur serveur : l'utilisateur peut réessayer.
  const success = diagnosisSuccessSchema.safeParse(parsed)
  if (!success.success) {
    const declared = diagnosisFailureSchema.safeParse(parsed)
    if (declared.success) return failure(declared.data.reason, plant)

    console.error('[diagnose-plant] réponse hors schéma', success.error.issues)
    return failure("Erreur d'analyse, veuillez réessayer.", plant)
  }

  const result: DiagnosisSuccess = success.data

  // La photo n'est stockée qu'une fois le diagnostic acquis : inutile
  // d'encombrer le bucket avec les photos des tentatives ratées.
  const photoUrl = input.useExistingPhoto
    ? (plant.photoUrl as string)
    : (await uploadPhoto(userId, 'diagnosis', { bytes: toArrayBuffer(image.data), contentType: image.mimeType })).url

  const saved = await prisma.diagnosis.create({
    data: {
      plantInstanceId,
      userId,
      photoUrl,
      status: result.status,
      confidence: result.confidence,
      summary: result.summary,
      payload: result,
      model: response.model,
    },
  })

  return {
    ...result,
    diagnosisId: saved.id,
    photoUrl,
    currentHealthStatus: plant.healthStatus as HealthStatus,
    tasksPlannedAt: saved.tasksPlannedAt?.toISOString() ?? null,
  }
}

// ─── Application du statut & historique ────────────────────────────────────

/**
 * Applique à la plante le statut proposé par un diagnostic, sur accord de
 * l'utilisateur.
 *
 * L'écriture passe par `logHealth` plutôt que par une mise à jour directe :
 * c'est lui qui tient ensemble le statut de la plante, l'entrée de journal et
 * l'invalidation du cache de conseils du jardin. Un diagnostic appliqué doit
 * être indiscernable d'une note de santé saisie à la main.
 *
 * @throws ServiceError('NOT_FOUND') si le diagnostic n'est pas à l'utilisateur.
 */
export async function applyDiagnosisStatus(
  userId: string,
  plantInstanceId: string,
  diagnosisId: string,
): Promise<{ healthStatus: HealthStatus }> {
  const diagnosis = await prisma.diagnosis.findFirst({
    where: { id: diagnosisId, plantInstanceId, userId },
  })
  if (!diagnosis) throw new ServiceError('NOT_FOUND', 'Diagnostic introuvable')

  const status = diagnosis.status as HealthStatus

  await logHealth(plantInstanceId, userId, status, {
    note: diagnosis.summary,
    photoUrl: diagnosis.photoUrl,
  })

  await prisma.diagnosis.update({
    where: { id: diagnosisId },
    data: { statusApplied: true },
  })

  return { healthStatus: status }
}

function toListItem(diagnosis: Diagnosis): DiagnosisListItem {
  return {
    id: diagnosis.id,
    createdAt: diagnosis.createdAt.toISOString(),
    photoUrl: diagnosis.photoUrl,
    status: diagnosis.status as HealthStatus,
    confidence: diagnosis.confidence as DiagnosisListItem['confidence'],
    summary: diagnosis.summary,
    statusApplied: diagnosis.statusApplied,
    tasksPlannedAt: diagnosis.tasksPlannedAt?.toISOString() ?? null,
  }
}

/** Historique d'une plante, du plus récent au plus ancien. */
export async function listDiagnoses(
  userId: string,
  plantInstanceId: string,
): Promise<DiagnosisListItem[]> {
  const plant = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    select: { id: true },
  })
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')

  const diagnoses = await prisma.diagnosis.findMany({
    where: { plantInstanceId },
    orderBy: { createdAt: 'desc' },
  })
  return diagnoses.map(toListItem)
}

/**
 * Un diagnostic complet, payload compris.
 * @throws ServiceError('NOT_FOUND')
 */
export async function getDiagnosis(
  userId: string,
  plantInstanceId: string,
  diagnosisId: string,
): Promise<DiagnosisDetail> {
  const diagnosis = await prisma.diagnosis.findFirst({
    where: { id: diagnosisId, plantInstanceId, userId },
  })
  if (!diagnosis) throw new ServiceError('NOT_FOUND', 'Diagnostic introuvable')

  const result = diagnosisSuccessSchema.safeParse(diagnosis.payload)
  if (!result.success) {
    // Le payload a été validé avant écriture : s'il ne l'est plus, c'est le
    // schéma qui a bougé sous les lignes déjà en base.
    console.error('[diagnosis] payload historique hors schéma', diagnosis.id)
    throw new ServiceError('INTERNAL', 'Ce diagnostic est illisible.')
  }

  return {
    ...toListItem(diagnosis),
    plantInstanceId: diagnosis.plantInstanceId,
    result: result.data,
  }
}
