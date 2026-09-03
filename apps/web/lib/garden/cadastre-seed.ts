import type { ParcelDetail } from '@growi/shared'

import { DEFAULT_PX_PER_METER, mToPx, pxPerMeterOf } from './scale'
import type { Garden, GardenElement, GardenPoint } from './types'

/**
 * Pose d'un import cadastral sur le plan — fonctions **pures** : ni React, ni
 * réseau, ni horloge (sauf injection), pour être vérifiables sur les fixtures.
 *
 * Le serveur renvoie chaque parcelle dans son propre repère métrique, origine
 * au coin nord-ouest de sa boîte englobante. Tout le travail ici est de les
 * placer les unes par rapport aux autres, de les convertir à l'échelle du plan
 * et d'en faire des éléments éditables comme les autres.
 */

/** Marge entre l'origine du monde et le coin du terrain posé. */
const ORIGIN_MARGIN_PX = 40

/** Mètres par degré de latitude — même constante que côté serveur. */
const METERS_PER_DEGREE = 111_320

export interface CadastreSeedOptions {
  /** Poser aussi la maison et les annexes (case de l'écran récapitulatif). */
  withBuildings: boolean
  /** Poser le contour de la parcelle (coché par défaut). */
  withOutline?: boolean
  /** Injectés par les tests ; par défaut, un UUID et l'heure courante. */
  newId?: () => string
  now?: () => string
}

/** Boîte en pixels du monde, telle que l'attend le recadrage de la vue. */
export interface FitBox {
  x: number
  y: number
  width: number
  height: number
}

// ─── Placement relatif des parcelles ───────────────────────────────────────

/**
 * Décalage d'une parcelle par rapport à la première, en mètres.
 *
 * Même projection équirectangulaire que le serveur, au voisinage immédiat :
 * deux parcelles d'un même terrain sont à quelques dizaines de mètres l'une de
 * l'autre, l'erreur est très en dessous du centimètre.
 */
function offsetFrom(reference: ParcelDetail, parcel: ParcelDetail): GardenPoint {
  const metersPerLon =
    METERS_PER_DEGREE * Math.cos((reference.originLonLat.lat * Math.PI) / 180)
  return {
    x: (parcel.originLonLat.lon - reference.originLonLat.lon) * metersPerLon,
    y: (reference.originLonLat.lat - parcel.originLonLat.lat) * METERS_PER_DEGREE,
  }
}

/** Décalages ramenés au coin nord-ouest de l'ensemble : plus rien de négatif. */
function layoutOffsets(parcels: ParcelDetail[]): GardenPoint[] {
  const raw = parcels.map(p => offsetFrom(parcels[0], p))
  const minX = Math.min(...raw.map(o => o.x))
  const minY = Math.min(...raw.map(o => o.y))
  return raw.map(o => ({ x: o.x - minX, y: o.y - minY }))
}

