/**
 * Liste noire de saisie.
 *
 * Un filet, pas un rempart. Elle arrête ce qui se tape sans réfléchir — une
 * insulte, une sollicitation commerciale évidente — et **rien d'autre** :
 * quiconque veut la contourner y arrivera en une minute. Ce qui protège
 * vraiment, c'est le signalement, le blocage et la revue humaine ; ceci évite
 * seulement qu'un mouvement d'humeur se retrouve à l'écran d'un voisin.
 *
 * Deux règles ont guidé la sélection :
 *
 * - **Aucun faux positif toléré sur le vocabulaire du jardin.** « Bite » est
 *   absent parce que « cucurbite » existe ; la recherche se fait de toute façon
 *   sur des mots entiers, mais le doute suffit à écarter un terme.
 * - **Pas de censure de l'opinion.** On n'y met ni « nul », ni « arnaque », ni
 *   le nom d'une enseigne : dire qu'un terreau est mauvais est un avis, et la
 *   modération n'est pas là pour le faire taire.
 */

/**
 * Termes refusés à la saisie.
 *
 * Écrits sans accent et en minuscules : la comparaison normalise le texte
 * entrant de la même façon, ce qui rend « CONNARD » et « connàrd » aussi
 * détectables.
 */
export const BLOCKED_TERMS = [
  // Insultes et injures — les plus courantes, au singulier comme au pluriel.
  'connard',
  'connasse',
  'salope',
  'salaud',
  'enculé',
  'encule',
  'ta gueule',
  'ferme ta gueule',
  'batard',
  'bâtard',
  'pute',
  'putain de toi',
  'abruti',
  'crétin',
  'cretin',
  'debile',
  'débile',
  'sale con',
  'gros con',
  'nique ta',
  'ntm',
  'fdp',
  'ta mere',
  'ta mère',

  // Sollicitations commerciales évidentes. La bourse est sans argent : une
  // annonce qui parle de virement ou de crypto n'y a pas sa place.
  'bitcoin',
  'crypto-monnaie',
  'cryptomonnaie',
  'western union',
  'paypal.me',
  'virement bancaire',
  'argent facile',
  'gagnez de l argent',
  'travail a domicile',
  'travail à domicile',
  'cliquez ici pour gagner',
  'viagra',
  'casino en ligne',
  'pari sportif',
  'paris sportifs',
] as const

/**
 * Normalise pour la comparaison : minuscules, accents retirés, espaces
 * réduits.
 *
 * Sans le retrait des accents, « énculé » passerait à côté de « encule ». Sans
 * la réduction des espaces, « ta   gueule » aussi.
 */
export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    // Retire les diacritiques, sans toucher au reste.
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Le premier terme interdit trouvé, ou `null`.
 *
 * La recherche porte sur des **mots entiers** : sans cela, « pute » bloquerait
 * « réputé » et « dispute », et « ntm » bloquerait à peu près n'importe quoi.
 * Les expressions à plusieurs mots sont cherchées telles quelles.
 */
export function findBlockedTerm(text: string): string | null {
  const normalized = normalizeForModeration(text)
  if (!normalized) return null

  for (const term of BLOCKED_TERMS) {
    const needle = normalizeForModeration(term)
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}([^\\p{L}\\p{N}]|$)`, 'u')
    if (pattern.test(normalized)) return term
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Message affiché quand un texte est refusé.
 *
 * Volontairement doux, et sans citer le terme : le but est qu'on reformule,
 * pas qu'on se sente pris en faute — et répéter l'insulte à son auteur
 * n'aiderait personne.
 */
export const BLOCKED_TERM_MESSAGE =
  'Ce message contient un terme que la communauté n’accepte pas. Reformule-le et réessaie.'
