import { describe, expect, it } from 'vitest'

import { buildGardenPlan } from '../garden/plan-svg'
import type { GardenElement } from '../garden/types'

function element(overrides: Partial<GardenElement> = {}): GardenElement {
  return {
    id: 'el-1',
    type: 'pelouse',
    emoji: '🌱',
    label: 'Pelouse',
    x: 100,
    y: 100,
    width: 200,
    height: 160,
    rotation: 0,
    sun: 'full',
    ...overrides,
  }
}

function canvas(elements: GardenElement[]): string {
  return JSON.stringify({
    id: 'main',
    name: 'Mon jardin',
    elements,
    config: { widthMeters: 10, heightMeters: 15 },
  })
}

describe('plan absent', () => {
  it('rend null plutôt que de lever', () => {
    expect(buildGardenPlan(null)).toBeNull()
    expect(buildGardenPlan(undefined)).toBeNull()
    expect(buildGardenPlan('')).toBeNull()
  })

  it('rend null sur un canvasData illisible — pas d\'erreur 500 pour ça', () => {
    expect(buildGardenPlan('{ ceci n\'est pas du JSON')).toBeNull()
    expect(buildGardenPlan('{"elements":"pas un tableau"}')).toBeNull()
  })

  it('rend null quand rien n\'a été dessiné', () => {
    expect(buildGardenPlan(canvas([]))).toBeNull()
  })
})

describe('cadrage', () => {
  it('cadre sur le contenu, avec une marge', () => {
    const plan = buildGardenPlan(canvas([element()]))!

    // 200×160 d'élément + 40 de marge de chaque côté.
    expect(plan.width).toBe(280)
    expect(plan.height).toBe(240)
    expect(plan.svg).toContain('viewBox="60 60 280 240"')
    expect(plan.elementCount).toBe(1)
  })

  it('englobe un élément tourné, dont les coins débordent de sa boîte', () => {
    const droit = buildGardenPlan(canvas([element({ width: 200, height: 40 })]))!
    const tourne = buildGardenPlan(canvas([element({ width: 200, height: 40, rotation: 45 })]))!

    expect(tourne.height).toBeGreaterThan(droit.height)
  })

  it('englobe tous les éléments', () => {
    const plan = buildGardenPlan(
      canvas([element(), element({ id: 'el-2', x: 500, y: 400, width: 100, height: 100 })]),
    )!

    expect(plan.width).toBe(500 + 100 - 100 + 80)
    expect(plan.elementCount).toBe(2)
  })
})

describe('assemblage', () => {
  it('produit un SVG autonome', () => {
    const plan = buildGardenPlan(canvas([element()]))!

    expect(plan.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(plan.svg.endsWith('</svg>')).toBe(true)
    expect(plan.svg).toContain('fill="#F9F7E8"')
  })

  it('place chaque élément à ses coordonnées, rotation comprise', () => {
    const plan = buildGardenPlan(canvas([element({ x: 120, y: 80, rotation: 30 })]))!

    expect(plan.svg).toContain('transform="translate(120.0 80.0) rotate(30.00 100 80)"')
  })

  it('n\'écrit pas de rotation quand il n\'y en a pas', () => {
    const plan = buildGardenPlan(canvas([element()]))!
    expect(plan.svg).not.toContain('rotate(')
  })

  /**
   * Les `id` d'un SVG sont globaux au document : sans préfixe, le `clipPath`
   * du premier élément capturerait les `url(#…)` de tous les suivants et un
   * seul serait correctement découpé.
   */
  it('préfixe les identifiants pour que deux éléments ne se volent pas leurs références', () => {
    const plan = buildGardenPlan(
      canvas([element(), element({ id: 'el-2', type: 'massif', x: 400 })]),
    )!

    const ids = [...plan.svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
    expect(ids.length).toBeGreaterThan(1)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => /^e\d+-/.test(id))).toBe(true)

    // Et aucune référence ne pointe dans le vide.
    for (const [, ref] of plan.svg.matchAll(/url\(#([^)]+)\)/g)) {
      expect(ids, `référence ${ref}`).toContain(ref)
    }
  })

  it('découpe une zone à son polygone quand elle en a un', () => {
    const plan = buildGardenPlan(
      canvas([
        element({
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 160 },
          ],
        }),
      ]),
    )!

    expect(plan.svg).toContain('<clipPath id="e0-shape">')
    expect(plan.svg).toContain('clip-path="url(#e0-shape)"')
    expect(plan.svg).toContain('polygon points="0.0,0.0 200.0,0.0 200.0,160.0"')
  })

  it('conserve l\'ordre du tableau, qui porte l\'empilement des calques', () => {
    const plan = buildGardenPlan(
      canvas([
        element({ id: 'dessous', label: 'Pelouse' }),
        element({ id: 'dessus', type: 'massif', label: 'Massif', x: 150 }),
      ]),
    )!

    expect(plan.svg.indexOf('e0-')).toBeLessThan(plan.svg.indexOf('e1-'))
  })
})

