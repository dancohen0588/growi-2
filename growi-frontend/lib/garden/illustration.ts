// growi-frontend/lib/garden/illustration.ts
//
// Moteur de rendu illustré v2 du plan de jardin (P1-b / P1-c).
//
// Chaque élément est dessiné en SVG procédural & déterministe (graine = id),
// rasterisé à la volée (data URL → HTMLImageElement) puis affiché en Konva.Image.
// 6 familles (arbres, plantes, zones, structures, eau, équipements) + 50 dessins
// de potager générés par 9 archétypes paramétriques.

/* ════════ outils ════════ */

type Rng = () => number
type Pal = readonly string[]
type Spec = Record<string, any>

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/* ════════ primitives de dessin (coordonnées tuile 150×132, motif centré 75,66) ════════ */

const CX = 75, CY = 66
const DEFS = `<defs>`
  + `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>`
  + `<radialGradient id="sph" cx="36%" cy="32%" r="74%"><stop offset="0%" stop-color="#c8e6a0"/><stop offset="55%" stop-color="#86b85f"/><stop offset="100%" stop-color="#4d7b3a"/></radialGradient>`
  + `<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe890"/><stop offset="55%" stop-color="rgba(246,196,69,.5)"/><stop offset="100%" stop-color="rgba(246,196,69,0)"/></radialGradient>`
  + `<radialGradient id="wat" cx="40%" cy="34%" r="72%"><stop offset="0%" stop-color="#c4e6ee"/><stop offset="60%" stop-color="#7cc0d6"/><stop offset="100%" stop-color="#4d8fb2"/></radialGradient>`
  + `</defs>`

const P_TREE: Pal = ['#2f5a32', '#3f7a3e', '#5a9a4e', '#80bd66', '#a8d182']
const P_PLANT: Pal = ['#4a7e3f', '#5f9a4f', '#7cb567', '#9bcd86', '#bce1a8']
const P_HERB: Pal = ['#5c7748', '#6f8a55', '#869f68', '#9db17e', '#b6c596']

function shadow(cx: number, cy: number, rx: number, ry: number, op?: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(20,40,20,${op ?? 0.26})" filter="url(#bl)"/>`
}
function canopy(cx: number, cy: number, r: number, pal: Pal, rd: Rng, noShadow?: boolean): string {
  let g = ''
  if (!noShadow) g += shadow(cx + r * 0.12, cy + r * 0.3, r * 0.94, r * 0.5)
  g += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.92}" ry="${r * 0.9}" fill="${pal[1]}"/>`
  const n = Math.min(64, Math.max(22, Math.round((r * r) / 24)))
  const d: { x: number; y: number; dr: number; idx: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = rd() * Math.PI * 2, di = Math.sqrt(rd())
    const x = cx + Math.cos(a) * di * r * 0.98, y = cy + Math.sin(a) * di * r * 0.94
    const dr = r * (0.34 - 0.13 * di) + rd() * r * 0.09
    const li = (-Math.cos(a) - Math.sin(a)) * 0.5
    const sc = li * 0.5 + (1 - di) * 0.22 + (rd() - 0.5) * 0.72
    d.push({ x, y, dr, idx: Math.max(0, Math.min(4, Math.round(((sc + 1) / 2) * 4))) })
  }
  d.sort((p, q) => p.idx - q.idx)
  for (const x of d) g += `<circle cx="${x.x.toFixed(1)}" cy="${x.y.toFixed(1)}" r="${Math.max(0.6, x.dr).toFixed(1)}" fill="${pal[x.idx]}"/>`
  for (let i = 0; i < n * 0.2; i++) {
    const a = Math.PI * 1.25 + (rd() - 0.5) * 1.2, di = Math.sqrt(rd()) * 0.66
    g += `<circle cx="${(cx + Math.cos(a) * di * r).toFixed(1)}" cy="${(cy + Math.sin(a) * di * r).toFixed(1)}" r="${(r * 0.1 + rd() * r * 0.07).toFixed(1)}" fill="${pal[4]}" opacity=".5"/>`
  }
  return g
}
function spikes(cx: number, cy: number, r: number, inner: number, n: number, fill: string): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? inner : r, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `<path d="M${pts.join(' L')} Z" fill="${fill}"/>`
}
function flower(fx: number, fy: number, fr: number, col: string): string {
  let g = ''
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2
    g += `<circle cx="${(fx + Math.cos(a) * fr).toFixed(1)}" cy="${(fy + Math.sin(a) * fr).toFixed(1)}" r="${(fr * 0.92).toFixed(1)}" fill="${col}"/>`
  }
  return g + `<circle cx="${fx}" cy="${fy}" r="${(fr * 0.78).toFixed(1)}" fill="#f6c445"/>`
}
function leafFrom(cx: number, cy: number, len: number, wid: number, deg: number, fill: string, rib?: string | null): string {
  const ey = cy - len / 2
  let s = `<g transform="rotate(${deg} ${cx} ${cy})"><ellipse cx="${cx}" cy="${ey.toFixed(1)}" rx="${wid}" ry="${(len / 2).toFixed(1)}" fill="${fill}"/>`
  if (rib) s += `<line x1="${cx}" y1="${(cy - 3).toFixed(1)}" x2="${cx}" y2="${(cy - len + 4).toFixed(1)}" stroke="${rib}" stroke-width="1.5"/>`
  return s + `</g>`
}
function berryD(x: number, y: number, r: number, col: string): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col}"/>`
    + `<circle cx="${(x - r * 0.34).toFixed(1)}" cy="${(y - r * 0.34).toFixed(1)}" r="${(r * 0.34).toFixed(1)}" fill="#fff" opacity=".5"/>`
}

/* ════════ FAMILLE A — arbres ════════ */

function mFeuillu(r: Rng): string { return canopy(CX, CY, 52, P_TREE, r) }
function mConifere(): string {
  let g = shadow(CX + 6, CY + 34, 46, 22)
  g += spikes(CX, CY + 4, 52, 30, 15, '#26432b')
  g += spikes(CX, CY - 2, 40, 23, 15, '#33583a')
  g += spikes(CX, CY - 8, 27, 15, 15, '#4a774d')
  g += spikes(CX, CY - 13, 14, 8, 15, '#6b9669')
  return g + `<circle cx="${CX}" cy="${CY - 13}" r="4" fill="#8fb583"/>`
}
function mFruitier(r: Rng): string {
  let g = canopy(CX, CY, 50, P_TREE, r)
  const fc = ['#d8423a', '#e0532f', '#e87a2c']
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, di = Math.sqrt(r()) * 40
    const x = CX + Math.cos(a) * di, y = CY + Math.sin(a) * di * 0.95
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${fc[(r() * 3) | 0]}"/>`
    g += `<circle cx="${(x - 1.4).toFixed(1)}" cy="${(y - 1.4).toFixed(1)}" r="1.6" fill="#fff" opacity=".55"/>`
  }
  return g
}
function mPalmier(): string {
  let g = shadow(CX + 6, CY + 30, 44, 20)
  for (let k = 0; k < 10; k++) {
    const dark = k % 2 === 0
    g += `<g transform="rotate(${k * 36} ${CX} ${CY})"><ellipse cx="${CX}" cy="${CY - 32}" rx="9" ry="30" fill="${dark ? '#3a6a36' : '#5a9a4e'}"/><line x1="${CX}" y1="${CY - 6}" x2="${CX}" y2="${CY - 60}" stroke="#2f5a32" stroke-width="1.6"/></g>`
  }
  return g + `<circle cx="${CX}" cy="${CY}" r="8" fill="#7b5e3c"/><circle cx="${CX - 2}" cy="${CY - 2}" r="3" fill="#9a7a52"/>`
}
function mArbuste(r: Rng): string {
  let g = shadow(CX + 5, CY + 30, 40, 18)
  g += `<circle cx="${CX}" cy="${CY}" r="46" fill="url(#sph)"/>`
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, di = Math.sqrt(r()) * 40
    g += `<circle cx="${(CX + Math.cos(a) * di).toFixed(1)}" cy="${(CY + Math.sin(a) * di).toFixed(1)}" r="${(3 + r() * 5).toFixed(1)}" fill="${r() > 0.5 ? '#6ea24f' : '#92c172'}" opacity=".5"/>`
  }
  return g + `<circle cx="${CX}" cy="${CY}" r="46" fill="none" stroke="#3f6f37" stroke-width="2" opacity=".55"/>`
}

