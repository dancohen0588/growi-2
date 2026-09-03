import 'server-only'

import { unstable_cache } from 'next/cache'
import { area as turfArea, featureCollection, intersect, polygon as turfPolygon } from '@turf/turf'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import type {
  MeterPoint,
  ParcelBuilding,
  ParcelCandidate,
  ParcelDetail,
} from '@growi/shared'

import { ServiceError, isServiceError } from './errors'

/**
 * Retrouver le terrain d'un utilisateur sur le plan cadastral.
 *
 * Trois services publics de l'IGN, tous ouverts (Licence Ouverte 2.0), sans
 * clé ni quota publié :
 * - le géocodage inverse de la Géoplateforme sur l'index `parcel`, qui donne
 *   les parcelles les plus proches d'un point — le point d'une adresse étant
 *   presque toujours posé sur la voie et non dans la parcelle, c'est bien une
 *   recherche par proximité, jamais un « quelle parcelle contient ce point » ;
 * - l'API Carto (module Cadastre), qui donne le contour et la contenance ;
 * - la BD TOPO en WFS, qui donne les bâtiments, et donc le terrain hors bâti.
 *
 * Tout est projeté en mètres ici : le client ne voit jamais de degrés.
 */

const GEOCODE_REVERSE_URL = 'https://data.geopf.fr/geocodage/reverse'
const APICARTO_PARCELLE_URL = 'https://apicarto.ign.fr/api/cadastre/parcelle'
const WFS_URL = 'https://data.geopf.fr/wfs/ows'
const WMS_URL = 'https://data.geopf.fr/wms-r/wms'

/** Un utilisateur attend la réponse : mieux vaut le repli manuel qu'une longue attente. */
const UPSTREAM_TIMEOUT_MS = 6_000

/** Mètres par degré de latitude — la base de la projection locale (voir `projectionFor`). */
const METERS_PER_DEGREE = 111_320

/** En deçà, c'est un bout de voirie ou de trottoir cadastré, pas un terrain. */
const MIN_CONTENANCE_M2 = 20

/** Au-delà, la liste devient un catalogue : quatre vignettes se comparent d'un coup d'œil. */
const MAX_CANDIDATES = 4

/**
 * Un bâtiment mitoyen déborde de quelques centimètres carrés sur la parcelle
 * voisine. Le compter ferait apparaître une « maison » invisible sur le plan.
 */
const MIN_BUILDING_AREA_M2 = 2

const THUMBNAIL_MARGIN_M = 15
const THUMBNAIL_WIDTH = 480
const THUMBNAIL_HEIGHT = 360

/** Le plan cadastral bouge de quelques parcelles par an : une journée de cache est prudente. */
const PARCEL_CACHE_SECONDS = 86_400

// ─── Réponses amont ────────────────────────────────────────────────────────

interface ReverseParcelFeature {
  properties?: {
    id?: string
    section?: string
    number?: string
    city?: string
    distance?: number
  }
}

interface ParcelleFeature {
  geometry?: Polygon | MultiPolygon
  properties?: {
    idu?: string
    section?: string
    numero?: string
    contenance?: number
  }
}

interface BuildingFeature {
  geometry?: Polygon | MultiPolygon
  properties?: {
    construction_legere?: boolean
  }
}

interface FeatureCollectionOf<T> {
  features?: T[]
}

// ─── Appels amont ──────────────────────────────────────────────────────────

/**
 * Un appel amont, borné dans le temps. Toute défaillance — HTTP, réseau,
 * dépassement du délai, corps illisible — devient un `UNAVAILABLE`, que la
 * route traduit en 503 et le client en « le cadastre ne répond pas ».
 */
async function fetchUpstream<T>(url: string, what: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new ServiceError('UNAVAILABLE', `${what} ne répond pas (HTTP ${res.status})`)
    }
    return (await res.json()) as T
  } catch (err) {
    if (isServiceError(err)) throw err
    throw new ServiceError('UNAVAILABLE', `${what} ne répond pas`)
  } finally {
    clearTimeout(timer)
  }
}

function parcelleUrl(codeInsee: string, section: string, numero: string): string {
  const params = new URLSearchParams({ code_insee: codeInsee, section, numero })
  return `${APICARTO_PARCELLE_URL}?${params.toString()}`
}

