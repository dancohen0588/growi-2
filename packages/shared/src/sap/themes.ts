import type { SapHomeTheme } from '../constants/sap'

/**
 * Le dessin des thèmes d'Accueil que débloquent les cernes (phase 6).
 *
 * Partagé en **géométrie**, pas en SVG : le mobile le rend avec
 * react-native-svg, le web avec du SVG du DOM, et le même calcul garantit le
 * même dessin des deux côtés. Tout est tiré d'un générateur déterministe — le
 * thème ne bouge pas d'un affichage à l'autre — et dessiné aux dimensions
 * réelles du bloc, pour que fougères et herbes gardent leurs proportions
 * quelle que soit la largeur de l'écran.
 *
 * Le thème se pose **par-dessus** la photo et son voile, et sous le texte :
 * il habille sans jamais gêner la lecture. D'où des opacités basses partout,
 * et rien de plein au milieu du bloc, là où vivent les chiffres.
 *
 * Palette de la charte uniquement : lime, forest, sand, sun.
 */

const LIME = '#B4DD7F'
const FOREST_LIGHT = '#2d7a47'
const SAND = '#F9F7E8'
const SUN = '#F6C445'

export type SapThemeShape =
  | {
      kind: 'path'
      d: string
      fill: string
      fillOpacity: number
      stroke?: string
      strokeOpacity?: number
      strokeWidth?: number
    }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; fillOpacity: number }

export interface SapThemeArt {
  /** Un voile uni sur tout le bloc (`#000000` pour assombrir). */
  veil: { color: string; opacity: number } | null
  /** Une lueur qui part du haut et s'éteint à `stop` (0 à 1 de la hauteur). */
  glow: { color: string; opacity: number; stop: number } | null
  shapes: SapThemeShape[]
}

/** Générateur pseudo-aléatoire minimal (mulberry32) : le même dessin à chaque rendu. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

const round = (value: number) => Math.round(value * 10) / 10

/** Une feuille en amande, de la base vers la pointe. */
function leaf(x: number, y: number, length: number, angle: number, width: number): string {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const tipX = x + dx * length
  const tipY = y + dy * length
  const midX = x + dx * length * 0.5
  const midY = y + dy * length * 0.5
  const nx = -dy * width
  const ny = dx * width
  return `M${round(x)} ${round(y)} Q${round(midX + nx)} ${round(midY + ny)} ${round(tipX)} ${round(tipY)} Q${round(midX - nx)} ${round(midY - ny)} ${round(x)} ${round(y)} Z`
}

/** Point et tangente d'une courbe de Bézier quadratique. */
function quad(t: number, p0: [number, number], p1: [number, number], p2: [number, number]) {
  const u = 1 - t
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
  const tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
  const ty = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
  return { x, y, angle: Math.atan2(ty, tx) }
}

/** Une fougère : une tige courbe et ses folioles, de plus en plus courtes vers la pointe. */
function fern(
  base: [number, number],
  control: [number, number],
  tip: [number, number],
  size: number,
  color: string,
  opacity: number,
): SapThemeShape[] {
  const shapes: SapThemeShape[] = [
    {
      kind: 'path',
      d: `M${round(base[0])} ${round(base[1])} Q${round(control[0])} ${round(control[1])} ${round(tip[0])} ${round(tip[1])}`,
      fill: 'none',
      fillOpacity: 0,
      stroke: color,
      strokeOpacity: opacity * 1.4,
      strokeWidth: Math.max(1.2, size * 0.06),
    },
  ]
  const steps = 11
  for (let i = 1; i <= steps; i++) {
    const t = 0.08 + (i / steps) * 0.86
    const point = quad(t, base, control, tip)
    const length = size * (1.05 - t * 0.85)
    for (const side of [-1, 1]) {
      shapes.push({
        kind: 'path',
        d: leaf(point.x, point.y, length, point.angle + side * 1.05, length * 0.22),
        fill: color,
        fillOpacity: opacity,
      })
    }
  }
  return shapes
}

/** Sous-bois : la pénombre d'un bois, des fougères qui montent des coins, quelques spores. */
function sousBois(width: number, height: number): SapThemeArt {
  const next = random(17)
  const size = Math.min(width, height) * 0.16
  const shapes: SapThemeShape[] = [
    ...fern([-6, height + 4], [width * 0.02, height * 0.62], [width * 0.2, height * 0.42], size, LIME, 0.12),
    ...fern([width * 0.1, height + 6], [width * 0.18, height * 0.74], [width * 0.34, height * 0.66], size * 0.75, LIME, 0.1),
    ...fern([width + 6, height + 4], [width * 0.98, height * 0.6], [width * 0.8, height * 0.4], size, LIME, 0.12),
    // Une fronde qui retombe du haut, côté gauche, derrière le titre.
    ...fern([-8, height * 0.02], [width * 0.12, height * 0.06], [width * 0.24, height * 0.2], size * 0.7, LIME, 0.08),
  ]
  for (let i = 0; i < 14; i++) {
    shapes.push({
      kind: 'circle',
      cx: round(width * (0.08 + next() * 0.84)),
      cy: round(height * (0.18 + next() * 0.5)),
      r: round(1 + next() * 1.6),
      fill: LIME,
      fillOpacity: round(0.25 + next() * 0.35),
    })
  }
  return { veil: { color: '#000000', opacity: 0.18 }, glow: null, shapes }
}