/* ════════ FAMILLE B — plantes ════════ */

function mFleur(r: Rng): string {
  let g = shadow(CX + 4, CY + 28, 36, 16)
  g += canopy(CX, CY + 6, 32, P_PLANT, r, true)
  const fc = ['#e98cb6', '#f4c64e', '#fbf3e0', '#c98ed8', '#ef7a64', '#ef5d8f']
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, di = Math.sqrt(r()) * 26
    g += flower(CX + Math.cos(a) * di, CY + 6 + Math.sin(a) * di * 0.9, 4 + r() * 2, fc[(r() * fc.length) | 0])
  }
  return g
}
function mAromatique(r: Rng): string {
  let g = shadow(CX + 3, CY + 24, 30, 13)
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, di = Math.sqrt(r()) * 30
    g += `<circle cx="${(CX + Math.cos(a) * di).toFixed(1)}" cy="${(CY + Math.sin(a) * di * 0.92).toFixed(1)}" r="${(2.6 + r() * 3).toFixed(1)}" fill="${P_HERB[(r() * P_HERB.length) | 0]}"/>`
  }
  return g
}
function mGrimpante(): string {
  let g = shadow(CX, CY + 52, 20, 9)
  g += `<path d="M${CX} 120 C ${CX - 14} 92 ${CX + 14} 56 ${CX} 18" fill="none" stroke="#3f6f37" stroke-width="3.4"/>`
  for (let i = 0; i < 7; i++) {
    const t = i / 7, y = 118 - t * 96, side = i % 2 ? 1 : -1
    const lx = CX + side * (8 + Math.sin(t * 6) * 5)
    g += `<g transform="rotate(${side * 40} ${lx} ${y})"><ellipse cx="${lx}" cy="${y}" rx="13" ry="8" fill="${i % 2 ? '#5f9a4f' : '#74b35e'}"/><line x1="${lx - 12}" y1="${y}" x2="${lx + 12}" y2="${y}" stroke="#3f6f37" stroke-width="1"/></g>`
  }
  g += `<path d="M${CX + 6} 44 q 12 -4 8 -14 q -3 -7 -11 -3" fill="none" stroke="#6ea24f" stroke-width="2"/>`
  return g + `<path d="M${CX - 8} 80 q -12 -4 -8 -14 q 3 -7 11 -3" fill="none" stroke="#6ea24f" stroke-width="2"/>`
}
function mGraminee(r: Rng): string {
  let g = shadow(CX, CY + 50, 22, 9)
  const cols = ['#5f8a3f', '#73a14f', '#8ab863', '#a3cc80']
  for (let i = 0; i < 15; i++) {
    const t = i / 14, ang = (-58 + t * 116) * Math.PI / 180
    const len = 58 + r() * 40
    const tx = CX + Math.sin(ang) * len * 0.7, ty = 114 - Math.cos(ang) * len
    const cx2 = CX + Math.sin(ang) * len * 0.32, cy2 = 114 - Math.cos(ang) * len * 0.55
    g += `<path d="M${CX} 114 Q ${cx2.toFixed(1)} ${cy2.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="${cols[(r() * 4) | 0]}" stroke-width="${(2.6 + r() * 2.4).toFixed(1)}" stroke-linecap="round"/>`
  }
  return g
}
function mSucculente(): string {
  let g = shadow(CX + 3, CY + 24, 30, 13)
  const ros = (len: number, n: number, col: string) => {
    let o = ''
    for (let k = 0; k < n; k++)
      o += `<g transform="rotate(${(k / n) * 360} ${CX} ${CY})"><path d="M${CX} ${CY} Q ${CX - 6} ${CY - len * 0.6} ${CX} ${CY - len} Q ${CX + 6} ${CY - len * 0.6} ${CX} ${CY} Z" fill="${col}"/></g>`
    return o
  }
  g += ros(40, 11, '#5f8a6e') + ros(28, 8, '#76a283') + ros(16, 6, '#93b89c')
  return g + `<circle cx="${CX}" cy="${CY}" r="4" fill="#b8d0b4"/>`
}
function mVivace(): string {
  let g = shadow(CX + 4, CY + 26, 34, 15)
  for (let k = 0; k < 6; k++)
    g += `<g transform="rotate(${(k / 6) * 360 + 18} ${CX} ${CY})"><ellipse cx="${CX}" cy="${CY - 16}" rx="15" ry="25" fill="${k % 2 ? '#3f7a3e' : '#4f8a45'}"/><line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - 38}" stroke="#2f5a32" stroke-width="1.8"/></g>`
  return g + `<circle cx="${CX}" cy="${CY}" r="8" fill="#5a9a4e"/>`
}
function mAquatique(r: Rng): string {
  let g = `<ellipse cx="${CX}" cy="${CY + 4}" rx="54" ry="48" fill="url(#wat)" opacity=".55"/>`
  const pad = (px: number, py: number, pr: number, rot: number) =>
    `<g transform="rotate(${rot} ${px} ${py})"><circle cx="${px}" cy="${py}" r="${pr}" fill="#4f8a45"/><path d="M${px} ${py} L${px + pr} ${py - 3} L${px + pr} ${py + 3} Z" fill="url(#wat)"/></g>`
  g += pad(CX - 16, CY - 10, 18, 20) + pad(CX + 20, CY + 8, 20, -40) + pad(CX - 6, CY + 24, 15, 120)
  return g + flower(CX + 14, CY - 16, 3.4, '#f2d6e4')
}

/* ════════ FAMILLE E — eau (point) ════════ */

function mFontaine(): string {
  let g = shadow(CX, CY + 30, 42, 10)
  g += `<circle cx="${CX}" cy="${CY}" r="48" fill="#a8a29a"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="40" fill="url(#wat)"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="30" fill="none" stroke="#fff" stroke-width="1.6" opacity=".4"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="20" fill="none" stroke="#fff" stroke-width="1.6" opacity=".5"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="11" fill="#8f8a82"/>`
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    g += `<circle cx="${(CX + Math.cos(a) * 7).toFixed(1)}" cy="${(CY + Math.sin(a) * 7).toFixed(1)}" r="2.4" fill="#eaf6fb"/>`
  }
  return g + `<circle cx="${CX}" cy="${CY}" r="4" fill="#fff"/>`
}
function mMare(r: Rng): string {
  let g = shadow(CX + 4, CY + 26, 50, 16)
  g += `<ellipse cx="${CX}" cy="${CY}" rx="58" ry="44" fill="#6a8a4a"/>`
  g += `<ellipse cx="${CX}" cy="${CY}" rx="52" ry="38" fill="url(#wat)"/>`
  g += `<ellipse cx="${CX - 8}" cy="${CY - 6}" rx="30" ry="20" fill="none" stroke="#fff" stroke-width="1.4" opacity=".4"/>`
  const pad = (px: number, py: number, pr: number) =>
    `<circle cx="${px}" cy="${py}" r="${pr}" fill="#4f8a45"/><path d="M${px} ${py} L${px + pr} ${py - 3} L${px + pr} ${py + 3} Z" fill="url(#wat)"/>`
  g += pad(CX - 20, CY - 8, 13) + pad(CX + 18, CY + 6, 15) + pad(CX + 2, CY + 18, 10)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    g += `<circle cx="${(CX + Math.cos(a) * 54).toFixed(1)}" cy="${(CY + Math.sin(a) * 40).toFixed(1)}" r="${(3 + r() * 3).toFixed(1)}" fill="#5f9a4f"/>`
  }
  return g
}