// ─── Géométrie ─────────────────────────────────────────────────────────────

type Bbox = { lonMin: number; latMin: number; lonMax: number; latMax: number }

/**
 * Repère local d'une parcelle : origine au coin nord-ouest de sa boîte
 * englobante, `y` vers le sud — celui du canevas du plan.
 *
 * La projection est équirectangulaire, centrée sur la parcelle : à l'échelle
 * d'un jardin l'erreur reste sous le décimètre, là où `proj4` et le Lambert 93
 * n'apporteraient que des dépendances.
 */
interface Projection {
  lonMin: number
  latMax: number
  metersPerLon: number
}

function projectionFor(bbox: Bbox): Projection {
  const centerLat = (bbox.latMin + bbox.latMax) / 2
  return {
    lonMin: bbox.lonMin,
    latMax: bbox.latMax,
    metersPerLon: METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180),
  }
}

function toMeters(position: Position, proj: Projection): MeterPoint {
  return {
    x: round2((position[0] - proj.lonMin) * proj.metersPerLon),
    y: round2((proj.latMax - position[1]) * METERS_PER_DEGREE),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Anneaux extérieurs d'une géométrie, qu'elle soit `Polygon` ou `MultiPolygon`. */
function outerRings(geometry: Polygon | MultiPolygon): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1)
  return geometry.coordinates.map(poly => poly[0]).filter(Boolean)
}

function bboxOfRings(rings: Position[][]): Bbox {
  let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < lonMin) lonMin = lon
      if (lon > lonMax) lonMax = lon
      if (lat < latMin) latMin = lat
      if (lat > latMax) latMax = lat
    }
  }
  return { lonMin, latMin, lonMax, latMax }
}

/**
 * Le contour retenu est l'anneau le plus large : une parcelle en plusieurs
 * morceaux (rare, mais le cadastre en produit) donnerait sinon un contour
 * arbitraire. Les autres morceaux restent comptés dans la contenance.
 */
function largestRing(rings: Position[][]): Position[] {
  let best = rings[0]
  let bestArea = -1
  for (const ring of rings) {
    const a = turfArea(turfPolygon([closeRing(ring)]))
    if (a > bestArea) {
      bestArea = a
      best = ring
    }
  }
  return best
}

/** Turf exige des anneaux fermés ; l'API Carto les ferme, la BD TOPO aussi, mais pas toujours. */
function closeRing(ring: Position[]): Position[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    return [...ring, first]
  }
  return ring
}

function toTurfPolygon(geometry: Polygon | MultiPolygon): Feature<Polygon> {
  return turfPolygon([closeRing(largestRing(outerRings(geometry)))])
}

// ─── Vignette WMS ──────────────────────────────────────────────────────────

/**
 * Image statique orthophoto + parcellaire cadrée sur la parcelle, chargée
 * directement par le navigateur : c'est une image publique, dont l'URL ne
 * porte qu'une emprise. Aucune bibliothèque cartographique n'est nécessaire.
 */
export function buildThumbnailUrl(bbox: Bbox): string {
  const centerLat = (bbox.latMin + bbox.latMax) / 2
  const metersPerLon = METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180)

  let halfWidthM = ((bbox.lonMax - bbox.lonMin) * metersPerLon) / 2 + THUMBNAIL_MARGIN_M
  let halfHeightM = ((bbox.latMax - bbox.latMin) * METERS_PER_DEGREE) / 2 + THUMBNAIL_MARGIN_M

  // Ramené au format de l'image, sinon l'orthophoto est étirée.
  const ratio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT
  if (halfWidthM / halfHeightM < ratio) halfWidthM = halfHeightM * ratio
  else halfHeightM = halfWidthM / ratio

  const dLat = halfHeightM / METERS_PER_DEGREE
  const dLon = halfWidthM / metersPerLon
  const centerLon = (bbox.lonMin + bbox.lonMax) / 2

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'ORTHOIMAGERY.ORTHOPHOTOS,CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
    // Vide, mais obligatoire — une couche sans style par couche donne un 400.
    STYLES: ',',
    CRS: 'EPSG:4326',
    // EPSG:4326 en WMS 1.3.0 : latitude d'abord.
    BBOX: [centerLat - dLat, centerLon - dLon, centerLat + dLat, centerLon + dLon]
      .map(v => v.toFixed(6))
      .join(','),
    WIDTH: String(THUMBNAIL_WIDTH),
    HEIGHT: String(THUMBNAIL_HEIGHT),
    FORMAT: 'image/png',
  })
  // `URLSearchParams` encode la virgule de `STYLES` et des couches ; le
  // serveur WMS l'accepte, mais l'URL est plus lisible sans.
  return `${WMS_URL}?${params.toString().replace(/%2C/g, ',')}`
}

