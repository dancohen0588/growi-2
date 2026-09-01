/**
 * Contexte d'une plante, tel qu'on le soumet à un modèle.
 *
 * Ce que Growi sait d'une plante — sa fiche, sa fiche catalogue, son jardin, la
 * météo du lieu, ses derniers gestes — vaut pour le diagnostic comme pour le
 * chat : c'est ce contexte, et non le modèle, qui fait la différence entre un
 * conseil générique et un conseil utile. Il est donc assemblé ici une seule
 * fois, et les deux services le lisent.
 *
 * Le module ne sait rien de l'usage qui en est fait : il ne connaît ni prompt,
 * ni schéma de sortie, ni HTTP.
 */

import type { CareLog, Garden, PlantCatalog, PlantInstance } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import { getGardenWeather } from '@/lib/services/garden-weather.service'

/** Nombre de gestes récents soumis au modèle — au-delà, le prompt s'alourdit sans éclairer. */
export const RECENT_LOGS = 10

/**
 * Longueur maximale d'une note de geste reprise dans le contexte.
 *
 * Une note est du texte libre écrit par l'utilisateur, et elle atterrit dans
 * l'instruction système : la tronquer borne ce qu'une consigne glissée là peut
 * peser face au reste du prompt.
 */
export const CARE_LOG_NOTE_MAX = 200

export type PlantWithRelations = PlantInstance & {
  catalogPlant: PlantCatalog | null
  garden: Garden | null
  careLogs: CareLog[]
}

/** Relations à charger pour obtenir une `PlantWithRelations`. */
export const PLANT_CONTEXT_INCLUDE = {
  catalogPlant: true,
  garden: true,
  careLogs: { orderBy: { occurredAt: 'desc' }, take: RECENT_LOGS },
} as const

// ─── Mise en forme ─────────────────────────────────────────────────────────

/** Une ligne `- Clé : valeur`, ou rien du tout si la valeur est vide. */
export function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return `- ${label} : ${value}`
}

export function frenchDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

export function daysSince(date: Date | null, now: Date): string | null {
  if (!date) return null
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`
}

export function section(title: string, lines: Array<string | null>): string | null {
  const kept = lines.filter((l): l is string => l !== null)
  return kept.length > 0 ? `${title}\n${kept.join('\n')}` : null
}

function truncate(value: string | null, max = CARE_LOG_NOTE_MAX): string | null {
  if (!value) return null
  return value.length <= max ? value : `${value.slice(0, max)}…`
}

// ─── Sections ──────────────────────────────────────────────────────────────

export function plantSection(plant: PlantWithRelations, now: Date): string | null {
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

export function catalogSection(catalog: PlantCatalog | null): string | null {
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

export function gardenSection(garden: Garden | null): string | null {
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
 * empêcher un diagnostic ni une réponse du chat : le reste du contexte se lit
 * très bien sans la météo.
 */
export async function weatherSection(userId: string): Promise<string | null> {
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
    console.error('[plant-context] météo indisponible, contexte sans elle', err)
    return null
  }
}

export function logsSection(logs: CareLog[]): string | null {
  if (logs.length === 0) return null
  const lines = logs.map((log) => {
    const details = [truncate(log.note), log.productUsed].filter(Boolean).join(' — ')
    return `- ${frenchDate(log.occurredAt)} ${log.type}${details ? ` : ${details}` : ''}`
  })
  return `JOURNAL D'ENTRETIEN (${logs.length} derniers gestes)\n${lines.join('\n')}`
}

// ─── Assemblage ────────────────────────────────────────────────────────────

export type PlantContextBundle = {
  plant: PlantWithRelations
  /** Sections concaténées, séparées par une ligne vide. Sans en-tête. */
  text: string
}

/** Sections d'une plante déjà chargée, dans l'ordre attendu par les prompts. */
export async function buildPlantContextText(
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

  return sections.join('\n\n')
}

/** Le bloc `CONTEXTE` complet : en-tête daté, puis les sections. */
export function contextBlock(text: string, now: Date): string {
  return `CONTEXTE\nDate du jour : ${frenchDate(now)}\n\n${text}`
}

/**
 * Charge une plante de l'utilisateur et assemble son contexte.
 *
 * @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur.
 */
export async function buildPlantContext(
  userId: string,
  plantInstanceId: string,
  now: Date = new Date(),
): Promise<PlantContextBundle> {
  const plant = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    include: PLANT_CONTEXT_INCLUDE,
  })
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')

  return { plant, text: await buildPlantContextText(userId, plant, now) }
}
