import { buildSvg, resolveDrawKind } from './illustration'
import { effectivePoints, isSurfaceType, type Garden, type GardenElement } from './types'

/**
 * Compose le plan complet d'un jardin en **un seul SVG**, à partir du
 * `canvasData` enregistré par l'éditeur du web.
 *
 * Le moteur de dessin (`illustration.ts`) produit déjà du SVG pur, une boîte
 * par élément ; il ne reste qu'à les placer. Assembler ici plutôt que dans
 * l'app évite d'avoir deux moteurs à faire évoluer ensemble : le mobile reçoit
 * le même dessin que le web, par construction.
 */

/** Marge autour du contenu, en pixels du plan. */
const PADDING = 40

/** En dessous de cette taille, l'étiquette d'un élément devient illisible. */
const MIN_BOX_FOR_LABEL = 48

export interface GardenPlan {
  /** Document SVG autonome, prêt à afficher. */
  svg: string
  /** Dimensions du `viewBox`, pour calquer le conteneur dessus. */
  width: number
  height: number
  elementCount: number
}

// ─── Géométrie ─────────────────────────────────────────────────────────────

/** Coins d'un élément une fois sa rotation appliquée. */
function corners(el: GardenElement): Array<{ x: number; y: number }> {
  const rad = ((el.rotation ?? 0) * Math.PI) / 180
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return [
    [el.x, el.y],
    [el.x + el.width, el.y],
    [el.x + el.width, el.y + el.height],
    [el.x, el.y + el.height],
  ].map(([px, py]) => ({
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos,
  }))
}

/**
 * Cadre du plan : l'enveloppe des éléments, pas une parcelle théorique.
 *
 * Le canevas du web est un monde ouvert où l'on pose ce qu'on veut ; cadrer
 * sur le contenu évite de servir un plan à moitié vide sur un écran de
 * téléphone. La rotation est prise en compte, sinon un élément tourné à 45°
 * dépasse du cadre.
 */
function bounds(elements: GardenElement[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    for (const point of corners(el)) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  return {
    x: Math.floor(minX - PADDING),
    y: Math.floor(minY - PADDING),
    width: Math.ceil(maxX - minX + PADDING * 2),
    height: Math.ceil(maxY - minY + PADDING * 2),
  }
}

// ─── Assemblage ────────────────────────────────────────────────────────────

/**
 * Préfixe les identifiants d'un fragment SVG.
 *
 * Les `id` sont **globaux au document**, pas au `<svg>` imbriqué : sans ce
 * renommage, le `clipPath id="z"` du premier massif capturerait tous les
 * `url(#z)` des suivants, et une seule zone serait correctement découpée.
 */
function namespaceIds(svg: string, prefix: string): string {
  return svg
    .replace(/\bid="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
}

/** Redimensionne la boîte du sprite sans toucher à son `viewBox`. */
function fitSprite(svg: string, width: number, height: number): string {
  return svg.replace(
    /^<svg([^>]*)>/,
    (_match, attrs: string) =>
      `<svg${attrs
        .replace(/\swidth="[^"]*"/, '')
        .replace(/\sheight="[^"]*"/, '')} x="0" y="0" width="${width}" height="${height}">`,
  )
}

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Le contour de parcelle, seul élément dessiné en limite et non en surface. */
function isCadastralOutline(el: GardenElement): boolean {
  return el.type === 'terrain'
}

function renderElement(el: GardenElement, index: number, withLabels: boolean): string {
  const prefix = `e${index}`
  const width = Math.max(8, Math.round(el.width))
  const height = Math.max(8, Math.round(el.height))

  const kind = el.drawKind ?? resolveDrawKind({ type: el.type, emoji: el.emoji, name: el.label })
  const sprite = fitSprite(namespaceIds(buildSvg(kind, width, height, el.id), prefix), width, height)

  // Zone non rectangulaire : le sprite est découpé à son polygone.
  const polygon = isSurfaceType(el.type) ? effectivePoints(el) : undefined
  let body = sprite

  if (polygon && polygon.length >= 3) {
    const points = polygon.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    // La limite cadastrale se lit comme une limite : trait pointillé net, à ne
    // pas confondre avec le bord d'une zone plantée.
    const outline = isCadastralOutline(el)
      ? `<polygon points="${points}" fill="none" stroke="${el.customBorder ?? '#1E5631'}"`
        + ` stroke-width="2" stroke-dasharray="10 6"/>`
      : `<polygon points="${points}" fill="none" stroke="${el.customBorder ?? 'rgba(30,86,49,.35)'}" stroke-width="2"/>`
    body =
      `<defs><clipPath id="${prefix}-shape"><polygon points="${points}"/></clipPath></defs>`
      + `<g clip-path="url(#${prefix}-shape)">${sprite}</g>`
      + outline
  }

  // Seules les zones et structures sont étiquetées. Nommer aussi chaque plante
  // rendait le plan illisible dès qu'un potager en serrait quelques-unes : les
  // étiquettes se chevauchaient. Une plante se reconnaît à son dessin, et son
  // nom se lit dans la liste des plantes du jardin.
  // Le contour du terrain n'est pas étiqueté : il entoure tout le plan, son
  // nom se poserait au milieu des éléments qu'il contient.
  if (
    withLabels
    && el.label
    && isSurfaceType(el.type)
    && !isCadastralOutline(el)
    && Math.min(width, height) >= MIN_BOX_FOR_LABEL
  ) {
    // Une étiquette posée hors rotation ne suivrait plus l'élément.
    body +=
      `<text x="${width / 2}" y="${height + 14}" text-anchor="middle"`
      + ` font-family="sans-serif" font-size="13" font-weight="600"`
      + ` fill="#1E5631" stroke="#F9F7E8" stroke-width="3" paint-order="stroke"`
      + `>${escapeXml(el.label)}</text>`
  }

  const rotation = el.rotation ?? 0
  const transform =
    `translate(${el.x.toFixed(1)} ${el.y.toFixed(1)})`
    + (rotation ? ` rotate(${rotation.toFixed(2)} ${width / 2} ${height / 2})` : '')

  return `<g transform="${transform}">${body}</g>`
}

/**
 * Plan complet d'un jardin, ou `null` si rien n'a encore été dessiné.
 *
 * `canvasData` est du JSON écrit par l'éditeur web : il peut être absent, vide
 * ou d'une version antérieure. On préfère ne rien rendre plutôt que lever —
 * l'appelant affiche alors son état vide.
 */
export function buildGardenPlan(
  canvasData: string | null | undefined,
  options: { withLabels?: boolean } = {},
): GardenPlan | null {
  if (!canvasData) return null

  let garden: Garden
  try {
    garden = JSON.parse(canvasData) as Garden
  } catch {
    return null
  }

  const elements = Array.isArray(garden?.elements) ? garden.elements : []
  if (elements.length === 0) return null

  const box = bounds(elements)
  // L'ordre du tableau porte l'empilement des calques : il est conservé.
  const body = elements
    .map((el, index) => renderElement(el, index, options.withLabels ?? true))
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}"`
    + ` viewBox="${box.x} ${box.y} ${box.width} ${box.height}">`
    + `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#F9F7E8"/>`
    + body
    + `</svg>`

  return { svg, width: box.width, height: box.height, elementCount: elements.length }
}
