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
