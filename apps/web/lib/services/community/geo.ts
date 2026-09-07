import { createHash } from 'node:crypto'

import { FUZZY_GRID_DEGREES, FUZZY_JITTER_DEGREES } from '@growi/shared'

/**
 * Position floutée et distances de la communauté.
 *
 * Rien de ce module ne parle à la base : ce sont des fonctions pures, ce qui
 * les rend testables et — surtout — vérifiables. C'est ici que se joue la
 * promesse faite à l'utilisateur : « ton adresse n'est jamais partagée ».
 *
 * La position exacte (`User.latitude/longitude`) sert la météo et les conseils.
 * La communauté ne connaît que `User.fuzzyLat/fuzzyLng`, recopiée dans chaque
 * publication et chaque annonce au moment où elle est écrite.
 */

/** Rayon terrestre moyen, en kilomètres. */
const EARTH_RADIUS_KM = 6371

export interface FuzzyPosition {
  fuzzyLat: number
  fuzzyLng: number
}

/**
 * Deux décalages dans `[-FUZZY_JITTER_DEGREES, +FUZZY_JITTER_DEGREES]`,
 * **déterministes** pour un utilisateur donné.
 *
 * C'est le point important : un bruit tiré au hasard à chaque publication
 * s'annulerait à la moyenne, et une dizaine de photos suffiraient à retrouver
 * le centre — c'est-à-dire le jardin. Le même utilisateur reçoit donc toujours
 * le même décalage, quitte à ce que toutes ses publications tombent au même
 * endroit : c'est précisément ce qu'on veut montrer.
 */
function jitterFor(userId: string): { lat: number; lng: number } {
  const digest = createHash('sha256').update(userId).digest()

  // Deux entiers 32 bits indépendants, ramenés dans [-1, 1].
  const unit = (offset: number) => (digest.readUInt32BE(offset) / 0xffffffff) * 2 - 1

  return {
    lat: unit(0) * FUZZY_JITTER_DEGREES,
    lng: unit(4) * FUZZY_JITTER_DEGREES,
  }
}

/** Arrondi au centre de la cellule de grille contenant le point. */
function snapToGrid(degrees: number): number {
  return Math.round(degrees / FUZZY_GRID_DEGREES) * FUZZY_GRID_DEGREES
}

/**
 * Position publiable d'un utilisateur : grille ~1 km, puis bruit déterministe.
 *
 * À appeler à l'activation du profil public **et à chaque changement
 * d'adresse** — une position floutée qui reste sur l'ancienne commune serait
 * pire qu'inexacte, elle serait trompeuse.
 */
export function fuzzyPosition(
  userId: string,
  latitude: number,
  longitude: number,
): FuzzyPosition {
  const jitter = jitterFor(userId)

  return {
    fuzzyLat: snapToGrid(latitude) + jitter.lat,
    fuzzyLng: snapToGrid(longitude) + jitter.lng,
  }
}

/** Distance orthodromique entre deux points, en kilomètres. */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Distance mise en forme pour l'affichage — la seule forme sous laquelle une
 * position sort de l'API.
 *
 * L'arrondi grossit avec la distance : annoncer « à 23,4 km » suggérerait une
 * précision que le flou a justement retirée. En deçà du kilomètre on ne donne
 * pas de chiffre du tout, sans quoi « à 0 km » désignerait le voisin immédiat.
 */
export function formatDistance(km: number): string {
  if (km < 1) return "à moins d'1 km"
  if (km < 10) return `à ~${Math.round(km)} km`
  return `à ~${Math.round(km / 5) * 5} km`
}

/**
 * Distance affichable entre deux comptes, ou `null` si l'un des deux n'a pas
 * de position.
 *
 * `null` n'est pas une erreur : un compte tout juste créé depuis le mobile n'a
 * pas encore d'adresse, et sa carte s'affiche simplement sans distance.
 */
export function distanceLabelBetween(
  viewer: { fuzzyLat: number | null; fuzzyLng: number | null } | null,
  target: { fuzzyLat: number | null; fuzzyLng: number | null },
): string | null {
  if (!viewer?.fuzzyLat || !viewer.fuzzyLng) return null
  if (!target.fuzzyLat || !target.fuzzyLng) return null

  return formatDistance(
    distanceKm(
      { lat: viewer.fuzzyLat, lng: viewer.fuzzyLng },
      { lat: target.fuzzyLat, lng: target.fuzzyLng },
    ),
  )
}