/** Prairie : une lueur de soleil en haut, une bande d'herbes et de fleurs en bas. */
function prairie(width: number, height: number): SapThemeArt {
  const next = random(41)
  const shapes: SapThemeShape[] = [
    { kind: 'circle', cx: round(width * 0.9), cy: round(height * 0.02), r: round(Math.min(width * 0.22, height * 0.55)), fill: SUN, fillOpacity: 0.16 },
    { kind: 'circle', cx: round(width * 0.9), cy: round(height * 0.02), r: round(Math.min(width * 0.13, height * 0.32)), fill: SUN, fillOpacity: 0.18 },
  ]
  const blades = Math.round(width / 7)
  for (let i = 0; i < blades; i++) {
    const x = (i / blades) * width + next() * 6
    const tall = height * (0.08 + next() * 0.12)
    const lean = (next() - 0.5) * 22
    const color = next() > 0.45 ? LIME : FOREST_LIGHT
    shapes.push({
      kind: 'path',
      d: `M${round(x - 2)} ${round(height + 2)} Q${round(x + lean * 0.4)} ${round(height - tall * 0.6)} ${round(x + lean)} ${round(height - tall)} Q${round(x + lean * 0.4 + 2.4)} ${round(height - tall * 0.6)} ${round(x + 2)} ${round(height + 2)} Z`,
      fill: color,
      fillOpacity: color === LIME ? 0.3 : 0.5,
    })
  }
  for (let i = 0; i < 7; i++) {
    const cx = width * (0.05 + next() * 0.9)
    const cy = height * (0.9 + next() * 0.06)
    shapes.push({ kind: 'circle', cx: round(cx), cy: round(cy), r: 3.4, fill: SUN, fillOpacity: 0.7 })
    shapes.push({ kind: 'circle', cx: round(cx), cy: round(cy), r: 1.3, fill: SAND, fillOpacity: 0.9 })
  }
  return { veil: null, glow: { color: SUN, opacity: 0.22, stop: 0.45 }, shapes }
}

/** Crépuscule : le haut du bloc s'assombrit, un croissant de lune, des étoiles. */
function crepuscule(width: number, height: number): SapThemeArt {
  const next = random(73)
  const moonX = width * 0.8
  const moonY = height * 0.3
  const moonR = Math.max(12, Math.min(width, height) * 0.045)
  const shapes: SapThemeShape[] = [
    { kind: 'circle', cx: round(moonX), cy: round(moonY), r: round(moonR * 2.6), fill: SUN, fillOpacity: 0.07 },
    {
      kind: 'path',
      d: crescent(moonX, moonY, moonR),
      fill: SUN,
      fillOpacity: 0.85,
    },
  ]
  for (let i = 0; i < 22; i++) {
    shapes.push({
      kind: 'circle',
      cx: round(width * next()),
      cy: round(height * (0.04 + next() * 0.48)),
      r: round(0.7 + next() * 1.3),
      fill: SAND,
      fillOpacity: round(0.35 + next() * 0.55),
    })
  }
  return { veil: null, glow: { color: '#000000', opacity: 0.38, stop: 0.6 }, shapes }
}

/** Un croissant tourné vers la gauche, sans masque (react-native-svg les gère mal). */
function crescent(cx: number, cy: number, r: number): string {
  const inner = r * 0.78
  const top = `${round(cx)} ${round(cy - r)}`
  const bottom = `${round(cx)} ${round(cy + r)}`
  return `M${top} A${round(r)} ${round(r)} 0 1 0 ${bottom} A${round(inner)} ${round(r)} 0 1 1 ${top} Z`
}

/** Le dessin d'un thème, aux dimensions du bloc qu'il habille. */
export function sapThemeArt(theme: SapHomeTheme, width: number, height: number): SapThemeArt {
  if (width <= 0 || height <= 0) return { veil: null, glow: null, shapes: [] }
  switch (theme) {
    case 'sous-bois':
      return sousBois(width, height)
    case 'prairie':
      return prairie(width, height)
    case 'crepuscule':
      return crepuscule(width, height)
  }
}