function boundsOf(points: GardenPoint[]) {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

// ─── Éléments ──────────────────────────────────────────────────────────────

/**
 * Un polygone de mètres devient un élément : sa boîte est celle de ses
 * sommets, et les sommets sont exprimés dans le repère local de l'élément
 * (origine à son coin haut-gauche), comme l'attend `GardenElement.points`.
 */
function polygonElement(
  pointsM: GardenPoint[],
  offsetM: GardenPoint,
  pxPerMeter: number,
  base: Omit<GardenElement, 'x' | 'y' | 'width' | 'height' | 'points' | 'rotation' | 'sun'>,
): GardenElement {
  const { minX, minY, maxX, maxY } = boundsOf(pointsM)
  return {
    ...base,
    x: ORIGIN_MARGIN_PX + mToPx(offsetM.x + minX, pxPerMeter),
    y: ORIGIN_MARGIN_PX + mToPx(offsetM.y + minY, pxPerMeter),
    width: mToPx(maxX - minX, pxPerMeter),
    height: mToPx(maxY - minY, pxPerMeter),
    rotation: 0,
    sun: 'full',
    points: pointsM.map(p => ({
      x: mToPx(p.x - minX, pxPerMeter),
      y: mToPx(p.y - minY, pxPerMeter),
    })),
  }
}

/**
 * Section et numéro d'une parcelle, tels que l'utilisateur les lit sur le
 * cadastre : « 0A 1948 ». L'IDU seul (`785512510A1948`) ne parle à personne,
 * et c'est la seule chose que `config.cadastre` garde d'un import.
 */
export function formatParcelId(idu: string): string {
  const clean = idu.trim().toUpperCase()
  if (clean.length !== 14) return clean
  return `${clean.slice(8, 10)} ${clean.slice(10, 14)}`
}

/** Surface retenue pour le jardin : hors bâti si on pose le bâti, contenance sinon. */
export function surfaceFromSeed(parcels: ParcelDetail[], withBuildings: boolean): number {
  return parcels.reduce(
    (sum, p) => sum + (withBuildings ? p.gardenM2 : p.contenanceM2),
    0,
  )
}

/**
 * Le plan après import : contour de chaque parcelle, bâti éventuel, dimensions
 * et échelle mises à jour.
 *
 * Ce que l'utilisateur a dessiné n'est jamais touché — seuls les éléments d'un
 * import précédent sont retirés, à l'identifiant près. Les nouveaux sont posés
 * en tête du tableau, c'est-à-dire au fond des calques : un plan existant
 * garde tout ce qu'il montre.
 */
export function seedGardenFromParcels(
  garden: Garden,
  parcels: ParcelDetail[],
  options: CadastreSeedOptions,
): Garden {
  if (parcels.length === 0) return garden

  const newId = options.newId ?? (() => crypto.randomUUID())
  const now = options.now ?? (() => new Date().toISOString())
  const pxPerMeter = pxPerMeterOf(garden.config.pxPerMeter ?? DEFAULT_PX_PER_METER)

  const offsets = layoutOffsets(parcels)
  const outlines: GardenElement[] = []
  const buildings: GardenElement[] = []

  parcels.forEach((parcel, i) => {
    if (options.withOutline !== false) {
      outlines.push(
        polygonElement(parcel.outlineM, offsets[i], pxPerMeter, {
          id: newId(),
          type: 'terrain',
          emoji: '🗺️',
          label: `Limite de parcelle · ${formatParcelId(parcel.idu)}`,
          drawKind: 'terrain',
        }),
      )
    }

    if (!options.withBuildings) return
    for (const building of parcel.buildings ?? []) {
      // Une construction légère est un abri de jardin, pas une maison : le
      // plan doit les distinguer, l'utilisateur les reconnaîtra.
      const type = building.light ? 'abri' : 'maison'
      buildings.push(
        polygonElement(building.footprintM, offsets[i], pxPerMeter, {
          id: newId(),
          type,
          emoji: '🏠',
          label: building.light ? 'Abri' : 'Maison',
          drawKind: type,
        }),
      )
    }
  })

  const seeded = [...outlines, ...buildings]
  const previous = new Set(garden.config.cadastre?.elementIds ?? [])
  const kept = garden.elements.filter(el => !previous.has(el.id))

  // Dimensions du terrain : la boîte englobant toutes les parcelles.
  const spans = parcels.map((parcel, i) => ({
    width: offsets[i].x + parcel.bboxM.width,
    height: offsets[i].y + parcel.bboxM.height,
  }))

  return {
    ...garden,
    elements: [...seeded, ...kept],
    config: {
      ...garden.config,
      widthMeters: Math.ceil(Math.max(...spans.map(s => s.width))),
      heightMeters: Math.ceil(Math.max(...spans.map(s => s.height))),
      // L'échelle cesse d'être implicite : le plan la porte désormais.
      pxPerMeter,
      cadastre: {
        parcelIds: parcels.map(p => p.idu),
        contenanceM2: parcels.reduce((sum, p) => sum + p.contenanceM2, 0),
        builtM2: parcels.some(p => p.builtM2 === null)
          ? null
          : parcels.reduce((sum, p) => sum + (p.builtM2 ?? 0), 0),
        importedAt: now(),
        elementIds: seeded.map(el => el.id),
      },
    },
  }
}

/**
 * Boîte englobante d'un ensemble d'éléments, en pixels du monde — de quoi
 * recadrer la vue sur ce qui vient d'être posé. La rotation est ignorée : les
 * éléments du cadastre ne sont jamais tournés à la pose.
 */
export function fitBox(elements: GardenElement[]): FitBox | null {
  if (elements.length === 0) return null

  const minX = Math.min(...elements.map(el => el.x))
  const minY = Math.min(...elements.map(el => el.y))
  const maxX = Math.max(...elements.map(el => el.x + el.width))
  const maxY = Math.max(...elements.map(el => el.y + el.height))

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
