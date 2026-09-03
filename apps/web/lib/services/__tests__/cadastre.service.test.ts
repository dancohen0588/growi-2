import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'

import reverseParcels from './__fixtures__/cadastre/reverse-parcels.json'
import parcelle1948 from './__fixtures__/cadastre/parcelle-785512510A1948.json'
import parcelle2276 from './__fixtures__/cadastre/parcelle-785512510A2276.json'
import parcelle1925 from './__fixtures__/cadastre/parcelle-785512510A1925.json'
import parcelle2277 from './__fixtures__/cadastre/parcelle-785512510A2277.json'
import batiments1948 from './__fixtures__/cadastre/batiments-785512510A1948.json'
import batiments2276 from './__fixtures__/cadastre/batiments-785512510A2276.json'

// `unstable_cache` mémorise entre les tests et masquerait les appels ; ici on
// veut voir passer chaque requête.
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

const { findParcelsNear, getParcel, parseIdu, buildThumbnailUrl } = await import(
  '@/lib/services/cadastre.service'
)

// ─── Doublure de `fetch` ───────────────────────────────────────────────────
//
// Les tests n'appellent jamais l'IGN : chaque URL est rattachée à une fixture
// enregistrée depuis les appels réels (parcelles de Saint-Germain-en-Laye).

type Route = { match: (url: string) => boolean; respond: () => Response | Promise<Response> }

let routes: Route[] = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function route(match: (url: string) => boolean, respond: Route['respond']) {
  routes.unshift({ match, respond })
}

/** Les fixtures nominales : géocodage inverse, quatre parcelles, deux jeux de bâtiments. */
function useDefaultRoutes() {
  route(url => url.includes('/geocodage/reverse'), () => json(reverseParcels))
  route(url => url.includes('numero=1948'), () => json(parcelle1948))
  route(url => url.includes('numero=2276'), () => json(parcelle2276))
  route(url => url.includes('numero=1925'), () => json(parcelle1925))
  route(url => url.includes('numero=2277'), () => json(parcelle2277))
  // Les deux parcelles bâties se distinguent par leur contour dans le filtre CQL.
  route(url => url.includes('BDTOPO_V3'), () => json(batiments1948))
}

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  const matched = routes.find(r => r.match(url))
  if (!matched) throw new Error(`URL non simulée : ${url}`)
  return matched.respond()
})

