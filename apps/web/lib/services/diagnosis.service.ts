/**
 * Service diagnostic IA d'une plante.
 *
 * Ce qui distingue le diagnostic de l'identification n'est pas le modèle mais
 * ce qu'on lui donne à lire : la photo arrive accompagnée de tout ce que Growi
 * sait déjà de cette plante-là — sa fiche catalogue, son jardin, la météo du
 * lieu, les derniers gestes notés. C'est l'assemblage de ce contexte, en §
 * « contexte » ci-dessous, qui fait la valeur du service ; l'appel au modèle,
 * lui, est celui de `lib/services/gemini.ts`.
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
import type { CareLog, Diagnosis, Garden, PlantCatalog, PlantInstance } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import {
  generateJson,
  parseImagePayload,
  requireGeminiKey,
  stripFence,
  type GeminiImage,
} from '@/lib/services/gemini'
import { getGardenWeather } from '@/lib/services/garden-weather.service'
import { logHealth } from '@/lib/services/log.service'
import { uploadPhoto } from '@/lib/storage'

/** Nombre de gestes récents soumis au modèle — au-delà, le prompt s'alourdit sans éclairer. */
const RECENT_LOGS = 10

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
      "action": "Action concrète à l'impératif, 2e personne du singulier",
      "priority": "urgent" | "soon" | "watch",
      "timeframe": "aujourd'hui" | "cette semaine" | "ce mois-ci"
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
- Tout en français, ton bienveillant et concret.
- 1 à 3 causes probables, 2 à 5 recommandations, 2 à 4 observations.
- CROISE la photo et le contexte : le même jaunissement ne se lit pas pareil après trois jours à 34 °C ou après deux semaines de pluie. Cite le contexte dans "explanation" quand il éclaire vraiment la cause.
- N'invente JAMAIS une maladie : en cas de doute, confidence "low" et causes en "possible".
- Une plante en bonne santé est un diagnostic valable : status "HEALTHY", et des recommandations d'entretien courant.
- Recommandations faisables par un amateur. Jamais de produit phytosanitaire sans avoir proposé d'abord une alternative douce.
- Si le contexte manque (pas de météo, pas de fiche catalogue), diagnostique sur ce que tu vois sans le signaler à l'utilisateur.`

// ─── Contexte ──────────────────────────────────────────────────────────────

type PlantWithRelations = PlantInstance & {
  catalogPlant: PlantCatalog | null
  garden: Garden | null
  careLogs: CareLog[]
}

/** Une ligne `- Clé : valeur`, ou rien du tout si la valeur est vide. */
function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return `- ${label} : ${value}`
}

function frenchDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

