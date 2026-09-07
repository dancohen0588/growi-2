/**
 * Curseurs de pagination de la communauté.
 *
 * Toutes les listes sont triées par `(createdAt, id)` décroissant et paginées
 * par curseur, jamais par `OFFSET` : dans un fil antéchronologique, une
 * publication arrivée entre deux pages décalerait toutes les suivantes, et on
 * relirait la même carte deux fois. L'identifiant départage deux contenus
 * écrits dans la même milliseconde.
 *
 * Le curseur est opaque pour le client : il le renvoie tel quel. C'est ce qui
 * permet d'y glisser autre chose que la position — le rayon effectif du fil,
 * pour que l'élargissement automatique tienne d'une page à l'autre.
 */

export interface Cursor {
  createdAt: Date
  id: string
  /** Rayon effectif, en km — uniquement pour le fil. */
  radiusKm?: number
}

export function encodeCursor(cursor: Cursor): string {
  const parts = [cursor.createdAt.toISOString(), cursor.id]
  if (cursor.radiusKm !== undefined) parts.push(String(cursor.radiusKm))

  return Buffer.from(parts.join('|'), 'utf8').toString('base64url')
}

/**
 * Lit un curseur, ou rend `null` s'il est illisible.
 *
 * Tolérant plutôt qu'en erreur : un curseur tronqué ou périmé doit ramener la
 * première page, pas une erreur au milieu d'un défilement. C'est la même
 * indulgence que les filtres d'URL du portail admin.
 */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null

  try {
    const [iso, id, radius] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
    if (!iso || !id) return null

    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime())) return null

    const radiusKm = radius ? Number(radius) : undefined
    return {
      createdAt,
      id,
      radiusKm: radiusKm && Number.isFinite(radiusKm) ? radiusKm : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Découpe une page lue avec une ligne d'avance.
 *
 * Demander `size + 1` est ce qui permet de savoir s'il reste quelque chose
 * sans faire un `COUNT` sur toute la table à chaque page.
 */
export function takePage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  size: number,
  radiusKm?: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, size)
  const last = items[items.length - 1]

  return {
    items,
    nextCursor:
      rows.length > size && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id, radiusKm })
        : null,
  }
}