describe('étiquettes', () => {
  it('nomme les zones et les structures', () => {
    const plan = buildGardenPlan(canvas([element({ label: 'Le potager' })]))!
    expect(plan.svg).toContain('>Le potager</text>')
  })

  it('ne nomme pas les plantes — leurs étiquettes se chevauchent dans un massif', () => {
    const plan = buildGardenPlan(
      canvas([element({ type: 'plante', label: 'Tomate', width: 60, height: 60 })]),
    )!

    expect(plan.svg).not.toContain('>Tomate</text>')
  })

  it('renonce à l\'étiquette d\'une zone trop petite pour la porter', () => {
    const plan = buildGardenPlan(canvas([element({ width: 30, height: 30 })]))!
    expect(plan.svg).not.toContain('</text>')
  })

  it('échappe le XML : un nom de zone est du texte libre', () => {
    const plan = buildGardenPlan(canvas([element({ label: 'Massif <Sud> & Ouest' })]))!

    expect(plan.svg).toContain('Massif &lt;Sud&gt; &amp; Ouest')
    expect(plan.svg).not.toContain('<Sud>')
  })

  it('les supprime toutes sur demande', () => {
    const plan = buildGardenPlan(canvas([element()]), { withLabels: false })!
    expect(plan.svg).not.toContain('</text>')
  })
})

describe('terrain et maison (import cadastral)', () => {
  const terrain = element({
    id: 'terrain-1',
    type: 'terrain',
    emoji: '🗺️',
    label: 'Limite de parcelle · 0A 1948',
    x: 40,
    y: 40,
    width: 952,
    height: 1159,
    drawKind: 'terrain',
    points: [
      { x: 0, y: 490 },
      { x: 270, y: 313 },
      { x: 664, y: 104 },
      { x: 952, y: 0 },
      { x: 943, y: 1159 },
      { x: 12, y: 900 },
    ],
  })
  const maison = element({
    id: 'maison-1',
    type: 'maison',
    emoji: '🏠',
    label: 'Maison',
    x: 300,
    y: 400,
    width: 400,
    height: 320,
    drawKind: 'maison',
  })

  it('trace la limite cadastrale en pointillé, pas en bord de zone', () => {
    const plan = buildGardenPlan(canvas([terrain]))!

    expect(plan.svg).toContain('stroke="#1E5631" stroke-width="2" stroke-dasharray="10 6"')
  })

  it('ne nomme pas le terrain : son étiquette tomberait au milieu du plan', () => {
    const plan = buildGardenPlan(canvas([terrain]))!

    expect(plan.svg).not.toContain('Limite de parcelle')
  })

  it('dessine la maison en emprise sable, contour bois, et la nomme', () => {
    const plan = buildGardenPlan(canvas([maison]))!

    expect(plan.svg).toContain('fill="#F9F7E8"')
    expect(plan.svg).toContain('stroke="#7B5E3C"')
    expect(plan.svg).toContain('>Maison</text>')
  })

  it('garde le terrain au fond, sous ce qui est posé dessus', () => {
    const plan = buildGardenPlan(canvas([terrain, maison]))!

    expect(plan.svg.indexOf('e0-')).toBeLessThan(plan.svg.indexOf('e1-'))
  })
})
