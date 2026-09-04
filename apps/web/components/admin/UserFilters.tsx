import Link from 'next/link'
import { USER_ROLE_LABELS, USER_ROLES } from '@growi/shared'

import type { SearchParams } from '@/lib/admin/search-params'

/**
 * Filtres de la liste des utilisateurs.
 *
 * Un simple `<form method="GET">` : pas de `'use client'`, pas de JavaScript.
 * Soumettre écrit les filtres dans l'URL, ce qui est exactement l'état qu'on
 * veut — partageable, réversible par « précédent », et lisible par la page qui
 * reste un Server Component.
 *
 * Le champ `apres` est volontairement absent : changer un filtre doit ramener
 * à la première page, sans quoi on paginerait dans un jeu qui n'existe plus.
 */
export function UserFilters({
  params,
  plans,
  total,
}: {
  params: SearchParams
  plans: string[]
  total: number
}) {
  const value = (key: string) => {
    const raw = params[key]
    return (Array.isArray(raw) ? raw[0] : raw) ?? ''
  }

  const hasFilters = ['q', 'role', 'plan', 'onboarde', 'desactive', 'inscrit_depuis', 'actif_depuis', 'inactif_depuis'].some(
    (key) => value(key) !== '',
  )

  return (
    <form
      method="GET"
      className="mb-6 rounded-2xl border border-forest/10 bg-white p-4"
      aria-label="Filtrer les utilisateurs"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-forest/70">Recherche</span>
          <input
            type="search"
            name="q"
            defaultValue={value('q')}
            placeholder="Nom, prénom ou email"
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Rôle</span>
          <select
            name="role"
            defaultValue={value('role')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Plan</span>
          <select
            name="plan"
            defaultValue={value('plan')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            {plans.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Onboardé</span>
          <select
            name="onboarde"
            defaultValue={value('onboarde')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Peu importe</option>
            <option value="1">Oui</option>
            <option value="0">Non</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">État</span>
          <select
            name="desactive"
            defaultValue={value('desactive')}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Tous</option>
            <option value="0">Actifs</option>
            <option value="1">Désactivés</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Inscrit depuis le</span>
          <input
            type="date"
            name="inscrit_depuis"
            defaultValue={value('inscrit_depuis')}
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Sans activité depuis le</span>
          <input
            type="date"
            name="inactif_depuis"
            defaultValue={value('inactif_depuis')}
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
          <Link
            href="/admin/utilisateurs"
            className="text-sm text-forest/60 underline hover:text-forest"
          >
            Tout effacer
          </Link>
        )}
        <span className="ml-auto text-sm text-forest/60">
          {total.toLocaleString('fr-FR')} compte{total > 1 ? 's' : ''}
        </span>
      </div>
    </form>
  )
}