/* ════════ FAMILLE F — équipements (point) ════════ */

function mCompost(r: Rng): string {
  let g = shadow(CX, CY + 28, 38, 8)
  g += `<rect x="34" y="${CY - 28}" width="82" height="58" rx="5" fill="#7a5a36"/>`
  for (let y = CY - 24; y < CY + 26; y += 12) g += `<rect x="38" y="${y}" width="74" height="8" rx="2" fill="#8f6b40"/>`
  g += `<rect x="40" y="${CY - 26}" width="70" height="20" rx="3" fill="#4a3a24"/>`
  for (let i = 0; i < 14; i++)
    g += `<circle cx="${(44 + r() * 62).toFixed(1)}" cy="${(CY - 22 + r() * 12).toFixed(1)}" r="${(1.4 + r() * 2).toFixed(1)}" fill="${r() > 0.5 ? '#6a8a3a' : '#9a7a3a'}"/>`
  return g + `<rect x="34" y="${CY - 28}" width="82" height="58" rx="5" fill="none" stroke="#5a4226" stroke-width="2"/>`
}
function mEclairage(): string {
  let g = `<circle cx="${CX}" cy="${CY}" r="46" fill="url(#glow)"/>`
  g += shadow(CX, CY + 22, 16, 5)
  g += `<circle cx="${CX}" cy="${CY}" r="15" fill="#3a4a3a"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="10" fill="#ffe890"/>`
  g += `<circle cx="${CX - 3}" cy="${CY - 3}" r="3.4" fill="#fff"/>`
  return g + `<rect x="${CX - 4}" y="${CY + 12}" width="8" height="14" rx="2" fill="#4a4a44"/>`
}
function mStationMeteo(): string {
  let g = shadow(CX, CY + 26, 26, 7)
  g += `<rect x="${CX - 26}" y="${CY - 22}" width="52" height="46" rx="7" fill="#e7e3d6" stroke="#b7b1a0" stroke-width="2"/>`
  g += `<circle cx="${CX - 9}" cy="${CY - 5}" r="9" fill="#7FC8DD"/>`
  g += `<circle cx="${CX - 9}" cy="${CY - 5}" r="9" fill="none" stroke="#3a90c0" stroke-width="1.6"/>`
  g += `<line x1="${CX - 9}" y1="${CY - 5}" x2="${CX - 9}" y2="${CY - 11}" stroke="#1E5631" stroke-width="1.6"/>`
  g += `<rect x="${CX + 3}" y="${CY - 12}" width="16" height="4" rx="2" fill="#F6C445"/>`
  g += `<rect x="${CX + 3}" y="${CY - 4}" width="16" height="4" rx="2" fill="#B4DD7F"/>`
  g += `<rect x="${CX + 3}" y="${CY + 4}" width="11" height="4" rx="2" fill="#b7b1a0"/>`
  g += `<line x1="${CX}" y1="${CY - 22}" x2="${CX}" y2="${CY - 34}" stroke="#8a8478" stroke-width="2"/>`
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    g += `<circle cx="${(CX + Math.cos(a) * 7).toFixed(1)}" cy="${(CY - 34 + Math.sin(a) * 7).toFixed(1)}" r="3" fill="#5f7a63"/>`
  }
  return g
}
function mDeco(r: Rng): string {
  let g = shadow(CX, CY + 24, 28, 8)
  g += `<circle cx="${CX}" cy="${CY}" r="34" fill="#c47a4a"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="34" fill="none" stroke="#9c5d34" stroke-width="3"/>`
  g += `<circle cx="${CX}" cy="${CY}" r="26" fill="#6d563d"/>`
  g += canopy(CX, CY - 2, 22, P_PLANT, r, true)
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, di = Math.sqrt(r()) * 14
    g += flower(CX + Math.cos(a) * di, CY - 2 + Math.sin(a) * di, 3, ['#e98cb6', '#f4c64e', '#c98ed8'][(r() * 3) | 0])
  }
  return g
}

/* ════════ archétypes potager (9) ════════ */

