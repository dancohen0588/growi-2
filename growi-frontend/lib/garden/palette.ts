// growi-frontend/lib/garden/palette.ts
import type { GardenElementType } from './types'

export interface PaletteItem {
  type: GardenElementType
  emoji: string
  label: string
  defaultWidth: number
  defaultHeight: number
  isCircular?: boolean
  catalogPlantId?: string
  /** Catégorie de la fiche catalogue (pour résoudre le dessin v2 — plantes). */
  catalogCategory?: string
}

// Fallback list used when the dynamic catalog fetch fails
export const FALLBACK_PLANT_ITEMS: PaletteItem[] = [
  { type: 'plante', emoji: '🌹', label: 'Rosier',    defaultWidth: 60, defaultHeight: 60, isCircular: true },
  { type: 'plante', emoji: '🌻', label: 'Tournesol', defaultWidth: 60, defaultHeight: 60, isCircular: true },
  { type: 'plante', emoji: '🌿', label: 'Basilic',   defaultWidth: 50, defaultHeight: 50, isCircular: true },
  { type: 'plante', emoji: '🍅', label: 'Tomate',    defaultWidth: 60, defaultHeight: 60, isCircular: true },
  { type: 'plante', emoji: '🫐', label: 'Myrtille',  defaultWidth: 60, defaultHeight: 60, isCircular: true },
  { type: 'plante', emoji: '🌾', label: 'Graminée',  defaultWidth: 50, defaultHeight: 60, isCircular: true },
  { type: 'plante', emoji: '🌷', label: 'Tulipe',    defaultWidth: 50, defaultHeight: 50, isCircular: true },
  { type: 'plante', emoji: '🎍', label: 'Bambou',    defaultWidth: 50, defaultHeight: 80, isCircular: false },
]

export const PALETTE_CATALOG: Record<string, PaletteItem[]> = {
  'Structures': [
    { type: 'mur',      emoji: '🧱', label: 'Mur',       defaultWidth: 120, defaultHeight: 36 },
    { type: 'portail',  emoji: '🚪', label: 'Portail',   defaultWidth: 80,  defaultHeight: 50 },
    { type: 'bordure',  emoji: '〰️', label: 'Bordure',   defaultWidth: 120, defaultHeight: 28 },
    { type: 'cloture',  emoji: '🪵', label: 'Clôture',   defaultWidth: 120, defaultHeight: 36 },
    { type: 'terrasse', emoji: '🪨', label: 'Terrasse',  defaultWidth: 160, defaultHeight: 120 },
    { type: 'veranda',  emoji: '🪟', label: 'Véranda',   defaultWidth: 140, defaultHeight: 100 },
    { type: 'abri',     emoji: '🏠', label: 'Abri',      defaultWidth: 100, defaultHeight: 100 },
  ],
  'Zones': [
    { type: 'pelouse',  emoji: '🟩', label: 'Pelouse',   defaultWidth: 180, defaultHeight: 140 },
    { type: 'massif',   emoji: '🌸', label: 'Massif',    defaultWidth: 160, defaultHeight: 120 },
    { type: 'potager',  emoji: '🥕', label: 'Potager',   defaultWidth: 160, defaultHeight: 120 },
    { type: 'serre',    emoji: '🏡', label: 'Serre',     defaultWidth: 140, defaultHeight: 100 },
    { type: 'allee',    emoji: '🟫', label: 'Allée',     defaultWidth: 60,  defaultHeight: 160 },
    { type: 'rocaille', emoji: '🌵', label: 'Rocaille',  defaultWidth: 120, defaultHeight: 100 },
  ],
  'Arbres': [
    { type: 'arbre', emoji: '🌳', label: 'Arbre',    defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🌲', label: 'Conifère', defaultWidth: 70, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🍎', label: 'Pommier',  defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🍒', label: 'Cerisier', defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🫒', label: 'Olivier',  defaultWidth: 80, defaultHeight: 80, isCircular: true },
    { type: 'arbre', emoji: '🌴', label: 'Palmier',  defaultWidth: 70, defaultHeight: 90, isCircular: true },
  ],
  'Eau & Équipements': [
    { type: 'fontaine',       emoji: '⛲', label: 'Fontaine',      defaultWidth: 80,  defaultHeight: 80,  isCircular: true },
    { type: 'mare',           emoji: '🏊', label: 'Mare',          defaultWidth: 100, defaultHeight: 80,  isCircular: true },
    { type: 'compost',        emoji: '♻️', label: 'Compost',       defaultWidth: 60,  defaultHeight: 60  },
    { type: 'eclairage',      emoji: '💡', label: 'Éclairage',     defaultWidth: 40,  defaultHeight: 40  },
    { type: 'station-meteo',  emoji: '🌡️', label: 'Station météo', defaultWidth: 40,  defaultHeight: 50  },
    { type: 'pergola',        emoji: '🪴', label: 'Pergola',       defaultWidth: 140, defaultHeight: 100 },
  ],
}
