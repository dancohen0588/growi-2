/**
 * Normalisation des chemins pour l'observabilité.
 *
 * Un nom qui porte un identifiant n'est pas un nom : `/plants/clx8f…/logs` et
 * `/plants/cm2a1…/logs` sont le même écran et la même route, mais font deux
 * lignes distinctes dans un tableau de performances, et deux entonnoirs
 * distincts dans PostHog. On remplace donc chaque segment qui ressemble à un
 * identifiant par `[id]`.
 *
 * Côté serveur, l'API v1 n'a pas besoin de ça : Next lui passe les `params`,
 * et la substitution y est exacte plutôt que devinée (voir
 * `apps/web/lib/observability/report.ts`). Ici — client mobile, chemins
 * d'écrans, URL de requêtes — on n'a que la chaîne.
 */

/**
 * Ce qui est tenu pour un identifiant :
 * - un cuid (`clx…`, `cm…`), la forme des identifiants de la base ;
 * - un UUID ;
 * - une suite de chiffres ;
 * - une longue chaîne hexadécimale (jetons de partage, empreintes).
 *
 * Un slug d'article (`arroser-en-ete`) n'en est pas un et doit le rester : il
 * dit *quel* contenu a été vu, ce qu'on veut précisément mesurer.
 */
const ID_SEGMENT =
  /^(?:c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[0-9a-f]{24,})$/i

/** Un segment est-il un identifiant plutôt qu'un nom de route ? */
export function isIdSegment(segment: string): boolean {
  return ID_SEGMENT.test(segment)
}

/**
 * Remplace par `[id]` les segments d'un chemin qui sont des identifiants.
 *
 * La chaîne de requête est écartée : elle peut porter un curseur, un rayon,
 * une position — rien qui doive nommer une route.
 */
export function normalizeApiPath(path: string): string {
  const [pathname] = path.split('?')
  return pathname
    .split('/')
    .map((segment) => (isIdSegment(segment) ? '[id]' : segment))
    .join('/')
}

/** `https://hôte` puis le chemin, sans la chaîne de requête ni le fragment. */
const ORIGIN_AND_PATH = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)([^?#]*)/i

/**
 * Même chose sur une URL complète, en conservant l'hôte.
 *
 * Rendre le chemin seul serait plus court, mais on perdrait la distinction
 * entre notre API et un tiers — Supabase, Open-Meteo — dans la liste des
 * requêtes lentes. Ce qui n'est pas une URL est traité comme un chemin.
 *
 * Découpage à la main plutôt que `new URL` : ce module tourne aussi sous
 * Hermes, dont l'implémentation d'`URL` est partielle et rend des `pathname`
 * fantaisistes selon les versions.
 */
export function normalizeUrl(url: string): string {
  const match = url.match(ORIGIN_AND_PATH)
  if (!match) return normalizeApiPath(url)
  return `${match[1]}${normalizeApiPath(match[2])}`
}