function aRosette(sp: Spec, r: Rng): string {
  const sc = sp.scale || 1
  let g = shadow(CX + 4, CY + 25 * sc, 32 * sc, 14 * sc)
  const layers: [number, number, number, string, number][] = [
    [sp.leaves, sp.len * sc, sp.wid * sc, sp.pal[0], 0],
    [Math.round(sp.leaves * 0.7), sp.len * 0.6 * sc, sp.wid * 0.86 * sc, sp.pal[1], 1],
  ]
  for (const L of layers) {
    for (let k = 0; k < L[0]; k++) {
      const ang = (k / L[0]) * 360 + (L[4] ? 180 / L[0] : 0) + (r() - 0.5) * 16
      g += leafFrom(CX, CY, L[1], L[2], ang, L[3], sp.rib)
      const a = (ang * Math.PI) / 180
      if (sp.frilly) {
        const ex = CX + Math.sin(a) * L[1] * 0.86, ey = CY - Math.cos(a) * L[1] * 0.86
        g += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${(L[2] * 0.62).toFixed(1)}" fill="${L[3]}"/>`
      }
      if (sp.crinkle) for (let c = 0; c < 3; c++) {
        const t = 0.3 + c * 0.24
        g += `<circle cx="${(CX + Math.sin(a) * L[1] * t).toFixed(1)}" cy="${(CY - Math.cos(a) * L[1] * t).toFixed(1)}" r="2" fill="${sp.pal[2] || sp.pal[0]}" opacity=".5"/>`
      }
    }
  }
  if (sp.heart === 'ball') {
    g += `<circle cx="${CX}" cy="${CY}" r="${17 * sc}" fill="${sp.heartCol}"/>`
    g += `<circle cx="${CX - 5}" cy="${CY - 5}" r="${8 * sc}" fill="#fff" opacity=".35"/>`
  } else if (sp.heart === 'curd') {
    for (let i = 0; i < 18; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 15 * sc
      g += `<circle cx="${(CX + Math.cos(a) * d).toFixed(1)}" cy="${(CY + Math.sin(a) * d).toFixed(1)}" r="${(3.6 * sc).toFixed(1)}" fill="#f1ecd8"/>`
    }
  } else if (sp.heart === 'floret') {
    for (let i = 0; i < 20; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 15 * sc
      g += `<circle cx="${(CX + Math.cos(a) * d).toFixed(1)}" cy="${(CY + Math.sin(a) * d).toFixed(1)}" r="${(3 * sc).toFixed(1)}" fill="${i % 2 ? '#3a6b52' : '#2f5a45'}"/>`
    }
  } else if (sp.heart === 'sprouts') {
    for (let i = 0; i < 8; i++) {
      const a = r() * 6.28, d = 7 + r() * 17
      g += `<circle cx="${(CX + Math.cos(a) * d).toFixed(1)}" cy="${(CY + Math.sin(a) * d).toFixed(1)}" r="4" fill="#7caa5a"/>`
    }
    g += `<circle cx="${CX}" cy="${CY}" r="6" fill="#6b9a4c"/>`
  }
  if (sp.berries) for (let i = 0; i < sp.berries; i++) {
    const a = r() * 6.28, d = 8 + r() * 17, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d
    g += `<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)} q5 1 4 7 q-4 5 -8 0 q-1 -6 4 -7Z" fill="#e23b3a"/>`
  }
  if (sp.flowers) for (let i = 0; i < sp.flowers; i++) {
    const a = r() * 6.28, d = 11 + r() * 15
    g += flower(CX + Math.cos(a) * d, CY + Math.sin(a) * d, 3, '#ffffff')
  }
  return g
}
function drawFruit(x: number, y: number, f: Spec, r: Rng): string {
  const fr = f.r, deg = ((r() - 0.5) * 70).toFixed(0)
  if (f.shape === 'sphere')
    return berryD(x, y, fr, f.col) + `<line x1="${x.toFixed(1)}" y1="${(y - fr).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - fr - 3).toFixed(1)}" stroke="#3a6a33" stroke-width="2"/>`
  if (f.shape === 'long')
    return `<g transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(fr * 0.42).toFixed(1)}" ry="${(fr * 1.5).toFixed(1)}" fill="${f.col}"/></g>`
  if (f.shape === 'pepper')
    return `<g transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${(x - fr * 0.72).toFixed(1)}" y="${(y - fr * 0.8).toFixed(1)}" width="${(fr * 1.44).toFixed(1)}" height="${(fr * 1.7).toFixed(1)}" rx="${(fr * 0.5).toFixed(1)}" fill="${f.col}"/><line x1="${x.toFixed(1)}" y1="${(y - fr * 0.8).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - fr * 1.15).toFixed(1)}" stroke="#3a6a33" stroke-width="2.6"/></g>`
  return `<g transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(fr * 0.6).toFixed(1)}" ry="${(fr * 1.35).toFixed(1)}" fill="${f.col}"/><ellipse cx="${(x - fr * 0.22).toFixed(1)}" cy="${(y - fr * 0.5).toFixed(1)}" rx="${(fr * 0.18).toFixed(1)}" ry="${(fr * 0.5).toFixed(1)}" fill="#fff" opacity=".4"/></g>`
}
function aFruitFoliage(sp: Spec, r: Rng): string {
  let g = canopy(CX, CY + 4, sp.folR, sp.folPal || P_PLANT, r)
  for (let i = 0; i < sp.fruit.n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * sp.folR * 0.72
    g += drawFruit(CX + Math.cos(a) * d, CY + 4 + Math.sin(a) * d * 0.9, sp.fruit, r)
  }
  if (sp.flower) {
    const a = r() * 6.28, d = sp.folR * 0.5
    g += flower(CX + Math.cos(a) * d, CY + 4 + Math.sin(a) * d, 5, '#f6c445')
  }
  return g
}
function aVine(sp: Spec, r: Rng): string {
  let g = shadow(CX + 6, CY + 30, 52, 16)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.28 + r() * 0.4, d = 30 + r() * 8
    g += leafFrom(CX + Math.cos(a) * d, CY + Math.sin(a) * d * 0.86, 30, 18, (k / 6) * 360, k % 2 ? '#4f8a45' : '#5e9a52', '#3a6a33')
  }
  const F = sp.fruit, fx = CX, fy = CY + 2
  if (F.kind === 'pumpkin') {
    g += `<circle cx="${fx}" cy="${fy}" r="${F.r}" fill="${F.col}"/>`
    for (let k = -2; k <= 2; k++) g += `<path d="M${fx} ${fy - F.r} Q${fx + k * F.r * 0.5} ${fy} ${fx} ${fy + F.r}" fill="none" stroke="rgba(120,60,10,.35)" stroke-width="2"/>`
    g += `<rect x="${fx - 3}" y="${fy - F.r - 6}" width="6" height="9" rx="2" fill="#5f7a3a"/>`
    g += `<ellipse cx="${fx - F.r * 0.35}" cy="${fy - F.r * 0.35}" rx="${F.r * 0.3}" ry="${F.r * 0.2}" fill="#fff" opacity=".3"/>`
  } else if (F.kind === 'striped') {
    g += `<ellipse cx="${fx}" cy="${fy}" rx="${F.r * 1.15}" ry="${F.r}" fill="${F.col}"/>`
    for (let k = -2; k <= 2; k++) g += `<path d="M${fx + k * F.r * 0.4} ${fy - F.r} Q${fx + k * F.r * 0.55} ${fy} ${fx + k * F.r * 0.4} ${fy + F.r}" fill="none" stroke="#2f5a2c" stroke-width="3"/>`
  } else {
    g += `<circle cx="${fx}" cy="${fy}" r="${F.r}" fill="${F.col}"/>`
    for (let k = -3; k <= 3; k++) g += `<path d="M${fx} ${fy - F.r} Q${fx + k * F.r * 0.34} ${fy} ${fx} ${fy + F.r}" fill="none" stroke="#b0a86a" stroke-width="1.4"/>`
    g += `<ellipse cx="${fx - F.r * 0.3}" cy="${fy - F.r * 0.3}" rx="${F.r * 0.3}" ry="${F.r * 0.2}" fill="#fff" opacity=".3"/>`
  }
  return g
}
function aRootTops(sp: Spec, r: Rng): string {
  let g = shadow(CX, CY + 25, 28, 12)
  g += `<ellipse cx="${CX}" cy="${CY + 11}" rx="${sp.crownR}" ry="${(sp.crownR * 0.8).toFixed(1)}" fill="${sp.crownCol}"/>`
  if (sp.crownHi) g += `<ellipse cx="${CX}" cy="${CY + 6}" rx="${(sp.crownR * 0.7).toFixed(1)}" ry="${(sp.crownR * 0.4).toFixed(1)}" fill="${sp.crownHi}" opacity=".85"/>`
  const bx = CX, by = CY + 8
  if (sp.style === 'feathery') {
    for (let i = 0; i < 26; i++) {
      const ang = (-72 + (i / 25) * 144) * Math.PI / 180, len = 40 + r() * 30
      const tx = bx + Math.sin(ang) * len, ty = by - Math.cos(ang) * len
      const mx = bx + Math.sin(ang) * len * 0.5, my = by - Math.cos(ang) * len * 0.5 - 7
      g += `<path d="M${bx} ${by} Q${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="${['#4f8a3f', '#6aa450', '#8abf6a'][(r() * 3) | 0]}" stroke-width="1.7" stroke-linecap="round"/>`
    }
  } else {
    const n = sp.style === 'broad' ? 6 : 8, len = sp.style === 'broad' ? 42 : 34, w = sp.style === 'broad' ? 16 : 11
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * 360 + (r() - 0.5) * 22
      g += leafFrom(bx, by, len, w, ang, k % 2 ? sp.pal[0] : sp.pal[1], sp.rib)
    }
  }
  if (sp.bulb) g += `<ellipse cx="${CX}" cy="${CY + 15}" rx="14" ry="11" fill="${sp.bulb}"/>`
  return g
}
function aBulb(sp: Spec, r: Rng): string {
  let g = shadow(CX, CY + 30, 24, 9)
  g += `<ellipse cx="${CX}" cy="${CY + 24}" rx="${sp.bulbR}" ry="${(sp.bulbR * 0.8).toFixed(1)}" fill="${sp.bulbCol}"/>`
  const bx = CX, by = CY + 22
  for (let i = 0; i < sp.n; i++) {
    const t = sp.n > 1 ? i / (sp.n - 1) : 0.5
    const ang = (-48 + t * 96) * Math.PI / 180 + (r() - 0.5) * 0.16, len = 52 + r() * 30
    const tx = bx + Math.sin(ang) * len, ty = by - Math.cos(ang) * len
    const mx = bx + Math.sin(ang) * len * 0.45, my = by - Math.cos(ang) * len * 0.5
    const w = sp.bladeW
    g += `<path d="M${(bx - w).toFixed(1)} ${by} Q${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q${(mx + w * 0.6).toFixed(1)} ${my.toFixed(1)} ${(bx + w).toFixed(1)} ${by} Z" fill="${i % 2 ? sp.pal[0] : sp.pal[1]}"/>`
  }
  return g
}
function podD(x: number, y: number, deg: number, col: string, fat: number): string {
  return `<g transform="rotate(${deg.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"><path d="M${x.toFixed(1)} ${(y - 13).toFixed(1)} q${fat} 13 0 26 q${-fat} -13 0 -26 Z" fill="${col}"/></g>`
}
function aLegume(sp: Spec, r: Rng): string {
  let g: string
  if (sp.climbing) {
    g = shadow(CX, CY + 46, 18, 8)
    g += `<path d="M${CX} 116 C ${CX - 13} 88 ${CX + 13} 52 ${CX} 20" fill="none" stroke="#3f6f37" stroke-width="3"/>`
    for (let i = 0; i < 8; i++) {
      const t = i / 8, y = 114 - t * 92, side = i % 2 ? 1 : -1
      g += leafFrom(CX + side * 5, y, 18, 11, side * 52, t < 0.5 ? '#4f8a45' : '#62a155', null)
    }
    for (let i = 0; i < sp.pods; i++) {
      const y = 36 + r() * 64, side = r() > 0.5 ? 1 : -1
      g += podD(CX + side * 13, y, side * 28, sp.podCol, sp.podFat)
    }
    if (sp.tendril) g += `<path d="M${CX + 8} 42 q11 -4 8 -13" fill="none" stroke="#6ea24f" stroke-width="1.8"/>`
    for (let i = 0; i < 5; i++) g += flower(CX + (r() - 0.5) * 30, 30 + r() * 72, 2.6, sp.flowerCol)
  } else {
    g = canopy(CX, CY + 4, sp.folR, P_PLANT, r)
    for (let i = 0; i < sp.pods; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 28
      g += podD(CX + Math.cos(a) * d, CY + 4 + Math.sin(a) * d, (r() - 0.5) * 90, sp.podCol, sp.podFat)
    }
    for (let i = 0; i < 5; i++) g += flower(CX + (r() - 0.5) * 40, CY + (r() - 0.5) * 40, 2.6, sp.flowerCol)
  }
  return g
}
function aStalk(sp: Spec, r: Rng): string {
  if (sp.sub === 'rhubarbe') {
    let g = shadow(CX, CY + 28, 40, 13)
    for (let k = 0; k < 5; k++) g += `<g transform="rotate(${k * 72 + 12} ${CX} ${CY})"><rect x="${CX - 3.5}" y="${CY - 32}" width="7" height="32" rx="3.5" fill="#bf3b32"/></g>`
    for (let k = 0; k < 5; k++) g += leafFrom(CX, CY, 52, 26, k * 72 + 12, k % 2 ? '#3f7a3e' : '#4f8a45', '#2f5a32')
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 42
      g += `<circle cx="${(CX + Math.cos(a) * d).toFixed(1)}" cy="${(CY + Math.sin(a) * d).toFixed(1)}" r="3" fill="#2f5a32" opacity=".4"/>`
    }
    return g
  }
  if (sp.sub === 'artichaut') {
    let g = shadow(CX + 4, CY + 26, 36, 15)
    for (let k = 0; k < 10; k++) g += leafFrom(CX, CY, 50, 14, k * 36, k % 2 ? '#7d9a7e' : '#94ad90', '#5f7a63')
    g += `<circle cx="${CX}" cy="${CY}" r="15" fill="#5a7a52"/>`
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * 6.28
      g += `<line x1="${CX}" y1="${CY}" x2="${(CX + Math.cos(a) * 15).toFixed(1)}" y2="${(CY + Math.sin(a) * 15).toFixed(1)}" stroke="#46603f" stroke-width="2"/>`
    }
    return g + `<circle cx="${CX}" cy="${CY}" r="6" fill="#7d5fa0"/>`
  }
  if (sp.sub === 'asperge') {
    let g = shadow(CX, CY + 28, 26, 10)
    for (let k = 0; k < 7; k++) {
      const x = CX - 30 + k * 10 + (r() - 0.5) * 4, h = 42 + r() * 30
      g += `<path d="M${x.toFixed(1)} ${CY + 24} L${x.toFixed(1)} ${(CY + 24 - h).toFixed(1)}" stroke="${k % 2 ? '#6a8a4a' : '#7da05a'}" stroke-width="5.4" stroke-linecap="round"/>`
      g += `<circle cx="${x.toFixed(1)}" cy="${(CY + 24 - h).toFixed(1)}" r="3.6" fill="#4f6b3a"/>`
    }
    return g
  }
  if (sp.sub === 'celeri') {
    let g = shadow(CX, CY + 28, 28, 11)
    for (let k = 0; k < 7; k++) {
      const x = CX - 26 + k * 9
      g += `<rect x="${x - 3}" y="${CY - 4}" width="6" height="32" rx="3" fill="${k % 2 ? '#bcd49a' : '#cfe0b0'}"/>`
      g += leafFrom(x, CY - 4, 22, 9, (r() - 0.5) * 34, '#4f8a45', null)
    }
    return g
  }
  let g = shadow(CX, CY + 30, 30, 11)
  for (let k = 0; k < 8; k++) g += `<g transform="rotate(${k * 45} ${CX} ${CY})"><path d="M${CX - 5} ${CY} Q${CX - 2} ${CY - 44} ${CX + 9} ${CY - 58} Q${CX + 1} ${CY - 42} ${CX + 5} ${CY} Z" fill="${k % 2 ? '#4f8a3f' : '#62a150'}"/></g>`
  g += `<circle cx="${CX}" cy="${CY}" r="9" fill="#caa84a"/>`
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 6.28
    g += `<line x1="${CX}" y1="${CY}" x2="${(CX + Math.cos(a) * 13).toFixed(1)}" y2="${(CY + Math.sin(a) * 13).toFixed(1)}" stroke="#e3c878" stroke-width="2"/>`
  }
  return g
}
function aTuber(sp: Spec, r: Rng): string {
  let g = canopy(CX, CY + 2, sp.folR, P_PLANT, r)
  if (sp.sub === 'patate') for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 30
    g += flower(CX + Math.cos(a) * d, CY + Math.sin(a) * d, 3.4, r() > 0.5 ? '#ffffff' : '#b89ad0')
  }
  if (sp.sub === 'douce') for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 6.28, x = CX + Math.cos(a) * 30, y = CY + Math.sin(a) * 27
    g += `<path d="M${x.toFixed(1)} ${(y + 8).toFixed(1)} C${(x - 12).toFixed(1)} ${(y - 6).toFixed(1)} ${(x - 3).toFixed(1)} ${(y - 12).toFixed(1)} ${x.toFixed(1)} ${(y - 5).toFixed(1)} C${(x + 3).toFixed(1)} ${(y - 12).toFixed(1)} ${(x + 12).toFixed(1)} ${(y - 6).toFixed(1)} ${x.toFixed(1)} ${(y + 8).toFixed(1)} Z" fill="#5f9a4f"/>`
  }
  if (sp.sub === 'topinambour') for (let i = 0; i < 4; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 28
    g += flower(CX + Math.cos(a) * d, CY + Math.sin(a) * d, 4.6, '#f4c430')
  }
  return g
}
function aBerry(sp: Spec, r: Rng): string {
  let g = canopy(CX, CY + 4, 38, P_PLANT, r)
  for (let i = 0; i < sp.clusters; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 30, x = CX + Math.cos(a) * d, y = CY + 4 + Math.sin(a) * d
    for (let b = 0; b < 6; b++) g += berryD(x + (r() - 0.5) * 10, y + (r() - 0.5) * 10, sp.berryR, sp.berryCol)
  }
  return g
}

