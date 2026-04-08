// growi-frontend/lib/garden/defaults.ts
import type { GardenConfig, Garden, SolType, GardenOrientation } from './types'

export const DEFAULT_GARDEN_CONFIG: GardenConfig = {
  orientation: 'S',
  compassDeg: 180,
  solType: 'argileux',
  slopeDeg: 0,
  slopeDirection: 'N',
  microclimats: [],
  widthMeters: 10,
  heightMeters: 15,
  climateZone: 'oceanique',
}

export function createDefaultGarden(): Garden {
  return {
    id: 'main',
    name: 'Mon jardin',
    elements: [],
    config: DEFAULT_GARDEN_CONFIG,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const SOL_INFOS: Record<SolType, string> = {
  argileux: "🌱 Retient bien l'eau · pH neutre à basique",
  sableux:  '🏜️ Drainage rapide · Réchauffe vite · Pauvre en nutriments',
  limoneux: '🌾 Bon équilibre eau/air · Fertile · Idéal légumes',
  calcaire: '⛰️ Drainant · pH basique · Riche en calcium',
  tourbeux: "💧 Très acide · Retient l'eau · Riche en M.O.",
  fertile:  '🌱 Idéal · Équilibré · Convient à toutes cultures',
}

export const ORIENTATION_TO_DEG: Record<GardenOrientation, number> = {
  S: 180, N: 0, E: 90, O: 270,
  SE: 135, SO: 225, NE: 45, NO: 315,
}

export const ORIENTATION_LABELS: Record<GardenOrientation, string> = {
  S: 'Façade Sud', N: 'Façade Nord', E: 'Est', O: 'Ouest',
  SE: 'Sud-Est', SO: 'Sud-Ouest', NE: 'Nord-Est', NO: 'Nord-Ouest',
}