function daysSince(date: Date | null, now: Date): string | null {
  if (!date) return null
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`
}

function section(title: string, lines: Array<string | null>): string | null {
  const kept = lines.filter((l): l is string => l !== null)
  return kept.length > 0 ? `${title}\n${kept.join('\n')}` : null
}

function plantSection(plant: PlantWithRelations, now: Date): string | null {
  return section('PLANTE', [
    line('Nom', plant.customName ?? plant.catalogPlant?.commonName ?? 'sans nom'),
    line('Espèce', plant.catalogPlant?.scientificName),
    line('Emplacement', plant.location),
    line('Stade', plant.growthStage),
    line('Plantée le', frenchDate(plant.datePlanted)),
    line('Exposition', plant.sunExposure),
    line('Sol', plant.soilType),
    line('Substrat', plant.substrateType),
    line(
      'Contenant',
      plant.containerSizeLiters
        ? `${plant.containerSizeLiters} L${plant.containerMaterial ? ` (${plant.containerMaterial})` : ''}`
        : null,
    ),
    line('État de santé enregistré', plant.healthStatus),
    line('Note de santé', plant.healthNote),
    line('Dernier arrosage', daysSince(plant.lastWateredAt, now)),
    line('Dernière fertilisation', daysSince(plant.lastFertilizedAt, now)),
    line('Dernière taille', daysSince(plant.lastPrunedAt, now)),
    line('Dernier traitement', daysSince(plant.lastTreatedAt, now)),
    line('Dernier rempotage', daysSince(plant.lastRepottedAt, now)),
  ])
}

function catalogSection(catalog: PlantCatalog | null): string | null {
  if (!catalog) return null
  return section('FICHE CATALOGUE', [
    line('Exposition idéale', catalog.sunExposure),
    line('Fréquence d’arrosage de référence', `tous les ${catalog.wateringFreqDays} jours`),
    line('Températures tolérées',
      catalog.minTempCelsius != null || catalog.maxTempCelsius != null
        ? `${catalog.minTempCelsius ?? '?'} °C à ${catalog.maxTempCelsius ?? '?'} °C`
        : null,
    ),
    line('Sensibilité au gel', catalog.frostSensitivity),
    line('Seuil de stress thermique', catalog.heatStressThresholdC ? `${catalog.heatStressThresholdC} °C` : null),
    line('Sols adaptés', catalog.soilTypes),
    line('Maladies fréquentes', catalog.careTipDiseases),
    line('Conseil arrosage', catalog.careTipWatering),
  ])
}

function gardenSection(garden: Garden | null): string | null {
  if (!garden) return null
  return section('JARDIN', [
    line('Type', garden.type),
    line('Sol', garden.soilType),
    line('Orientation', garden.orientation),
    line('Zone climatique', garden.climateZone),
    line('Surface', garden.surfaceM2 ? `${garden.surfaceM2} m²` : null),
  ])
}

/**
 * Météo locale — jamais bloquante.
 *
 * Un utilisateur sans adresse renseignée, ou Open-Meteo en panne, ne doit pas
 * empêcher un diagnostic : la photo reste lisible sans la météo.
 */
async function weatherSection(userId: string): Promise<string | null> {
  try {
    const weather = await getGardenWeather(userId)
    const next3 = weather.forecast
      .slice(0, 3)
      .map((d) => `${d.date} ${Math.round(d.tempMin)}/${Math.round(d.tempMax)} °C, ${d.precipitationSum} mm`)
      .join(' · ')

    return section('MÉTÉO', [
      line('Lieu', weather.locationName),
      line('Maintenant', `${Math.round(weather.current.temperature)} °C, humidité ${weather.current.humidity} %`),
      line('3 prochains jours', next3 || null),
      line('Saison', weather.context?.gardenSeasonLabel),
      line('Zone climatique', weather.context?.climateZoneLabel),
      line('Risque de gel', weather.context?.frostRisk.label),
      line(
        'Indice d’arrosage',
        weather.context ? `${weather.context.wateringIndex.score}/10 — ${weather.context.wateringIndex.reasoning}` : null,
      ),
    ])
  } catch (err) {
    console.error('[diagnosis] météo indisponible, diagnostic sans elle', err)
    return null
  }
}

function logsSection(logs: CareLog[]): string | null {
  if (logs.length === 0) return null
  const lines = logs.map((log) => {
    const details = [log.note, log.productUsed].filter(Boolean).join(' — ')
    return `- ${frenchDate(log.occurredAt)} ${log.type}${details ? ` : ${details}` : ''}`
  })
  return `JOURNAL D'ENTRETIEN (${logs.length} derniers gestes)\n${lines.join('\n')}`
}

/** Assemble le bloc CONTEXTE soumis au modèle. Exporté pour les tests. */
export async function buildDiagnosisContext(
  userId: string,
  plant: PlantWithRelations,
  now: Date = new Date(),
): Promise<string> {
  const sections = [
    plantSection(plant, now),
    catalogSection(plant.catalogPlant),
    gardenSection(plant.garden),
    await weatherSection(userId),
    logsSection(plant.careLogs),
  ].filter((s): s is string => s !== null)

  return `CONTEXTE\nDate du jour : ${frenchDate(now)}\n\n${sections.join('\n\n')}`
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

/**
 * Décode du base64 en `ArrayBuffer` **autonome**.
 *
 * `Buffer.from(…).buffer` ne convient pas : Node alloue les petits tampons
 * dans un pool partagé de 8 Ko, et l'`ArrayBuffer` sous-jacent est alors ce
 * pool entier — avec, autour de notre image, les octets d'autres traitements
 * en cours. On recopie donc la seule tranche qui nous appartient.
 */
function toArrayBuffer(base64: string): ArrayBuffer {
  const bytes = Buffer.from(base64, 'base64')
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

// ─── Diagnostic ────────────────────────────────────────────────────────────

function failure(reason: string, plant: { healthStatus: string }): DiagnoseApiResponse {
  return {
    diagnosed: false,
    reason,
    diagnosisId: null,
    photoUrl: null,
    currentHealthStatus: plant.healthStatus as HealthStatus,
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
    include: {
      catalogPlant: true,
      garden: true,
      careLogs: { orderBy: { occurredAt: 'desc' }, take: RECENT_LOGS },
    },
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
