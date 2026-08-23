/**
 * Origine publique du site.
 *
 * Sert partout où une URL doit être **absolue** : sitemap, JSON-LD, et surtout
 * le JSON de l'API v1 — le mobile n'a pas de page courante à partir de
 * laquelle résoudre un chemin relatif.
 *
 * `NEXT_PUBLIC_SITE_URL` d'abord, `NEXTAUTH_URL` ensuite (elle est déjà posée
 * sur tous les environnements), et le domaine de production en dernier ressort.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.NEXTAUTH_URL
  ?? 'https://growi.app'
).replace(/\/+$/, '')

/**
 * Préfixe un chemin absolu (`/blog/x.png`) par l'origine du site.
 * Laisse tel quel ce qui est déjà une URL complète, et `null` reste `null`.
 */
export function absoluteUrl(path: string): string
export function absoluteUrl(path: string | null): string | null
export function absoluteUrl(path: string | null): string | null {
  if (!path) return path
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
