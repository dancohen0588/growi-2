'use client'

import { useState, useTransition } from 'react'
import { Loader2, ShieldPlus } from 'lucide-react'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

/**
 * Ajout d'un administrateur, par l'adresse d'un compte **existant**.
 *
 * Pas de recherche à la frappe : on promeut quelqu'un qu'on connaît, dont on a
 * l'adresse sous les yeux. Une liste déroulante de tous les comptes serait plus
 * longue à parcourir qu'un copier-coller, et exposerait la base d'emails dans
 * une page qui n'a pas besoin de la porter.
 */
export function PromoteAdminForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const outcome = await action(formData)
      setResult(outcome)
      if (outcome.ok) form.reset()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-forest/70">Adresse email du compte</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="quelquun@exemple.fr"
            disabled={pending}
            className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <ShieldPlus size={15} aria-hidden />
          )}
          Ajouter
        </button>
      </div>

      {result && (
        <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
          {result.ok ? result.message : result.error}
        </p>
      )}
    </form>
  )
}
