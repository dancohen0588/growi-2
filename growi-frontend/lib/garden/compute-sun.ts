// growi-frontend/lib/garden/compute-sun.ts
import type { GardenElementType } from './types'

export const TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  mur:            { fill: 'rgba(180,221,127,.28)', stroke: '#5a8a4a' },
  portail:        { fill: 'rgba(246,196,69,.30)',  stroke: '#c49a10' },
  bordure:        { fill: 'rgba(30,86,49,.10)',    stroke: '#2d7a47' },
  cloture:        { fill: 'rgba(180,221,127,.22)', stroke: '#5a8a4a' },
  terrasse:       { fill: 'rgba(222,184,135,.30)', stroke: '#b8925a' },
  abri:           { fill: 'rgba(246,196,69,.22)',  stroke: '#c49a10' },
  massif:         { fill: 'rgba(180,221,127,.18)', stroke: '#8aaa7b' },
  pelouse:        { fill: 'rgba(144,238,144,.28)', stroke: '#5a8a4a' },
  potager:        { fill: 'rgba(180,221,127,.20)', stroke: '#8aaa7b' },
  serre:          { fill: 'rgba(200,240,200,.35)', stroke: '#4a9a5a' },
  allee:          { fill: 'rgba(222,184,135,.22)', stroke: '#b8925a' },
  rocaille:       { fill: 'rgba(180,180,170,.30)', stroke: '#888880' },
  plante:         { fill: 'rgba(180,221,127,.22)', stroke: '#a2cf6b' },
  arbre:          { fill: 'rgba(30,86,49,.14)',    stroke: '#1E5631' },
  eau:            { fill: 'rgba(135,206,235,.30)', stroke: '#5ab4d1' },
  fontaine:       { fill: 'rgba(135,206,235,.30)', stroke: '#5ab4d1' },
  mare:           { fill: 'rgba(100,180,230,.28)', stroke: '#3a90c0' },
  deco:           { fill: 'rgba(246,196,69,.22)',  stroke: '#c49a10' },
  compost:        { fill: 'rgba(139,94,60,.18)',   stroke: '#6b4e2a' },
  eclairage:      { fill: 'rgba(246,196,69,.30)',  stroke: '#c49a10' },
  'station-meteo':{ fill: 'rgba(246,196,69,.22)',  stroke: '#c49a10' },
  pergola:        { fill: 'rgba(180,221,127,.18)', stroke: '#8aaa7b' },
}

export function getTypeColors(type: GardenElementType): { fill: string; stroke: string } {
  return TYPE_COLORS[type] ?? { fill: 'rgba(180,221,127,.20)', stroke: '#5a8a4a' }
}

export function snapToGrid(value: number, gridSize = 20): number {
  return Math.round(value / gridSize) * gridSize
}

export function getSunArcPath(compassDeg: number): { d: string; sunDirection: string } {
  const r = 36, cx = 44, cy = 44
  const toRad = (d: number) => (d - 90) * Math.PI / 180
  const sunDeg = compassDeg
  const x1 = cx + r * Math.cos(toRad(sunDeg - 50))
  const y1 = cy + r * Math.sin(toRad(sunDeg - 50))
  const x2 = cx + r * Math.cos(toRad(sunDeg + 50))
  const y2 = cy + r * Math.sin(toRad(sunDeg + 50))
  const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)}`
  const dirs: Array<[string, number, number]> = [
    ['Nord',   315, 405],
    ['Est',     45, 135],
    ['Sud',    135, 225],
    ['Ouest',  225, 315],
  ]
  const normalized = ((compassDeg % 360) + 360) % 360
  const sunSide = dirs.find(([, a, b]) => {
    const na = ((a % 360) + 360) % 360
    const nb = ((b % 360) + 360) % 360
    if (na < nb) return normalized >= na && normalized < nb
    return normalized >= na || normalized < nb
  })?.[0] ?? 'Sud'
  return { d, sunDirection: sunSide }
}
