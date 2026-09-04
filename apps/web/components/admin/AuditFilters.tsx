import Link from 'next/link'

import { ADMIN_ACTIONS } from '@/lib/admin/audit'
import type { SearchParams } from '@/lib/admin/search-params'
import { displayNameOf } from '@/lib/admin/serializers'

type Actor = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
}

/** Même principe que `UserFilters` : un `<form method="GET">`, sans JavaScript. */
export function AuditFilters({ params, actors }: { params: SearchParams; actors: Actor[] }) {
  const value = (key: string) => {
    const raw = params[key]
    return (Array.isArray(raw) ? raw[0] : raw) ?? ''
  }

  const hasFilters = ['acteur', 'action', 'du', 'au'].some((key) => value(key) !== '')

  return (
    <form
      method="GET"
      className="mb-6 rounded-2xl border border-forest/10 bg-white p-4"
      aria-label="Filtrer le journal"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Acteur</span>
          <select
            name="acteur"
            defaultValue={value('acteur')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {displayNameOf(actor)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Action</span>
          <select
            name="action"
            defaultValue={value('action')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Toutes</option>
            {Object.entries(ADMIN_ACTIONS).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Du</span>
          <input
            type="date"
            name="du"
            defaultValue={value('du')}
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Au</span>
          <input
            type="date"
            name="au"
            defaultValue={value('au')}
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90"
        >
          Filtrer
        </button>
        {hasFilters && (
          <Link href="/admin/journal" className="text-sm text-forest/60 underline hover:text-forest">
            Tout effacer
          </Link>
        )}
      </div>
    </form>
  )
}
