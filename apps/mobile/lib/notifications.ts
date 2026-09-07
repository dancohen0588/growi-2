import type { Href } from 'expo-router'

/**
 * Où mène une notification.
 *
 * Le même routeur sert au **tap sur un push** (`data` du message Expo) et au
 * **tap dans la cloche** (`target` de la ligne en base) : le serveur écrit la
 * même forme dans les deux, précisément pour qu'il n'y ait qu'une table de
 * correspondance à tenir.
 *
 * Il ne fait rien de ce qu'il ne reconnaît pas. Une version future du serveur
 * peut donc annoncer une cible que cette version de l'app ignore — la
 * notification s'affichera, et le tap ouvrira la cloche plutôt que rien.
 */

export interface NotificationTargetLike {
  screen?: unknown
  postId?: unknown
  threadId?: unknown
  listingId?: unknown
  handle?: unknown
}

/** Les écrans que le serveur peut nommer directement (`data.screen`). */
const SCREENS = {
  calendrier: '/(tabs)/calendrier',
  communaute: '/(tabs)/communaute',
} as const

type ScreenKey = keyof typeof SCREENS

/**
 * La destination d'une notification, ou `null` si rien n'est reconnu.
 *
 * L'ordre compte : du plus précis au plus vague. Une notification de message
 * porte à la fois `threadId`, `listingId` et `handle` — ouvrir la discussion
 * vaut mieux qu'ouvrir l'annonce, qui vaut mieux qu'ouvrir un profil.
 */
export function notificationRoute(data: unknown): Href | null {
  if (typeof data !== 'object' || data === null) return null

  const target = data as NotificationTargetLike

  if (typeof target.postId === 'string' && target.postId) {
    return `/(tabs)/communaute/publications/${target.postId}` as Href
  }

  if (typeof target.threadId === 'string' && target.threadId) {
    return `/(tabs)/communaute/messages/${target.threadId}` as Href
  }

  if (typeof target.listingId === 'string' && target.listingId) {
    return `/(tabs)/communaute/bourse/${target.listingId}` as Href
  }

  if (typeof target.handle === 'string' && target.handle) {
    return `/(tabs)/communaute/u/${target.handle}` as Href
  }

  if (typeof target.screen === 'string' && target.screen in SCREENS) {
    return SCREENS[target.screen as ScreenKey]
  }

  return null
}
