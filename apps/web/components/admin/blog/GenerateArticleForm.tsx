'use client'

import { useState, useTransition } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

/**
 * « Générer un article », avec un sujet facultatif.
 *
 * La génération tourne dans la requête (jusqu'à une minute) : le bouton le dit
 * pendant tout ce temps, sans quoi on le retape en croyant qu'il n'a rien
 * fait. En cas de succès, l'action ouvre la fiche du brouillon ; seul un échec
 * revient ici.
 */
export function GenerateArticleForm({
  action,
  disabledReason,
  maxTopicLength,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  /** Plafond de brouillons atteint : le bouton est désactivé, et dit pourquoi. */
  disabledReason?: string
  maxTopicLength: number
}) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setResult(null)
    // En cas de succès, l'action redirige vers la fiche : on n'en revient pas.
    startTransition(async () => setResult(await action(formData)))
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="generate-topic">
          Sujet (facultatif)
        </label>
        <input
          id="generate-topic"
          name="topic"
          maxLength={maxTopicLength}
          disabled={Boolean(disabledReason) || pending}
          placeholder="Sujet (facultatif) — sinon, choisi selon la saison"
          className="min-w-0 flex-1 rounded-lg border border-forest/15 px-3 py-2 text-sm text-forest disabled:bg-forest/5 sm:w-80"
        />
        <GenerateButton disabled={Boolean(disabledReason)} pending={pending} />
      </div>

      {disabledReason && <p className="text-sm text-forest/60">{disabledReason}</p>}
      {result && !result.ok && (
        <p role="status" className="text-sm text-red-700">
          {result.error}
        </p>
      )}
    </form>
  )
}

function GenerateButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest/90',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
      {pending ? 'Rédaction en cours…' : 'Générer un article'}
    </button>
  )
}
