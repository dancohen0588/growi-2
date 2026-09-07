import { describe, expect, it } from 'vitest'

import {
  distanceKm,
  distanceLabelBetween,
  formatDistance,
  fuzzyPosition,
} from '../geo'

// Ce module porte la promesse « ton adresse n'est jamais partagée ». Ce qu'on
// vérifie ici n'est pas qu'il calcule juste — c'est qu'il ne laisse pas
// remonter la position exacte, ni par la valeur, ni par la moyenne.

const PARIS = { lat: 48.8566, lng: 2.3522 }
const LYON = { lat: 45.764, lng: 4.8357 }

describe('fuzzyPosition', () => {
  it('éloigne la position publiée de la position réelle', () => {
    const fuzzy = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)

    expect(fuzzy.fuzzyLat).not.toBe(PARIS.lat)
    expect(fuzzy.fuzzyLng).not.toBe(PARIS.lng)
  })

  it('reste à moins de 2 km du point réel', () => {
    // Assez flou pour ne pas désigner un jardin, assez proche pour qu'un
    // rayon de 5 km garde un sens.
    const fuzzy = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)
    const drift = distanceKm(PARIS, { lat: fuzzy.fuzzyLat, lng: fuzzy.fuzzyLng })

    expect(drift).toBeLessThan(2)
  })

  it('rend toujours le même résultat pour un même utilisateur', () => {
    // C'est ce qui empêche de retrouver la position réelle en moyennant
    // plusieurs publications : le bruit ne se renouvelle pas.
    const a = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)
    const b = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)

    expect(a).toEqual(b)
  })

  it('décale deux utilisateurs différemment depuis le même point', () => {
    const a = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)
    const b = fuzzyPosition('user_2', PARIS.lat, PARIS.lng)

    expect(a).not.toEqual(b)
  })

  it('déplace la position publiée quand l’utilisateur déménage', () => {
    const before = fuzzyPosition('user_1', PARIS.lat, PARIS.lng)
    const after = fuzzyPosition('user_1', LYON.lat, LYON.lng)

    expect(distanceKm(
      { lat: before.fuzzyLat, lng: before.fuzzyLng },
      { lat: after.fuzzyLat, lng: after.fuzzyLng },
    )).toBeGreaterThan(300)
  })

  it('ne laisse pas deviner la position à 100 m près par la moyenne', () => {
    // Simule dix publications du même compte : elles portent toutes la même
    // position floutée, donc leur moyenne ne converge vers rien.
    const samples = Array.from({ length: 10 }, () =>
      fuzzyPosition('user_1', PARIS.lat, PARIS.lng),
    )
    const mean = {
      lat: samples.reduce((sum, s) => sum + s.fuzzyLat, 0) / samples.length,
      lng: samples.reduce((sum, s) => sum + s.fuzzyLng, 0) / samples.length,
    }

    expect(distanceKm(PARIS, mean)).toBeGreaterThan(0.1)
  })
})

describe('distanceKm', () => {
  it('mesure Paris–Lyon à ~392 km', () => {
    expect(distanceKm(PARIS, LYON)).toBeGreaterThan(385)
    expect(distanceKm(PARIS, LYON)).toBeLessThan(400)
  })
})

describe('formatDistance', () => {
  it('tait le chiffre sous le kilomètre', () => {
    // « à 0 km » désignerait le voisin immédiat.
    expect(formatDistance(0)).toBe("à moins d'1 km")
    expect(formatDistance(0.6)).toBe("à moins d'1 km")
  })

  it('arrondit au kilomètre en deçà de 10 km', () => {
    expect(formatDistance(3.4)).toBe('à ~3 km')
  })

  it('arrondit à 5 km au-delà, pour ne pas suggérer une précision absente', () => {
    expect(formatDistance(23.4)).toBe('à ~25 km')
    expect(formatDistance(47)).toBe('à ~45 km')
  })
})

describe('distanceLabelBetween', () => {
  it('ne rend rien pour un lecteur anonyme', () => {
    expect(distanceLabelBetween(null, { fuzzyLat: 48.85, fuzzyLng: 2.35 })).toBeNull()
  })

  it('ne rend rien quand l’un des deux n’a pas de position', () => {
    // Un compte créé depuis le mobile n'a pas forcément d'adresse : sa carte
    // s'affiche sans distance, ce n'est pas une erreur.
    expect(
      distanceLabelBetween({ fuzzyLat: 48.85, fuzzyLng: 2.35 }, { fuzzyLat: null, fuzzyLng: null }),
    ).toBeNull()
  })

  it('rend une distance déjà mise en forme', () => {
    expect(
      distanceLabelBetween(
        { fuzzyLat: PARIS.lat, fuzzyLng: PARIS.lng },
        { fuzzyLat: LYON.lat, fuzzyLng: LYON.lng },
      ),
    ).toBe('à ~390 km')
  })
})