beforeEach(() => {
  routes = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

// ─── Décomposition de l'IDU ────────────────────────────────────────────────

describe('parseIdu', () => {
  it('coupe le code commune, la section et le numéro', () => {
    expect(parseIdu('785512510A1948')).toEqual({
      codeInsee: '78551',
      section: '0A',
      numero: '1948',
    })
  })

  it('coupe de la même façon outre-mer, où le département tient sur trois chiffres', () => {
    // 971 (Guadeloupe) + 05 (commune) = 97105 : la coupure à cinq vaut aussi.
    expect(parseIdu('97105000AB0012')).toEqual({
      codeInsee: '97105',
      section: 'AB',
      numero: '0012',
    })
  })

  it('refuse un identifiant qui n’a pas la bonne forme', () => {
    expect(() => parseIdu('1948')).toThrowError(ServiceError)
    expect(() => parseIdu('1948')).toThrowError(/introuvable/)
  })
})

// ─── Vignette ──────────────────────────────────────────────────────────────

describe('buildThumbnailUrl', () => {
  const url = buildThumbnailUrl({
    lonMin: 2.06165554,
    latMin: 48.89185626,
    lonMax: 2.06198082,
    latMax: 48.89211647,
  })

  it('porte le paramètre STYLES vide, sans lequel le WMS répond 400', () => {
    expect(url).toContain('STYLES=,')
  })

  it('cadre la parcelle au format 4:3, latitude en premier', () => {
    const bbox = new URL(url).searchParams.get('BBOX')!.split(',').map(Number)
    const [latMin, lonMin, latMax, lonMax] = bbox
    expect(latMin).toBeLessThan(latMax)
    expect(lonMin).toBeLessThan(lonMax)

    const heightM = (latMax - latMin) * 111_320
    const widthM = (lonMax - lonMin) * 111_320 * Math.cos((48.892 * Math.PI) / 180)
    expect(widthM / heightM).toBeCloseTo(4 / 3, 2)
    // La marge de 15 m de part et d'autre d'une parcelle de ~29 m de haut.
    expect(heightM).toBeGreaterThan(55)
  })
})

// ─── Recherche autour d'un point ───────────────────────────────────────────

describe('findParcelsNear', () => {
  it('renvoie les candidates triées par distance, avec leur contenance', async () => {
    useDefaultRoutes()

    const candidates = await findParcelsNear(48.891851, 2.061952)

    expect(candidates.map(c => c.idu)).toEqual(['785512510A1948', '785512510A2277'])
    expect(candidates[0]).toMatchObject({
      idu: '785512510A1948',
      section: '0A',
      numero: '1948',
      communeName: 'Saint-Germain-en-Laye',
      contenanceM2: 405,
      distanceM: 16,
    })
    expect(candidates[0].thumbnailUrl).toContain('ORTHOIMAGERY.ORTHOPHOTOS')
    expect(candidates.map(c => c.distanceM)).toEqual([...candidates.map(c => c.distanceM)].sort((a, b) => a - b))
  })

  it('écarte les parcelles de moins de 20 m² — voirie et trottoirs cadastrés', async () => {
    useDefaultRoutes()

    const candidates = await findParcelsNear(48.891851, 2.061952)

    // La plus proche du point (7 m) fait 6 m² : c'est un bout de voie.
    expect(candidates.some(c => c.idu === '785512510A1925')).toBe(false)
  })

  it('tronque à quatre candidates', async () => {
    route(url => url.includes('/geocodage/reverse'), () => json(reverseParcels))
    // Toutes les parcelles du géocodage renvoient une contenance exploitable.
    route(url => url.includes('apicarto'), () => json(parcelle2276))

    const candidates = await findParcelsNear(48.891851, 2.061952)

    expect(candidates).toHaveLength(4)
  })

  it('garde les candidates dont la contenance a répondu, écarte les autres', async () => {
    route(url => url.includes('/geocodage/reverse'), () => json(reverseParcels))
    route(url => url.includes('apicarto'), () => json({}, 500))
    route(url => url.includes('numero=1948'), () => json(parcelle1948))

    const candidates = await findParcelsNear(48.891851, 2.061952)

    expect(candidates.map(c => c.idu)).toEqual(['785512510A1948'])
  })

  it('lève UNAVAILABLE quand le géocodage ne répond pas', async () => {
    route(() => true, () => json({}, 503))

    await expect(findParcelsNear(48.891851, 2.061952)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })

  it('lève UNAVAILABLE quand aucune contenance ne répond', async () => {
    route(url => url.includes('/geocodage/reverse'), () => json(reverseParcels))
    route(url => url.includes('apicarto'), () => json({}, 500))

    await expect(findParcelsNear(48.891851, 2.061952)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })

  it('renvoie une liste vide hors de portée du cadastre, sans lever', async () => {
    route(url => url.includes('/geocodage/reverse'), () => json({ features: [] }))

    await expect(findParcelsNear(51.5, -0.12)).resolves.toEqual([])
  })
})

// ─── Détail d'une parcelle ─────────────────────────────────────────────────

/** Aire d'un polygone métrique fermé (formule des lacets). */
function shoelaceArea(points: Array<{ x: number; y: number }>): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

describe('getParcel', () => {
  it('projette le contour en mètres, origine au coin nord-ouest', async () => {
    useDefaultRoutes()

    const parcel = await getParcel('785512510A1948')

    // Emprise relevée sur l'appel réel : 23,7 × 28,8 m.
    expect(parcel.bboxM.width).toBeCloseTo(23.7, 0)
    expect(parcel.bboxM.height).toBeCloseTo(28.8, 0)
    expect(Math.abs(parcel.bboxM.width - 23.7)).toBeLessThan(0.2)
    expect(Math.abs(parcel.bboxM.height - 28.8)).toBeLessThan(0.2)

    // Origine au coin nord-ouest : aucun sommet négatif, aucun hors emprise.
    for (const p of parcel.outlineM) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(parcel.bboxM.width + 0.01)
      expect(p.y).toBeLessThanOrEqual(parcel.bboxM.height + 0.01)
    }
    // Le sommet de fermeture n'est pas répété : le plan referme lui-même.
    expect(parcel.outlineM[0]).not.toEqual(parcel.outlineM[parcel.outlineM.length - 1])

    // L'origine du repère est ce coin nord-ouest, en degrés : c'est elle qui
    // permet de poser plusieurs parcelles les unes par rapport aux autres.
    expect(parcel.originLonLat.lon).toBeCloseTo(2.06165554, 6)
    expect(parcel.originLonLat.lat).toBeCloseTo(48.89211647, 6)
  })

  it('produit une aire cohérente avec la contenance officielle', async () => {
    useDefaultRoutes()

    const parcel = await getParcel('785512510A1948')

    const computed = shoelaceArea(parcel.outlineM)
    expect(Math.abs(computed - parcel.contenanceM2) / parcel.contenanceM2).toBeLessThan(0.03)
  })

  it('soustrait le bâti pour donner le terrain hors bâti', async () => {
    useDefaultRoutes()

    const parcel = await getParcel('785512510A1948')

    expect(parcel.contenanceM2).toBe(405)
    expect(parcel.buildings).toHaveLength(1)
    expect(parcel.buildings![0].light).toBe(false)
    expect(parcel.builtM2).toBeGreaterThan(60)
    expect(parcel.builtM2).toBeLessThan(75)
    expect(parcel.gardenM2).toBe(405 - parcel.builtM2!)
    expect(parcel.gardenM2).toBeCloseTo(342, -1)
  })

  it('distingue les constructions légères, posées en abri et non en maison', async () => {
    route(url => url.includes('numero=2276'), () => json(parcelle2276))
    route(url => url.includes('BDTOPO_V3'), () => json(batiments2276))

    const parcel = await getParcel('785512510A2276')

    expect(parcel.contenanceM2).toBe(612)
    expect(parcel.buildings!.map(b => b.light).sort()).toEqual([false, true])
    // Une maison de ~99 m² et un abri de ~9 m².
    expect(parcel.builtM2).toBeCloseTo(108, -1)
    expect(parcel.gardenM2).toBe(612 - parcel.builtM2!)
  })

  it('garde le bâti à l’intérieur de la parcelle', async () => {
    useDefaultRoutes()

    const parcel = await getParcel('785512510A1948')

    for (const point of parcel.buildings!.flatMap(b => b.footprintM)) {
      expect(point.x).toBeGreaterThanOrEqual(-0.01)
      expect(point.y).toBeGreaterThanOrEqual(-0.01)
      expect(point.x).toBeLessThanOrEqual(parcel.bboxM.width + 0.01)
      expect(point.y).toBeLessThanOrEqual(parcel.bboxM.height + 0.01)
    }
  })

  it('reste utilisable quand la BD TOPO ne répond pas : bâti inconnu', async () => {
    route(url => url.includes('numero=1948'), () => json(parcelle1948))
    route(url => url.includes('BDTOPO_V3'), () => json({}, 500))

    const parcel = await getParcel('785512510A1948')

    expect(parcel.buildings).toBeNull()
    expect(parcel.builtM2).toBeNull()
    // Sans bâti connu, la surface retenue est la contenance entière.
    expect(parcel.gardenM2).toBe(405)
  })

  it('lève NOT_FOUND quand l’identifiant ne désigne aucune parcelle', async () => {
    route(url => url.includes('apicarto'), () => json({ features: [] }))

    await expect(getParcel('785512510A9999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lève UNAVAILABLE quand le cadastre est en panne', async () => {
    route(url => url.includes('apicarto'), () => json({}, 502))

    await expect(getParcel('785512510A1948')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('traduit une panne réseau en UNAVAILABLE, comme un abandon sur délai', async () => {
    route(url => url.includes('apicarto'), () => Promise.reject(new Error('ECONNRESET')))

    await expect(getParcel('785512510A1948')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })
})