/* ════════ 50 plantations potager — table slug → archétype + spec ════════ */

type PotagerEntry = { a: (sp: Spec, r: Rng) => string; s: Spec }
const POTAGER: Record<string, PotagerEntry> = {
  'tomate': { a: aFruitFoliage, s: { folR: 40, fruit: { n: 6, r: 7, col: '#e0392f', shape: 'sphere' } } },
  'tomate-cerise': { a: aFruitFoliage, s: { folR: 36, fruit: { n: 13, r: 4, col: '#e23b3a', shape: 'sphere' } } },
  'poivron': { a: aFruitFoliage, s: { folR: 38, fruit: { n: 4, r: 9, col: '#d83b34', shape: 'pepper' } } },
  'piment': { a: aFruitFoliage, s: { folR: 34, fruit: { n: 8, r: 9, col: '#d22f2f', shape: 'long' } } },
  'aubergine': { a: aFruitFoliage, s: { folR: 38, fruit: { n: 3, r: 11, col: '#5b2a6e', shape: 'oblong' } } },
  'concombre': { a: aFruitFoliage, s: { folR: 40, fruit: { n: 4, r: 11, col: '#3f7a35', shape: 'oblong' } } },
  'cornichon': { a: aFruitFoliage, s: { folR: 34, fruit: { n: 7, r: 7, col: '#4f8a3f', shape: 'oblong' } } },
  'courgette': { a: aFruitFoliage, s: { folR: 42, fruit: { n: 3, r: 13, col: '#3f7a3a', shape: 'oblong' }, flower: true } },
  'courge': { a: aVine, s: { fruit: { kind: 'pumpkin', r: 24, col: '#d9923f' } } },
  'potiron': { a: aVine, s: { fruit: { kind: 'pumpkin', r: 28, col: '#e07b2a' } } },
  'citrouille': { a: aVine, s: { fruit: { kind: 'pumpkin', r: 26, col: '#e8842a' } } },
  'melon': { a: aVine, s: { fruit: { kind: 'netted', r: 22, col: '#cfc88a' } } },
  'pasteque': { a: aVine, s: { fruit: { kind: 'striped', r: 24, col: '#3f7a3a' } } },
  'mais': { a: aStalk, s: { sub: 'mais' } },
  'haricot-vert': { a: aLegume, s: { climbing: true, pods: 6, podCol: '#6aa83f', podFat: 3, flowerCol: '#ffffff' } },
  'haricot-ecosser': { a: aLegume, s: { climbing: true, pods: 5, podCol: '#c9a84a', podFat: 6, flowerCol: '#e8c0d0' } },
  'petit-pois': { a: aLegume, s: { climbing: true, pods: 6, podCol: '#7cb35a', podFat: 5, flowerCol: '#ffffff', tendril: true } },
  'feve': { a: aLegume, s: { climbing: false, folR: 34, pods: 5, podCol: '#8aaa5a', podFat: 6, flowerCol: '#3a3a3a' } },
  'lentille': { a: aLegume, s: { climbing: false, folR: 28, pods: 3, podCol: '#bca85a', podFat: 3, flowerCol: '#ffffff' } },
  'carotte': { a: aRootTops, s: { style: 'feathery', crownR: 9, crownCol: '#e07b2a', crownHi: '#f2a655' } },
  'radis': { a: aRootTops, s: { style: 'leafy', crownR: 8, crownCol: '#d83b48', crownHi: '#ffffff', pal: ['#4f8a45', '#6aa455'] } },
  'betterave': { a: aRootTops, s: { style: 'leafy', crownR: 9, crownCol: '#7a1f2e', pal: ['#3f6b3a', '#52864a'], rib: '#a8344a' } },
  'navet': { a: aRootTops, s: { style: 'leafy', crownR: 10, crownCol: '#e6e0d2', crownHi: '#8a5f9a', pal: ['#4f8a45', '#6aa455'] } },
  'panais': { a: aRootTops, s: { style: 'feathery', crownR: 9, crownCol: '#e6dcc0' } },
  'celeri-rave': { a: aRootTops, s: { style: 'broad', crownR: 12, crownCol: '#d8d2bf', pal: ['#3f7a3e', '#52904a'] } },
  'pomme-de-terre': { a: aTuber, s: { sub: 'patate', folR: 40 } },
  'patate-douce': { a: aTuber, s: { sub: 'douce', folR: 34 } },
  'topinambour': { a: aTuber, s: { sub: 'topinambour', folR: 42 } },
  'laitue': { a: aRosette, s: { leaves: 12, len: 42, wid: 12, pal: ['#5a8a3a', '#7caf52', '#9ec96f'], frilly: true } },
  'mache': { a: aRosette, s: { leaves: 10, len: 26, wid: 8, pal: ['#4f7a3a', '#669a4a', '#84b566'], scale: 0.85 } },
  'roquette': { a: aRosette, s: { leaves: 11, len: 38, wid: 7, pal: ['#3f6b30', '#52853f', '#6a9a52'] } },
  'epinard': { a: aRosette, s: { leaves: 10, len: 32, wid: 14, pal: ['#34602f', '#46793c', '#5e9450'] } },
  'blette': { a: aRosette, s: { leaves: 8, len: 46, wid: 17, pal: ['#356030', '#48803f'], rib: '#ecd9a0' } },
  'chou-pomme': { a: aRosette, s: { leaves: 9, len: 40, wid: 20, pal: ['#4a7a5a', '#5e9270'], heart: 'ball', heartCol: '#bcd09a' } },
  'chou-fleur': { a: aRosette, s: { leaves: 9, len: 42, wid: 18, pal: ['#4a7a5a', '#5e9270'], heart: 'curd' } },
  'brocoli': { a: aRosette, s: { leaves: 9, len: 42, wid: 17, pal: ['#3f6b50', '#52866a'], heart: 'floret' } },
  'chou-kale': { a: aRosette, s: { leaves: 11, len: 40, wid: 10, pal: ['#2f4f3a', '#3f6b4a', '#52866a'], crinkle: true } },
  'chou-bruxelles': { a: aRosette, s: { leaves: 8, len: 40, wid: 13, pal: ['#3f6b4a', '#52866a'], heart: 'sprouts' } },
  'oignon': { a: aBulb, s: { n: 9, bladeW: 2.4, pal: ['#5f8a6a', '#7aa384'], bulbR: 12, bulbCol: '#c9a06a' } },
  'ail': { a: aBulb, s: { n: 6, bladeW: 3.6, pal: ['#6a8a5a', '#84a06e'], bulbR: 11, bulbCol: '#e8e2d2' } },
  'echalote': { a: aBulb, s: { n: 7, bladeW: 2, pal: ['#6a8a6a', '#86a386'], bulbR: 9, bulbCol: '#b07a52' } },
  'poireau': { a: aBulb, s: { n: 5, bladeW: 7, pal: ['#4f7a6a', '#6a9684'], bulbR: 9, bulbCol: '#eef0e6' } },
  'fenouil': { a: aRootTops, s: { style: 'feathery', crownR: 8, crownCol: '#e8ead8', bulb: '#eef0e2' } },
  'artichaut': { a: aStalk, s: { sub: 'artichaut' } },
  'asperge': { a: aStalk, s: { sub: 'asperge' } },
  'rhubarbe': { a: aStalk, s: { sub: 'rhubarbe' } },
  'celeri-branche': { a: aStalk, s: { sub: 'celeri' } },
  'fraise': { a: aRosette, s: { leaves: 9, len: 30, wid: 12, pal: ['#3f7a3a', '#52904a', '#6aa860'], berries: 6, flowers: 4 } },
  'framboise': { a: aBerry, s: { clusters: 5, berryR: 2.6, berryCol: '#c0395f' } },
  'groseille': { a: aBerry, s: { clusters: 6, berryR: 2.8, berryCol: '#dc4452' } },
}
const LEGUME_GENERIC: Spec = { folR: 38, fruit: { n: 4, r: 7, col: '#cf6f3a', shape: 'sphere' } }

