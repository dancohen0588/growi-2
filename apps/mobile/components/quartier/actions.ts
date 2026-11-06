import type { Href } from 'expo-router'
import type { QuartierActionTarget } from '@growi/shared'

/**
 * Où mène le bouton du défi. `navigate` pour un onglet (il le sélectionne au
 * lieu d'empiler l'écran dans la pile Communauté), `push` pour la modale de
 * publication, déclarée à la racine.
 */
export const QUARTIER_ACTION_ROUTES: Record<QuartierActionTarget, { href: Href; mode: 'navigate' | 'push' }> = {
  calendrier: { href: '/(tabs)/calendrier', mode: 'navigate' },
  plantes: { href: '/(tabs)/plantes', mode: 'navigate' },
  publier: { href: '/publier', mode: 'push' },
  bourse: { href: '/(tabs)/communaute/bourse', mode: 'push' },
  communaute: { href: '/(tabs)/communaute', mode: 'navigate' },
}

/** « à 20 km », « à 100 km », « dans toute la France ». */
export function quartierPlace(radiusKm: number | null): string {
  return radiusKm === null ? 'dans toute la France' : `à ${radiusKm} km`
}

export function daysLeftLabel(days: number): string {
  if (days <= 1) return 'dernier jour'
  return `encore ${days} jours`
}
