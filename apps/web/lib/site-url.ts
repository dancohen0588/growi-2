/**
 * Origine publique du site, pour tout ce qui doit être une URL **absolue** :
 * sitemap, JSON-LD, et le JSON de l'API v1 — le mobile n'a pas de page
 * courante à partir de laquelle résoudre un chemin relatif.
 */

/** Origine explicitement configurée, ou `null` si personne ne l'a posée. */
const CONFIGURED = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || null

/**
 * Origine canonique du site.
 *
 * À utiliser pour ce qui ne dépend pas d'une requête et doit rester stable :
 * sitemap et JSON-LD, où l'URL identifie la ressource pour les moteurs et ne
 * peut donc pas varier avec l'hôte par lequel on est arrivé.
 */
export const SITE_URL =
  CONFIGURED ?? process.env.NEXTAUTH_URL?.replace(/\/+$/, '') ?? 'https://growi-garden.fr'

/**
 * Origine à utiliser pour absolutiser ce que renvoie une requête d'API.
 *
 * L'origine configurée l'emporte — en production, c'est le domaine public qui
 * fait foi. À défaut, on reprend celle par laquelle l'appel est arrivé : en
 * développement, le mobile joint le Mac par son IP locale
 * (`http://192.168.1.5:3000`), et lui répondre des images sur `localhost` les
 * ferait chercher sur le téléphone lui-même.
 */
export function requestOrigin(request: Request): string {
  if (CONFIGURED) return CONFIGURED

  try {
    const url = new URL(request.url)
    // `request.url` est normalisé sur l'adresse d'écoute du serveur : en
    // développement il dit `localhost` même quand l'appel est arrivé par l'IP
    // du réseau local. C'est l'en-tête `Host` qui porte l'origine réelle, et
    // `X-Forwarded-*` quand un proxy est devant.
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
    const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')

    return `${protocol}://${host}`
  } catch {
    return SITE_URL
  }
}

/**
 * Préfixe un chemin absolu (`/blog/x.png`) par une origine.
 * Laisse tel quel ce qui est déjà une URL complète, et `null` reste `null`.
 */
export function absoluteUrl(path: string, baseUrl?: string): string
export function absoluteUrl(path: string | null, baseUrl?: string): string | null
export function absoluteUrl(path: string | null, baseUrl: string = SITE_URL): string | null {
  if (!path) return path
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