/* ════════ FAMILLE C/D — zones & structures (textures, boîte w×h) ════════ */

function sPelouse(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="12"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="12" fill="#9cc46a"/><g clip-path="url(#z)">`
  for (let y = 0; y < h; y += 22) g += `<rect y="${y}" width="${w}" height="11" fill="#a9d076" opacity=".6"/>`
  const n = Math.round((w * h) / 130)
  for (let i = 0; i < n; i++) g += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="1" fill="#7fae53" opacity=".5"/>`
  return g + `</g><rect width="${w}" height="${h}" rx="12" fill="none" stroke="#6f9a47" stroke-width="2.5"/>`
}
function sMassif(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="12"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="12" fill="#6f5a3f"/><g clip-path="url(#z)">`
  const sp = Math.round((w * h) / 90)
  for (let i = 0; i < sp; i++) g += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(1 + r() * 2.4).toFixed(1)}" fill="${r() > 0.5 ? '#5e4a32' : '#82694a'}"/>`
  for (let i = 0; i < sp / 4; i++) g += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(5 + r() * 7).toFixed(1)}" fill="#5f9a4f" opacity=".8"/>`
  const fc = ['#e98cb6', '#f4c64e', '#fbf3e0', '#c98ed8', '#ef7a64']
  for (let i = 0; i < sp / 3; i++) g += `<circle cx="${(8 + r() * (w - 16)).toFixed(1)}" cy="${(8 + r() * (h - 16)).toFixed(1)}" r="${(2.4 + r() * 1.8).toFixed(1)}" fill="${fc[(r() * 5) | 0]}"/>`
  return g + `</g><rect width="${w}" height="${h}" rx="12" fill="none" stroke="#4f3f2a" stroke-width="2.5"/>`
}
function sPotager(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="10"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="10" fill="#7c5e3f"/><g clip-path="url(#z)">`
  const n = Math.round((w * h) / 110)
  for (let i = 0; i < n; i++) g += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="${r() > 0.5 ? '#6a4f33' : '#8a6a47'}"/>`
  for (let ry = 26; ry < h - 12; ry += 34) g += `<rect x="10" y="${ry - 7}" width="${w - 20}" height="14" rx="6" fill="#8a6a47" opacity=".85"/>`
  return g + `</g><rect width="${w}" height="${h}" rx="10" fill="none" stroke="#5f472e" stroke-width="2.5"/>`
}
function sSerre(w: number, h: number): string {
  let g = `<rect width="${w}" height="${h}" rx="11" fill="rgba(196,232,226,.72)"/>`
  for (let x = 24; x < w; x += 24) g += `<line x1="${x}" y1="4" x2="${x}" y2="${h - 4}" stroke="#b5cdc7" stroke-width="2.4"/>`
  for (let y = 24; y < h; y += 24) g += `<line x1="4" y1="${y}" x2="${w - 4}" y2="${y}" stroke="#b5cdc7" stroke-width="2.4"/>`
  g += `<polygon points="10,10 ${Math.min(w * 0.36, 60)},10 14,${h - 10} 10,${h - 10}" fill="#fff" opacity=".3"/>`
  return g + `<rect width="${w}" height="${h}" rx="11" fill="none" stroke="#9fb8b2" stroke-width="5"/>`
}
function sAllee(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="9"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="9" fill="#cbb892"/><g clip-path="url(#z)">`
  for (let y = 4; y < h; y += 26) for (let x = 4; x < w; x += 26) {
    g += `<rect x="${x}" y="${y}" width="21" height="21" rx="4" fill="#d9c8a0" opacity="${(0.9 + r() * 0.2).toFixed(2)}"/>`
    g += `<rect x="${x}" y="${y}" width="21" height="21" rx="4" fill="none" stroke="#b39f78" stroke-width="1"/>`
  }
  return g + `</g><rect width="${w}" height="${h}" rx="9" fill="none" stroke="#a8916a" stroke-width="2"/>`
}
function sRocaille(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="11"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="11" fill="#d8c9a6"/><g clip-path="url(#z)">`
  const n = Math.round((w * h) / 130)
  for (let i = 0; i < n; i++) g += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="1" fill="#bca981" opacity=".6"/>`
  for (let i = 0; i < Math.max(5, (w * h) / 1600); i++) {
    const x = 12 + r() * (w - 24), y = 12 + r() * (h - 24), rs = 7 + r() * 11
    g += `<ellipse cx="${x.toFixed(1)}" cy="${(y + rs * 0.4).toFixed(1)}" rx="${rs}" ry="${(rs * 0.6).toFixed(1)}" fill="rgba(20,40,20,.18)"/>`
    g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rs}" ry="${(rs * 0.78).toFixed(1)}" fill="${r() > 0.5 ? '#a7a299' : '#928d83'}"/>`
    g += `<ellipse cx="${(x - rs * 0.3).toFixed(1)}" cy="${(y - rs * 0.3).toFixed(1)}" rx="${(rs * 0.4).toFixed(1)}" ry="${(rs * 0.3).toFixed(1)}" fill="#c2bdb2" opacity=".7"/>`
  }
  return g + `</g><rect width="${w}" height="${h}" rx="11" fill="none" stroke="#b0a07c" stroke-width="2"/>`
}
function sTerrasse(w: number, h: number, r: Rng): string {
  let g = `<clipPath id="z"><rect width="${w}" height="${h}" rx="8"/></clipPath>`
  g += `<rect width="${w}" height="${h}" rx="8" fill="#c08b50"/><g clip-path="url(#z)">`
  for (let y = 0; y < h; y += 20) {
    g += `<rect y="${y}" width="${w}" height="18" fill="${((y / 20) | 0) % 2 ? '#bd8a52' : '#ad7c46'}"/>`
    for (let i = 0; i < w / 8; i++) g += `<line x1="${(r() * w).toFixed(1)}" y1="${y + 2}" x2="${(r() * w).toFixed(1)}" y2="${y + 15}" stroke="#9a6c3c" stroke-width="1" opacity=".5"/>`
  }
  return g + `</g><rect width="${w}" height="${h}" rx="8" fill="none" stroke="#7a5230" stroke-width="2.5"/>`
}
function sMur(w: number, h: number): string {
  let g = `<rect width="${w}" height="${h}" rx="3" fill="#9a948a"/>`
  const rh = h / 2
  for (let row = 0; row < 2; row++) {
    const off = row % 2 ? 16 : 0
    for (let x = -off; x < w; x += 32) g += `<rect x="${x + 2}" y="${row * rh + 2}" width="28" height="${rh - 4}" rx="2" fill="${row % 2 ? '#a9a399' : '#8d877d'}"/>`
  }
  return g + `<rect width="${w}" height="${h}" rx="3" fill="none" stroke="#6f6a61" stroke-width="2"/>`
}
function sPortail(w: number, h: number): string {
  let g = `<rect x="0" y="${h * 0.1}" width="18" height="${h * 0.8}" rx="3" fill="#7a746a"/>`
  g += `<rect x="${w - 18}" y="${h * 0.1}" width="18" height="${h * 0.8}" rx="3" fill="#7a746a"/>`
  const lw = (w - 40) / 2
  for (let l = 0; l < 2; l++) {
    const x0 = 20 + l * lw
    g += `<rect x="${x0}" y="${h * 0.25}" width="${lw}" height="${h * 0.5}" rx="2" fill="#caa46a"/>`
    for (let b = 0; b < 4; b++) g += `<rect x="${x0 + 4 + b * (lw / 4)}" y="${h * 0.3}" width="3.4" height="${h * 0.4}" fill="#9c7c44"/>`
  }
  return g
}
function sBordure(w: number, h: number): string {
  let g = ''
  for (let x = 0; x < w; x += 18) g += `<rect x="${x + 1}" y="1" width="15" height="${h - 2}" rx="3" fill="${(x / 18 | 0) % 2 ? '#c9b88f' : '#bcab82'}"/>`
  return g
}
function sCloture(w: number, h: number): string {
  let g = `<rect x="0" y="${h * 0.42}" width="${w}" height="${h * 0.16}" rx="3" fill="#b08f5c"/>`
  g += `<rect x="0" y="${h * 0.18}" width="${w}" height="${h * 0.16}" rx="3" fill="#c2a06a"/>`
  for (let x = 6; x <= w - 6; x += 22) g += `<rect x="${x - 4}" y="0" width="9" height="${h}" rx="2" fill="#8a6f44"/>`
  return g
}
function sAbri(w: number, h: number): string {
  let g = `<polygon points="0,0 ${w / 2},0 ${w / 2},${h} 0,${h}" fill="#a06d3c"/>`
  g += `<polygon points="${w / 2},0 ${w},0 ${w},${h} ${w / 2},${h}" fill="#bd8650"/>`
  g += `<line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}" stroke="#7a5230" stroke-width="3"/>`
  return g + `<rect width="${w}" height="${h}" rx="4" fill="none" stroke="#6f4a28" stroke-width="2"/>`
}
function sPergola(w: number, h: number): string {
  let g = `<rect width="${w}" height="${h}" rx="4" fill="rgba(180,221,127,.1)" stroke="#9c7c4a" stroke-width="4"/>`
  for (let x = 12; x < w - 6; x += 16) {
    g += `<rect x="${x}" y="0" width="6" height="${h}" fill="#b8965e"/>`
    g += `<rect x="${x + 2}" y="2" width="12" height="${h - 4}" fill="rgba(40,70,40,.1)"/>`
  }
  return g
}

