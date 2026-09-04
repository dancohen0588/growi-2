'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { PROFILE_GARDEN_TYPES, PROFILE_GARDEN_TYPE_LABELS } from '@growi/shared'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

type Values = {
  firstName: string | null
  lastName: string | null
  name: string | null
  email: string
  address: string | null
  city: string | null
  gardenType: string | null
  latitude: number | null
  longitude: number | null
  plan: string
  timezone: string
  onboarded: boolean
}

/**
 * Édition du profil d'un compte depuis l'admin.
 *
 * Les champs affichés **sont** la liste blanche : ce que le formulaire ne
 * propose pas, la Server Action ne le lit pas, et le service ne l'écrit pas.
 * Trois barrières pour la même règle, parce qu'une seule finit toujours par
 * être contournée.
 *
 * Le mot de passe n'y figure pas et n'y figurera pas : il n'existe pas encore
 * de parcours de réinitialisation, et un administrateur n'a pas à en choisir un.
 */
export function UserProfileForm({
  values,
  plans,
  action,
}: {
  values: Values
  plans: string[]
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      setResult(await action(formData))
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Identité">
        <Field label="Prénom" name="firstName" defaultValue={values.firstName ?? ''} />
        <Field label="Nom" name="lastName" defaultValue={values.lastName ?? ''} />
        <Field
          label="Nom d’affichage"
          name="name"
          defaultValue={values.name ?? ''}
          hint="Renseigné à l’inscription par mot de passe."
        />
        <Field label="Email" name="email" type="email" defaultValue={values.email} />
      </Section>

      <Section title="Lieu">
        <Field label="Adresse" name="address" defaultValue={values.address ?? ''} wide />
        <Field label="Ville" name="city" defaultValue={values.city ?? ''} />
        <Field
          label="Fuseau horaire"
          name="timezone"
          defaultValue={values.timezone}
          hint="Sert aux heures calmes des rappels et au quota du chat."
        />
        <Field
          label="Latitude"
          name="latitude"
          type="number"
          step="any"
          defaultValue={values.latitude ?? ''}
          hint="La modifier vide le cache de conseils."
        />
        <Field
          label="Longitude"
          name="longitude"
          type="number"
          step="any"
          defaultValue={values.longitude ?? ''}
        />
      </Section>

      <Section title="Compte">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Plan</span>
          <input
            name="plan"
            defaultValue={values.plan}
            list="admin-plans"
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
          {/* Une liste de suggestions plutôt qu'un <select> : les plans ne sont
              pas une énumération du domaine, seulement une chaîne en base. */}
          <datalist id="admin-plans">
            {plans.map((plan) => (
              <option key={plan} value={plan} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Type de jardin</span>
          <select
            name="gardenType"
            defaultValue={values.gardenType ?? ''}
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest"
          >
            <option value="">Non renseigné</option>
            {PROFILE_GARDEN_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROFILE_GARDEN_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="onboarded"
            defaultChecked={values.onboarded}
            className="size-4 rounded border-forest/30"
          />
          <span className="font-medium text-forest/70">Onboardé</span>
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-forest/10 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Enregistrer
        </button>
        {result && (
          <p
            role="status"
            className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}
          >
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 font-poppins text-sm font-semibold uppercase tracking-wide text-forest/50">
        {title}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  name,
  hint,
  wide,
  ...input
}: {
  label: string
  name: string
  hint?: string
  wide?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn('flex flex-col gap-1 text-sm', wide && 'sm:col-span-2 lg:col-span-3')}>
      <span className="font-medium text-forest/70">{label}</span>
      <input
        name={name}
        {...input}
        className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
      />
      {hint && <span className="text-xs text-forest/50">{hint}</span>}
    </label>
  )
}