// ─── Identifiant de parcelle ───────────────────────────────────────────────

interface ParsedIdu {
  codeInsee: string
  section: string
  numero: string
}

/**
 * Décompose un IDU : 5 caractères de code commune (2 de département + 3 de
 * commune en métropole, 3 + 2 outre-mer — la coupure à 5 vaut dans les deux
 * cas), 3 de commune absorbée, 2 de section, 4 de numéro.
 */
export function parseIdu(idu: string): ParsedIdu {
  const clean = idu.trim().toUpperCase()
  if (!/^[0-9A-Z]{14}$/.test(clean)) {
    throw new ServiceError('NOT_FOUND', 'Parcelle introuvable')
  }
  return {
    codeInsee: clean.slice(0, 5),
    section: clean.slice(8, 10),
    numero: clean.slice(10, 14),
  }
}

// ─── Recherche de parcelles autour d'un point ──────────────────────────────

/**
 * Les parcelles les plus proches d'un point, avec leur contenance officielle.
 *
 * Le géocodage inverse en propose six ; on écarte les minuscules et on garde
 * les quatre plus proches. Une contenance qui manque écarte la candidate au
 * lieu de faire échouer la recherche : l'utilisateur préfère trois parcelles à
 * un message d'erreur.
 */
export async function findParcelsNear(lat: number, lon: number): Promise<ParcelCandidate[]> {
  const params = new URLSearchParams({
    lon: String(lon),
    lat: String(lat),
    index: 'parcel',
    limit: '6',
  })

  const reverse = await fetchUpstream<FeatureCollectionOf<ReverseParcelFeature>>(
    `${GEOCODE_REVERSE_URL}?${params.toString()}`,
    'Le géocodage',
  )

  const near = (reverse.features ?? [])
    .map(f => f.properties)
    .filter((p): p is NonNullable<ReverseParcelFeature['properties']> => Boolean(p?.id))

  if (near.length === 0) return []

  const settled = await Promise.allSettled(
    near.map(async (p): Promise<ParcelCandidate | null> => {
      const { codeInsee, section, numero } = parseIdu(p.id!)
      const collection = await fetchUpstream<FeatureCollectionOf<ParcelleFeature>>(
        parcelleUrl(codeInsee, section, numero),
        'Le cadastre',
      )
      const feature = collection.features?.[0]
      const contenance = feature?.properties?.contenance
      if (!feature?.geometry || typeof contenance !== 'number') return null
      if (contenance < MIN_CONTENANCE_M2) return null

      return {
        idu: p.id!,
        section: feature.properties?.section ?? p.section ?? '',
        numero: feature.properties?.numero ?? p.number ?? '',
        communeName: p.city ?? '',
        contenanceM2: Math.round(contenance),
        distanceM: Math.round(p.distance ?? 0),
        thumbnailUrl: buildThumbnailUrl(bboxOfRings(outerRings(feature.geometry))),
      }
    }),
  )

  const candidates = settled
    .filter(
      (r): r is PromiseFulfilledResult<ParcelCandidate | null> => r.status === 'fulfilled',
    )
    .map(r => r.value)
    .filter((c): c is ParcelCandidate => c !== null)

  // Toutes les contenances ont échoué : c'est le cadastre qui est en panne,
  // pas le quartier qui est vide.
  if (candidates.length === 0 && settled.every(r => r.status === 'rejected')) {
    throw new ServiceError('UNAVAILABLE', 'Le cadastre ne répond pas')
  }

  return candidates.sort((a, b) => a.distanceM - b.distanceM).slice(0, MAX_CANDIDATES)
}