function sVeranda(w: number, h: number): string {
  let g = `<rect width="${w}" height="${h}" rx="10" fill="rgba(216,230,232,.62)"/>`
  // poutres de toiture (parallèles) + poutre maîtresse
  for (let x = 18; x < w - 8; x += 24) g += `<rect x="${x}" y="3" width="5" height="${h - 6}" rx="2" fill="#b9c9c4"/>`
  g += `<rect x="3" y="${(h / 2 - 3).toFixed(1)}" width="${w - 6}" height="6" rx="3" fill="#a7bab4"/>`
  // reflet vitré
  g += `<polygon points="12,8 ${Math.min(w * 0.42, 64).toFixed(1)},8 26,${h - 8} 12,${h - 8}" fill="#ffffff" opacity=".28"/>`
  return g + `<rect width="${w}" height="${h}" rx="10" fill="none" stroke="#7f9a96" stroke-width="5"/>`
}

/* ════════ dispatch ════════ */

const MOTIFS: Record<string, (r: Rng) => string> = {
  feuillu: mFeuillu, conifere: () => mConifere(), fruitier: mFruitier, palmier: () => mPalmier(), arbuste: mArbuste,
  fleur: mFleur, aromatique: mAromatique, grimpante: () => mGrimpante(), graminee: mGraminee,
  succulente: () => mSucculente(), vivace: () => mVivace(), aquatique: mAquatique,
  fontaine: () => mFontaine(), mare: mMare,
  compost: mCompost, eclairage: () => mEclairage(), 'station-meteo': () => mStationMeteo(), deco: mDeco,
  legume: (r) => aFruitFoliage(LEGUME_GENERIC, r),
}
const SURFACES: Record<string, (w: number, h: number, r: Rng) => string> = {
  pelouse: sPelouse, massif: sMassif, potager: sPotager,
  serre: (w, h) => sSerre(w, h), allee: sAllee, rocaille: sRocaille, terrasse: sTerrasse,
  veranda: (w, h) => sVeranda(w, h),
  mur: (w, h) => sMur(w, h), portail: (w, h) => sPortail(w, h), bordure: (w, h) => sBordure(w, h),
  cloture: (w, h) => sCloture(w, h), abri: (w, h) => sAbri(w, h), pergola: (w, h) => sPergola(w, h),
}

