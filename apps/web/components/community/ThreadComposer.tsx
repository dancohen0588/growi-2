'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'
import { LISTING_MESSAGE_MAX_LENGTH } from '@growi/shared'

import { sendThreadMessageAction } from '@/app/actions/community'

/**
 * Le champ d'envoi d'un fil d'annonce.
 *
 * Le champ n'est vidé qu'en cas de succès : après un refus — la liste noire,
 * un fil auquel on n'a plus accès — ce qui vient d'être écrit ne doit pas
 * disparaître.
 */
export function ThreadComposer({ threadId }: { threadId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await sendThreadMessageAction(threadId, formData)
      if (result.ok) {
        setError(null)
        form.reset()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="thread-body" className="sr-only">
        Message
      </label>
      <div className="flex gap-2">
        <input
          id="thread-body"
          name="body"
          required
          maxLength={LISTING_MESSAGE_MAX_LENGTH}
          disabled={pending}
          placeholder="Écris un message…"
          className="min-w-0 flex-1 rounded-lg border border-forest/15 px-3 py-2 font-raleway text-sm text-forest disabled:bg-forest/5"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Envoyer"
          className="inline-flex items-center rounded-lg bg-lime px-4 py-2 text-forest hover:bg-lime/80 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : (
            <Send size={18} aria-hidden />
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="font-raleway text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
