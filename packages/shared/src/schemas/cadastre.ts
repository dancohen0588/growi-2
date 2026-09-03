import { z } from 'zod'

/**
 * Contrat des routes `/api/v1/cadastre/*` — retrouver le terrain d'un
 * utilisateur sur le plan cadastral à partir de ses coordonnées.
 *
 * Les géométries sont renvoyées **en mètres**, jamais en degrés : la
 * projection locale est faite côté serveur, l'origine est le coin nord-ouest
 * de la boîte englobante de la parcelle et l'axe `y` descend vers le sud,
 * comme le canevas du plan de jardin.
 */

/** Point d'un polygone, en mètres depuis le coin nord-ouest de la parcelle. */
export const meterPointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export type MeterPoint = z.infer<typeof meterPointSchema>

/**
 * Une parcelle proposée à l'utilisateur autour de son adresse.
 * `distanceM` est la distance renvoyée par le géocodage inverse : le point
 * d'une adresse est presque toujours posé sur la voie, pas dans la parcelle.
 */
export const parcelCandidateSchema = z.object({
  /** Identifiant cadastral unique, ex. `785512510A1948`. */
  idu: z.string(),
  section: z.string(),
  numero: z.string(),
  communeName: z.string(),
  /** Contenance cadastrale officielle, en m² (bâti compris). */
  contenanceM2: z.number(),
  distanceM: z.number(),
  /** Vignette WMS (orthophoto + parcellaire), chargée directement par le navigateur. */
  thumbnailUrl: z.string(),
})

export type ParcelCandidate = z.infer<typeof parcelCandidateSchema>

/** Emprise d'un bâtiment de la BD TOPO, ramenée à l'intérieur de la parcelle. */
export const parcelBuildingSchema = z.object({
  footprintM: z.array(meterPointSchema),
  areaInParcelM2: z.number(),
  /** Construction légère (abri, cabanon) — posée en `abri` et non en `maison`. */
  light: z.boolean(),
})

export type ParcelBuilding = z.infer<typeof parcelBuildingSchema>

/**
 * Le détail d'une parcelle, prêt à être posé sur le plan.
 *
 * `section` et `numero` ne figurent pas dans le contrat d'origine mais sont
 * nécessaires au libellé de l'élément posé (« Limite de parcelle · 0A 1948 »),
 * que le client construit sans avoir gardé la candidate correspondante.
 */
export const parcelDetailSchema = z.object({
  idu: z.string(),
  section: z.string(),
  numero: z.string(),
  contenanceM2: z.number(),
  thumbnailUrl: z.string(),
  /** Contour de la parcelle, en mètres. */
  outlineM: z.array(meterPointSchema),
  bboxM: z.object({ width: z.number(), height: z.number() }),
  /**
   * Coin nord-ouest de la parcelle, en degrés — l'origine du repère métrique
   * ci-dessus. C'est la seule façon, pour un terrain sur plusieurs parcelles,
   * de les poser les unes par rapport aux autres : chaque parcelle est servie
   * dans son propre repère, et sans ce point elles se superposeraient.
   */
  originLonLat: z.object({ lon: z.number(), lat: z.number() }),
  /** `null` quand la BD TOPO n'a pas répondu — le bâti est alors inconnu. */
  buildings: z.array(parcelBuildingSchema).nullable(),
  builtM2: z.number().nullable(),
  /** Terrain hors bâti : `contenanceM2 − builtM2`, ou la contenance si le bâti est inconnu. */
  gardenM2: z.number(),
})

export type ParcelDetail = z.infer<typeof parcelDetailSchema>

/**
 * Une coordonnée lue dans la chaîne de requête.
 *
 * `z.coerce.number()` traduirait un paramètre absent ou vide en `0`, une
 * coordonnée parfaitement valide au large du golfe de Guinée : on les ramène
 * donc à `undefined`, que le schéma refuse.
 */
function coordinate(min: number, max: number) {
  return z.preprocess(
    v => (v === null || v === '' ? undefined : v),
    z.coerce.number().min(min).max(max),
  )
}

/** Coordonnées acceptées par `GET /api/v1/cadastre/parcels`. */
export const parcelSearchQuerySchema = z.object({
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
})

export type ParcelSearchQuery = z.infer<typeof parcelSearchQuerySchema>
