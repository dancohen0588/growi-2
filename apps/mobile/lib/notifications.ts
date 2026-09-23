import type { PushKind } from '@growi/shared'
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
  /** Article du blog annoncé le matin de sa sortie. */
  slug?: unknown
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
 * Nature d'une notification, pour la mesure.
 *
 * Le serveur n'envoie pas de champ dédié : on le déduit de ce qu'elle vise.
 * Un `slug` désigne un article du blog.
 * Une cible de la communauté (publication, fil, annonce, profil) ou un `kind`
 * de la communauté valent `community` ; le rappel du matin vise le
 * calendrier. Dans le doute, `planning` — c'est ce que le serveur envoie le
 * plus.
 */
export function notificationKind(data: unknown): PushKind {
  if (typeof data !== 'object' || data === null) return 'planning'

  const target = data as NotificationTargetLike & { kind?: unknown }

  // Avant le `kind` : l'annonce d'un article n'en porte pas, mais une version
  // future pourrait en ajouter un — elle ne doit pas passer pour la communauté.
  if (typeof target.slug === 'string' && target.slug) return 'blog'

  if (target.postId || target.threadId || target.listingId || target.handle) return 'community'
  if (target.screen === 'communaute') return 'community'
  if (typeof target.kind === 'string' && target.kind) return 'community'

  return 'planning'
}

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

  // `from=push` : l'écran de l'article le transmet à la mesure
  // (`article_viewed`), qui distingue déjà cette provenance.
  if (typeof target.slug === 'string' && target.slug) {
    return `/(tabs)/accueil/conseils/${encodeURIComponent(target.slug)}?from=push` as Href
  }

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
