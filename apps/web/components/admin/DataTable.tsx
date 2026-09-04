import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Tableau des listes de l'admin.
 *
 * Server Component : la pagination et les filtres vivent dans l'URL
 * (`lib/admin/search-params.ts`), il n'y a donc aucun état à tenir côté client.
 *
 * Le tableau défile **dans son propre conteneur** : sans cela, une colonne de
 * trop ferait défiler la page entière de côté et la nav sortirait de l'écran.
 */

export type Column<T> = {
  key: string
  header: ReactNode
  /** Rendu de la cellule. */
  cell: (row: T) => ReactNode
  /** Masquée en petit écran — pour les colonnes de confort. */
  secondary?: boolean
  className?: string
}

type DataTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Lien d'ouverture de la ligne, s'il y en a un. */
  rowHref?: (row: T) => string
  empty: ReactNode
  /** Lien « page suivante », déjà construit avec le curseur. */
  nextHref?: string | null
  /** Lien « première page », affiché dès qu'on a quitté celle-ci. */
  resetHref?: string | null
  caption?: string
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  empty,
  nextHref,
  resetHref,
  caption,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-forest/10 bg-white p-10 text-center">{empty}</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-forest/10 bg-white">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-forest/10 text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-raleway text-xs font-semibold uppercase tracking-wide text-forest/50',
                    column.secondary && 'hidden lg:table-cell',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row)
              return (
                <tr
                  key={rowKey(row)}
                  className="border-b border-forest/5 last:border-0 hover:bg-sand/60"
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3 align-middle text-forest/80',
                        column.secondary && 'hidden lg:table-cell',
                        column.className,
                      )}
                    >
                      {/* Le lien porte la première cellule plutôt que la ligne :
                          un <a> ne peut pas envelopper un <tr>, et rendre la
                          ligne cliquable en JS priverait du clic-droit et de
                          l'ouverture dans un onglet. */}
                      {index === 0 && href ? (
                        <Link href={href} className="font-medium text-forest hover:underline">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(nextHref || resetHref) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {resetHref && (
              <Link
                href={resetHref}
                className="rounded-lg border border-forest/15 px-4 py-2 text-sm text-forest/70 hover:bg-white"
              >
                Première page
              </Link>
            )}
          </div>
          {nextHref && (
            <Link
              href={nextHref}
              className="rounded-lg border border-forest/15 bg-white px-4 py-2 text-sm font-medium text-forest hover:bg-sand"
            >
              Page suivante
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
