import type { ParcelDetail } from '@growi/shared'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { fitBox, seedGardenFromParcels, surfaceFromSeed } from '../garden/cadastre-seed'
import { createDefaultGarden } from '../garden/defaults'
import { DEFAULT_PX_PER_METER } from '../garden/scale'
import type { Garden, GardenElement } from '../garden/types'

import parcelle1948 from '../services/__tests__/__fixtures__/cadastre/parcelle-785512510A1948.json'
import parcelle2276 from '../services/__tests__/__fixtures__/cadastre/parcelle-785512510A2276.json'
import batiments1948 from '../services/__tests__/__fixtures__/cadastre/batiments-785512510A1948.json'
import batiments2276 from '../services/__tests__/__fixtures__/cadastre/batiments-785512510A2276.json'

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

/**
 * Les parcelles sont produites par le vrai service, à partir des réponses
 * enregistrées de l'IGN : la géométrie testée ici est celle du terrain réel,
 * pas un polygone d'invention.
 */
let parcel1948: ParcelDetail
let parcel2276: ParcelDetail

beforeAll(async () => {
  const { getParcel } = await import('@/lib/services/cadastre.service')

  function stub(parcelle: unknown, batiments: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(String(input).includes('BDTOPO_V3') ? batiments : parcelle),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
  }

  stub(parcelle1948, batiments1948)
  parcel1948 = await getParcel('785512510A1948')
  stub(parcelle2276, batiments2276)
  parcel2276 = await getParcel('785512510A2276')
  vi.unstubAllGlobals()
})

let counter = 0
const options = {
  withBuildings: true,
  newId: () => `seed-${++counter}`,
  now: () => '2026-09-03T10:00:00.000Z',
}

function seed(garden: Garden = createDefaultGarden(), overrides = {}): Garden {
  counter = 0
  return seedGardenFromParcels(garden, [parcel1948], { ...options, ...overrides })
}

function typesOf(garden: Garden): string[] {
  return garden.elements.map(el => el.type)
}

// ─── Éléments posés ────────────────────────────────────────────────────────

describe('seedGardenFromParcels', () => {
  it('pose le contour de la parcelle et son bâti', () => {
    const garden = seed()

    expect(typesOf(garden)).toEqual(['terrain', 'maison'])

    const [terrain, maison] = garden.elements
    expect(terrain.label).toBe('Limite de parcelle · 0A 1948')
    expect(terrain.drawKind).toBe('terrain')
    expect(terrain.sun).toBe('full')
    expect(maison.label).toBe('Maison')
    expect(maison.drawKind).toBe('maison')
  })

  it('met le contour à l’échelle du plan, à 40 px de l’origine', () => {
    const garden = seed()
    const terrain = garden.elements[0]

    expect(terrain.x).toBe(40)
    expect(terrain.y).toBe(40)
    // 23,8 m de large à 40 px/m.
    expect(terrain.width / DEFAULT_PX_PER_METER).toBeCloseTo(parcel1948.bboxM.width, 1)
    expect(terrain.height / DEFAULT_PX_PER_METER).toBeCloseTo(parcel1948.bboxM.height, 1)
  })

  it('exprime les sommets dans le repère local de l’élément', () => {
    const terrain = seed().elements[0]

    expect(terrain.points).toHaveLength(parcel1948.outlineM.length)
    for (const p of terrain.points!) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(terrain.width + 0.01)
      expect(p.y).toBeLessThanOrEqual(terrain.height + 0.01)
    }
    // Un sommet touche chaque bord : la boîte colle au polygone.
    expect(Math.min(...terrain.points!.map(p => p.x))).toBeCloseTo(0, 5)
    expect(Math.max(...terrain.points!.map(p => p.x))).toBeCloseTo(terrain.width, 5)
  })

  it('pose la maison à sa place dans la parcelle', () => {
    const garden = seed()
    const [terrain, maison] = garden.elements

    expect(maison.x).toBeGreaterThanOrEqual(terrain.x)
    expect(maison.y).toBeGreaterThanOrEqual(terrain.y)
    expect(maison.x + maison.width).toBeLessThanOrEqual(terrain.x + terrain.width + 0.01)
    expect(maison.y + maison.height).toBeLessThanOrEqual(terrain.y + terrain.height + 0.01)
  })

  it('distingue une construction légère : un abri, pas une maison', () => {
    counter = 0
    const garden = seedGardenFromParcels(createDefaultGarden(), [parcel2276], options)

    expect(typesOf(garden).sort()).toEqual(['abri', 'maison', 'terrain'])
    expect(garden.elements.find(el => el.type === 'abri')!.label).toBe('Abri')
  })

  it('ne pose que le contour quand le bâti est décoché', () => {
    const garden = seed(createDefaultGarden(), { withBuildings: false })

    expect(typesOf(garden)).toEqual(['terrain'])
  })

  it('n’invente rien quand la liste de parcelles est vide', () => {
    const garden = createDefaultGarden()

    expect(seedGardenFromParcels(garden, [], options)).toBe(garden)
  })
})

// ─── Configuration du plan ─────────────────────────────────────────────────

