/**
 * Le contenu du blog ne change qu'au déploiement : autant le laisser vivre
 * dans le CDN. `ok()` pose `no-store, private` par défaut — ce qui est juste
 * pour les routes propres à un compte, et faux ici, où la réponse est la même
 * pour tout le monde.
 *
 * `stale-while-revalidate` d'une journée : mieux vaut servir un article d'une
 * heure instantanément que faire attendre le mobile sur un réseau lent.
 */
export const BLOG_CACHE_HEADERS = {
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const
