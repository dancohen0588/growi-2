// growi-frontend/lib/garden/types.ts

export type GardenElementType =
  | 'mur' | 'portail' | 'bordure' | 'cloture' | 'abri' | 'terrasse'
  | 'massif' | 'pelouse' | 'potager' | 'serre' | 'allee' | 'rocaille'
  | 'plante' | 'arbre'
  | 'eau' | 'fontaine' | 'mare'
  | 'deco' | 'compost' | 'eclairage' | 'station-meteo' | 'pergola'

export type ElementSun = 'full' | 'half' | 'shade'

export type SolType =
  | 'argileux' | 'sableux' | 'limoneux' | 'calcaire' | 'tourbeux' | 'fertile'

export type SlopeDirection = 'N' | 'S' | 'E' | 'O'

export type ClimateZone =
  | 'oceanique' | 'continental' | 'mediterr' | 'montagne'

export type MicroClimat =
  | 'abrite' | 'vent' | 'humide' | 'sec' | 'gel' | 'urban'

export type GardenOrientation = 'S' | 'N' | 'E' | 'O' | 'SE' | 'SO' | 'NE' | 'NO'

/** Sommet d'un polygone, en coordonnées locales à l'élément (origine = x/y). */
export interface GardenPoint {
  x: number
  y: number
}

/** Types « surface » (structures + zones) — éditables en polygone à n côtés. */
export const SURFACE_TYPES: GardenElementType[] = [
  'mur', 'portail', 'bordure', 'cloture', 'abri', 'terrasse', 'pergola',
  'massif', 'pelouse', 'potager', 'serre', 'allee', 'rocaille',
]

export function isSurfaceType(type: GardenElementType): boolean {
  return SURFACE_TYPES.includes(type)
}

export interface GardenElement {
  id: string
  type: GardenElementType
  emoji: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  sun: ElementSun
  customColor?: string
  customBorder?: string
  notes?: string
  linkedPlantId?: string
  /** Dessin v2 résolu (famille/catégorie). Résolu depuis le catalogue à la création. */
  drawKind?: string
  /** Polygone optionnel (zones/structures) — sommets locaux dans [0,width]×[0,height]. */
  points?: GardenPoint[]
}

export interface GardenConfig {
  orientation: GardenOrientation
  compassDeg: number
  solType: SolType
  slopeDeg: number
  slopeDirection: SlopeDirection
  microclimats: MicroClimat[]
  widthMeters: number
  heightMeters: number
  climateZone: ClimateZone
  /** Échelle du plan : pixels du canevas par mètre réel (P2 — cotation). */
  pxPerMeter?: number
}

export interface Garden {
  id: string
  name: string
  elements: GardenElement[]
  config: GardenConfig
  createdAt: string
  updatedAt: string
}

/** Rectangle à 4 coins, en coordonnées locales. */
export function rectPoints(width: number, height: number): GardenPoint[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

/** Polygone effectif d'un élément : ses points, ou le rectangle implicite pour une surface. */
export function effectivePoints(el: GardenElement): GardenPoint[] | undefined {
  if (el.points && el.points.length >= 3) return el.points
  if (isSurfaceType(el.type)) return rectPoints(el.width, el.height)
  return undefined
}
