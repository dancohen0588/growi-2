// growi-frontend/lib/garden/scale.ts
//
// Système de cotation (P2) — conversions entre pixels du canevas et mètres réels.
// L'échelle est portée par `GardenConfig.pxPerMeter`. Tant que l'assistant de
// création (P4) ne la fixe pas, on retombe sur une valeur par défaut où une
// case de grille (40 px) vaut 1 mètre.

export const DEFAULT_PX_PER_METER = 40

/** Échelle effective d'un jardin (valeur de config ou défaut). */
export function pxPerMeterOf(pxPerMeter?: number | null): number {
  return pxPerMeter && pxPerMeter > 0 ? pxPerMeter : DEFAULT_PX_PER_METER
}

/** Pixels → mètres. */
export function pxToM(px: number, pxPerMeter?: number | null): number {
  return px / pxPerMeterOf(pxPerMeter)
}

/** Mètres → pixels. */
export function mToPx(m: number, pxPerMeter?: number | null): number {
  return m * pxPerMeterOf(pxPerMeter)
}

/**
 * Formate une longueur en pixels comme une cote lisible :
 * ≥ 1 m → « 1,15 m » · < 1 m → « 85 cm ». Décimale française (virgule).
 */
export function formatCote(px: number, pxPerMeter?: number | null): string {
  const m = pxToM(px, pxPerMeter)
  if (m >= 1) return `${m.toFixed(2).replace('.', ',')} m`
  return `${Math.round(m * 100)} cm`
}

/**
 * Interprète une saisie utilisateur en mètres.
 * Accepte « 1,15 », « 1.15 m », « 85 cm ». Renvoie des mètres, ou null si invalide.
 */
export function parseCote(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.')
  if (!s) return null
  const isCm = s.includes('cm')
  const num = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!isFinite(num) || num <= 0) return null
  return isCm ? num / 100 : num
}
