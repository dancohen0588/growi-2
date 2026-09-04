import Link from 'next/link'
import {
  CONTACT_MESSAGE_SOURCE_LABELS,
  CONTACT_MESSAGE_SOURCES,
  CONTACT_MESSAGE_STATUS_LABELS,
  CONTACT_MESSAGE_STATUSES,
} from '@growi/shared'

import { CONTACT_SUBJECTS } from '@/lib/schemas/contact-schema'
import type { SearchParams } from '@/lib/admin/search-params'

/** Même principe que les autres filtres : un `<form method="GET">`, sans JavaScript. */
export function MessageFilters({ params, total }: { params: SearchParams; total: number }) {
  const value = (key: string) => {
    const raw = params[key]
    return (Array.isArray(raw) ? raw[0] : raw) ?? ''
  }

  const hasFilters = ['statut', 'source', 'sujet', 'q'].some((key) => value(key) !== '')

  return (
    <form
      method="GET"
      className="mb-6 rounded-2xl border border-forest/10 bg-white p-4"
      aria-label="Filtrer les messages"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Recherche</span>
          <input
            type="search"
            name="q"
            defaultValue={value('q')}
            placeholder="Email, nom ou contenu"
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Statut</span>
          <select
            name="statut"
            defaultValue={value('statut')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            {CONTACT_MESSAGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONTACT_MESSAGE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Source</span>
          <select
            name="source"
            defaultValue={value('source')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Toutes</option>
            {CONTACT_MESSAGE_SOURCES.map((source) => (
              <option key={source} value={source}>
                {CONTACT_MESSAGE_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Sujet</span>
          <select
            name="sujet"
            defaultValue={value('sujet')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            {CONTACT_SUBJECTS.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label.replace(/^[^\s]+ /, '')}
              </option>
            ))}
          </select>
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
          <Link href="/admin/messages" className="text-sm text-forest/60 underline hover:text-forest">
            Tout effacer
          </Link>
        )}
        <span className="ml-auto text-sm text-forest/60">
          {total.toLocaleString('fr-FR')} message{total > 1 ? 's' : ''}
        </span>
      </div>
    </form>
  )
}