describe('configuration après import', () => {
  it('reprend les dimensions de la parcelle, arrondies au mètre supérieur', () => {
    const { config } = seed()

    expect(config.widthMeters).toBe(Math.ceil(parcel1948.bboxM.width))
    expect(config.heightMeters).toBe(Math.ceil(parcel1948.bboxM.height))
  })

  it('fixe l’échelle explicitement, au lieu de la laisser implicite', () => {
    expect(seed().config.pxPerMeter).toBe(DEFAULT_PX_PER_METER)
  })

  it('conserve l’échelle déjà choisie pour ce plan', () => {
    const garden = createDefaultGarden()
    garden.config.pxPerMeter = 25

    const seeded = seed(garden)

    expect(seeded.config.pxPerMeter).toBe(25)
    expect(seeded.elements[0].width / 25).toBeCloseTo(parcel1948.bboxM.width, 1)
  })

  it('mémorise l’import : parcelles, surfaces et éléments posés', () => {
    const garden = seed()

    expect(garden.config.cadastre).toEqual({
      parcelIds: ['785512510A1948'],
      contenanceM2: 405,
      builtM2: parcel1948.builtM2,
      importedAt: '2026-09-03T10:00:00.000Z',
      elementIds: garden.elements.map(el => el.id),
    })
  })

  it('laisse le bâti inconnu quand une parcelle n’a pas eu de réponse BD TOPO', () => {
    const sansBati: ParcelDetail = { ...parcel1948, buildings: null, builtM2: null }

    const garden = seedGardenFromParcels(createDefaultGarden(), [sansBati], options)

    expect(garden.config.cadastre!.builtM2).toBeNull()
    expect(typesOf(garden)).toEqual(['terrain'])
  })
})

// ─── Réimport ──────────────────────────────────────────────────────────────

describe('import remplaçant un import précédent', () => {
  function elementLibre(): GardenElement {
    return {
      id: 'libre-1',
      type: 'potager',
      emoji: '🥕',
      label: 'Mon potager',
      x: 500,
      y: 500,
      width: 160,
      height: 120,
      rotation: 0,
      sun: 'full',
    }
  }

  it('retire les éléments du premier import, garde ceux de l’utilisateur', () => {
    const premier = seed()
    const avecPotager: Garden = {
      ...premier,
      elements: [...premier.elements, elementLibre()],
    }

    counter = 100
    const second = seedGardenFromParcels(avecPotager, [parcel1948], {
      ...options,
      newId: () => `bis-${++counter}`,
    })

    expect(second.elements.filter(el => el.type === 'terrain')).toHaveLength(1)
    expect(second.elements.some(el => el.id === 'libre-1')).toBe(true)
    for (const id of premier.config.cadastre!.elementIds) {
      expect(second.elements.some(el => el.id === id)).toBe(false)
    }
  })

  it('pose l’import au fond des calques, sous ce que l’utilisateur a dessiné', () => {
    const garden: Garden = { ...createDefaultGarden(), elements: [elementLibre()] }

    const seeded = seed(garden)

    expect(typesOf(seeded)).toEqual(['terrain', 'maison', 'potager'])
  })
})

// ─── Plusieurs parcelles ───────────────────────────────────────────────────

describe('terrain sur plusieurs parcelles', () => {
  it('place chaque parcelle à sa position réelle par rapport aux autres', () => {
    counter = 0
    const garden = seedGardenFromParcels(
      createDefaultGarden(),
      [parcel1948, parcel2276],
      options,
    )

    const contours = garden.elements.filter(el => el.type === 'terrain')
    expect(contours).toHaveLength(2)
    // Deux parcelles voisines, distinctes : ni superposées, ni collées au même point.
    expect(contours[0].x).not.toBe(contours[1].x)

    // L'emprise commune dépasse celle de chaque parcelle prise seule.
    expect(garden.config.widthMeters).toBeGreaterThan(
      Math.max(parcel1948.bboxM.width, parcel2276.bboxM.width),
    )
  })

  it('somme les contenances et les surfaces bâties', () => {
    counter = 0
    const garden = seedGardenFromParcels(
      createDefaultGarden(),
      [parcel1948, parcel2276],
      options,
    )

    expect(garden.config.cadastre!.parcelIds).toEqual([
      '785512510A1948',
      '785512510A2276',
    ])
    expect(garden.config.cadastre!.contenanceM2).toBe(405 + 612)
    expect(garden.config.cadastre!.builtM2).toBe(
      parcel1948.builtM2! + parcel2276.builtM2!,
    )
  })
})

// ─── Surface retenue et recadrage ──────────────────────────────────────────

describe('surfaceFromSeed', () => {
  it('retient le terrain hors bâti quand le bâti est posé', () => {
    expect(surfaceFromSeed([parcel1948], true)).toBe(parcel1948.gardenM2)
  })

  it('retient la contenance entière quand il ne l’est pas', () => {
    expect(surfaceFromSeed([parcel1948], false)).toBe(405)
  })

  it('additionne les parcelles d’un même terrain', () => {
    expect(surfaceFromSeed([parcel1948, parcel2276], false)).toBe(405 + 612)
  })
})

describe('fitBox', () => {
  it('englobe les éléments posés, en pixels du monde', () => {
    const garden = seed()

    const box = fitBox(garden.elements)!
    const terrain = garden.elements[0]

    expect(box.x).toBe(terrain.x)
    expect(box.y).toBe(terrain.y)
    expect(box.width).toBeCloseTo(terrain.width, 5)
    expect(box.height).toBeCloseTo(terrain.height, 5)
  })

  it('ne cadre rien quand il n’y a rien', () => {
    expect(fitBox([])).toBeNull()
  })
})