/* ════════ résolution du dessin (P1-c) ════════ */

const FRUIT_TREE_EMOJI = ['🍎', '🍏', '🍐', '🍒', '🫒', '🍑', '🍊']

export interface ResolveInput {
  type: string
  emoji?: string | null
  category?: string | null
  name?: string | null
  slug?: string | null
}

/** Calcule le drawKind d'un élément à partir de son type et, si plante, de sa fiche catalogue. */
export function resolveDrawKind(o: ResolveInput): string {
  const t = o.type
  if (t === 'arbre') {
    const e = o.emoji || ''
    if (e === '🌲' || e === '🎄') return 'conifere'
    if (e === '🌴') return 'palmier'
    if (FRUIT_TREE_EMOJI.includes(e)) return 'fruitier'
    return 'feuillu'
  }
  if (t === 'plante') {
    const cat = (o.category || '').toUpperCase()
    const key = (s?: string | null) => {
      if (!s) return ''
      const k = norm(s)
      return POTAGER[k] ? k : ''
    }
    if (cat === 'VEGETABLE') {
      const k = key(o.slug) || key(o.name)
      return k ? `potager:${k}` : 'legume'
    }
    if (cat === 'FLOWERS') return 'fleur'
    if (cat === 'HERBS') return 'aromatique'
    if (cat === 'CLIMBING') return 'grimpante'
    if (cat === 'SUCCULENTS') return 'succulente'
    if (cat === 'AQUATIC') return 'aquatique'
    if (cat === 'TREES_SHRUBS') return 'arbuste'
    if (cat === 'INDOOR') return 'vivace'
    // pas de catalogue : on tente le nom, sinon vivace par défaut
    const k = key(o.name)
    return k ? `potager:${k}` : 'vivace'
  }
  if (t === 'eau') return 'mare'
  return t // pelouse, massif, potager, serre, allee, rocaille, terrasse, mur, portail,
  //          bordure, cloture, abri, pergola, fontaine, mare, compost, eclairage,
  //          station-meteo, deco, pergola — correspondance 1:1
}

/** Indique si un drawKind se dessine en surface (texture pleine boîte) plutôt qu'en motif. */
export function isSurfaceKind(kind: string): boolean {
  return kind in SURFACES
}

/* ════════ construction SVG ════════ */

const MOTIF_VIEWBOX = '14 4 124 130'

function motifInner(kind: string, rd: Rng): string {
  if (kind.startsWith('potager:')) {
    const e = POTAGER[kind.slice(8)]
    if (e) return e.a(e.s, rd)
    return aFruitFoliage(LEGUME_GENERIC, rd)
  }
  const fn = MOTIFS[kind]
  return fn ? fn(rd) : mVivace()
}

/** Construit le SVG complet d'un élément, dimensionné à sa boîte width×height. */
export function buildSvg(kind: string, width: number, height: number, seed: string): string {
  const w = Math.max(8, Math.round(width)), h = Math.max(8, Math.round(height))
  const rd = mulberry32(hashSeed(seed || kind))
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}"`
  if (isSurfaceKind(kind)) {
    const inner = SURFACES[kind](w, h, rd)
    return `${head} viewBox="0 0 ${w} ${h}">${DEFS}${inner}</svg>`
  }
  const inner = motifInner(kind, rd)
  return `${head} viewBox="${MOTIF_VIEWBOX}" preserveAspectRatio="xMidYMid meet">${DEFS}${inner}</svg>`
}

/* ════════ caches : data URL + image rasterisée ════════ */

const urlCache = new Map<string, string>()
const imgCache = new Map<string, HTMLImageElement>()
const MAX_CACHE = 600

function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/** Renvoie (et met en cache) la data URL du sprite d'un élément. */
export function getSpriteUrl(kind: string, width: number, height: number, seed: string): string {
  const key = `${kind}|${Math.round(width)}x${Math.round(height)}|${seed}`
  const cached = urlCache.get(key)
  if (cached) return cached
  const url = svgToDataUrl(buildSvg(kind, width, height, seed))
  if (urlCache.size >= MAX_CACHE) {
    const k = urlCache.keys().next().value
    if (k !== undefined) urlCache.delete(k)
  }
  urlCache.set(key, url)
  return url
}

/**
 * Renvoie un HTMLImageElement pour une data URL donnée — créé et chargé une seule fois.
 * Le consommateur vérifie `.complete` ; sinon il écoute l'événement `load`.
 */
export function getSpriteImage(url: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null
  const cached = imgCache.get(url)
  if (cached) return cached
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  if (imgCache.size >= MAX_CACHE) {
    const k = imgCache.keys().next().value
    if (k !== undefined) imgCache.delete(k)
  }
  imgCache.set(url, img)
  return img
}

/* ════════ vignettes de palette ════════ */

const thumbCache = new Map<string, string>()

/** Renvoie une vignette illustrée (data URL) pour la palette. */
export function getThumbUrl(kind: string): string {
  const cached = thumbCache.get(kind)
  if (cached) return cached
  const url = isSurfaceKind(kind)
    ? svgToDataUrl(buildSvg(kind, 120, 96, `thumb-${kind}`))
    : svgToDataUrl(buildSvg(kind, 96, 96, `thumb-${kind}`))
  thumbCache.set(kind, url)
  return url
}
