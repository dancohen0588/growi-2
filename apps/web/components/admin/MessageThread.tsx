'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

/**
 * Composeur de réponse et note interne.
 *
 * Deux formulaires distincts pour deux gestes qui n'ont rien à voir : l'un
 * part chez l'expéditeur, l'autre ne quitte jamais l'admin. Les mêler dans un
 * seul écran d'édition serait le meilleur moyen d'envoyer une note interne.
 */
export function ReplyComposer({
  action,
  disabled,
  disabledReason,
  quotedSubject,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  disabled?: boolean
  disabledReason?: string
  quotedSubject: string
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
      // On ne vide le champ qu'en cas de succès : après un échec d'envoi, ce
      // qui vient d'être écrit ne doit surtout pas disparaître.
      if (outcome.ok) form.reset()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-sm text-forest/55">
        Objet de la réponse : <strong className="text-forest/80">Re: {quotedSubject}</strong>
      </div>

      <textarea
        name="body"
        rows={8}
        required
        disabled={disabled || pending}
        placeholder="Bonjour…"
        className="w-full rounded-lg border border-forest/15 px-3 py-2 text-forest disabled:bg-forest/5"
      />

      <p className="text-xs text-forest/50">
        Le message d’origine est cité sous ta réponse, et la signature « L’équipe Growi » est
        ajoutée. Les réponses de l’utilisateur arriveront dans la boîte <code>info@</code>, pas ici.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled || pending}
          className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Send size={15} aria-hidden />
          )}
          Envoyer la réponse
        </button>
        {disabled && disabledReason && (
          <span className="text-sm text-red-700">{disabledReason}</span>
        )}
        {result && (
          <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  )
}

export function InternalNoteForm({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  defaultValue: string
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
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        name="note"
        rows={4}
        defaultValue={defaultValue}
        disabled={pending}
        placeholder="Visible seulement ici."
        className="w-full rounded-lg border border-forest/15 px-3 py-2 text-sm text-forest"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-forest/15 px-4 py-2 text-sm font-medium text-forest hover:bg-sand disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          Enregistrer la note
        </button>
        {result && (
          <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  )
}