// ─── Détail d'une parcelle ─────────────────────────────────────────────────

/**
 * Les bâtiments de la BD TOPO qui touchent la parcelle, découpés à ses
 * limites — un mitoyen ne doit pas déborder du terrain sur le plan.
 *
 * Renvoie `null` si la BD TOPO ne répond pas : le bâti est alors inconnu, et
 * la parcelle reste importable avec sa seule contenance.
 */
async function fetchBuildings(
  parcel: Feature<Polygon>,
  proj: Projection,
): Promise<ParcelBuilding[] | null> {
  // Ce WFS attend la latitude avant la longitude dans le WKT.
  const wkt = `POLYGON((${parcel.geometry.coordinates[0]
    .map(([plon, plat]) => `${plat} ${plon}`)
    .join(', ')}))`

  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'BDTOPO_V3:batiment',
    OUTPUTFORMAT: 'application/json',
    COUNT: '20',
    CQL_FILTER: `INTERSECTS(geometrie,${wkt})`,
  })

  let collection: FeatureCollectionOf<BuildingFeature>
  try {
    collection = await fetchUpstream<FeatureCollectionOf<BuildingFeature>>(
      `${WFS_URL}?${params.toString()}`,
      'La BD TOPO',
    )
  } catch {
    return null
  }

  const buildings: ParcelBuilding[] = []
  for (const feature of collection.features ?? []) {
    if (!feature.geometry) continue
    const light = feature.properties?.construction_legere === true

    for (const ring of outerRings(feature.geometry)) {
      const clipped = intersect(
        featureCollection([turfPolygon([closeRing(ring)]), parcel]),
      )
      if (!clipped) continue

      for (const piece of outerRings(clipped.geometry)) {
        const areaM2 = turfArea(turfPolygon([closeRing(piece)]))
        if (areaM2 < MIN_BUILDING_AREA_M2) continue
        buildings.push({
          footprintM: piece.map(p => toMeters(p, proj)),
          areaInParcelM2: Math.round(areaM2),
          light,
        })
      }
    }
  }

  return buildings
}

async function fetchParcelDetail(idu: string): Promise<ParcelDetail> {
  const { codeInsee, section, numero } = parseIdu(idu)

  const collection = await fetchUpstream<FeatureCollectionOf<ParcelleFeature>>(
    parcelleUrl(codeInsee, section, numero),
    'Le cadastre',
  )
  const feature = collection.features?.[0]
  if (!feature?.geometry || typeof feature.properties?.contenance !== 'number') {
    throw new ServiceError('NOT_FOUND', 'Parcelle introuvable')
  }

  const rings = outerRings(feature.geometry)
  const bbox = bboxOfRings(rings)
  const proj = projectionFor(bbox)
  const parcel = toTurfPolygon(feature.geometry)

  const outlineM = closeRing(largestRing(rings))
    .slice(0, -1) // le dernier sommet répète le premier : inutile pour un polygone du plan
    .map(p => toMeters(p, proj))

  const buildings = await fetchBuildings(parcel, proj)
  const builtM2 =
    buildings === null
      ? null
      : Math.round(buildings.reduce((sum, b) => sum + b.areaInParcelM2, 0))

  const contenanceM2 = Math.round(feature.properties.contenance)

  return {
    idu,
    section: feature.properties.section ?? section,
    numero: feature.properties.numero ?? numero,
    contenanceM2,
    thumbnailUrl: buildThumbnailUrl(bbox),
    outlineM,
    bboxM: {
      width: round2((bbox.lonMax - bbox.lonMin) * proj.metersPerLon),
      height: round2((bbox.latMax - bbox.latMin) * METERS_PER_DEGREE),
    },
    buildings,
    builtM2,
    gardenM2: builtM2 === null ? contenanceM2 : Math.max(0, contenanceM2 - builtM2),
  }
}

/**
 * Le détail d'une parcelle, mis en cache une journée : le plan cadastral ne
 * change pas d'un rafraîchissement à l'autre, et un import se fait souvent en
 * deux temps (le récapitulatif, puis la pose).
 */
export const getParcel = unstable_cache(fetchParcelDetail, ['cadastre-parcel'], {
  revalidate: PARCEL_CACHE_SECONDS,
})
