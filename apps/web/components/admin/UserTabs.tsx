import Link from 'next/link'

import { cn } from '@/lib/utils'
import { buildQuery, type SearchParams } from '@/lib/admin/search-params'

/**
 * Les six onglets de la fiche.
 *
 * L'onglet vit dans l'URL (`?onglet=`), comme les filtres des listes : la page
 * reste un Server Component, chaque onglet est un lien partageable, et
 * « précédent » revient au précédent onglet. C'est aussi ce qui permet de ne
 * charger que les données de l'onglet demandé.
 */
export const USER_TABS = [
  { key: 'profil', label: 'Profil' },
  { key: 'jardins', label: 'Jardins' },
  { key: 'plantes', label: 'Plantes' },
  { key: 'ia', label: 'Diagnostics & conversations' },
  { key: 'activite', label: 'Activité' },
  { key: 'actions', label: 'Actions' },
] as const

export type UserTabKey = (typeof USER_TABS)[number]['key']

const KEYS = USER_TABS.map((tab) => tab.key) as readonly string[]

/** Un onglet inconnu retombe sur « profil » plutôt que d'afficher un vide. */
export function readTab(params: SearchParams): UserTabKey {
  const raw = params.onglet
  const value = Array.isArray(raw) ? raw[0] : raw
  return KEYS.includes(value ?? '') ? (value as UserTabKey) : 'profil'
}

export function UserTabs({
  userId,
  active,
  params,
  counts,
}: {
  userId: string
  active: UserTabKey
  params: SearchParams
  counts: Partial<Record<UserTabKey, number>>
}) {
  return (
    <nav
      aria-label="Sections de la fiche"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-forest/10"
    >
      {USER_TABS.map((tab) => {
        const isActive = tab.key === active
        const count = counts[tab.key]

        return (
          <Link
            key={tab.key}
            href={`/admin/utilisateurs/${userId}${buildQuery(params, { onglet: tab.key })}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 font-raleway text-sm transition-colors',
              isActive
                ? 'border-lime font-semibold text-forest'
                : 'border-transparent text-forest/55 hover:text-forest',
            )}
          >
            {tab.label}
            {count !== undefined && (
              <span className="ml-2 text-xs text-forest/40">{count}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
