'use client'

import { useState, useTransition } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

/**
 * « Régénérer l'image », repliable : le prompt n'intéresse qu'une fois sur
 * dix, mais c'est ici qu'on le corrige quand l'image rate son sujet. Il est
 * conservé tel qu'envoyé, pour qu'une prochaine régénération reparte de lui.
 */
export function CoverRegenerateForm({
  prompt,
  action,
}: {
  prompt: string | null
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setResult(null)
    startTransition(async () => setResult(await action(formData)))
  }

  return (
    <details className="rounded-2xl border border-forest/10 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-forest">
        Image de couverture — prompt et régénération
      </summary>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <textarea
          name="coverPrompt"
          rows={5}
          defaultValue={prompt ?? ''}
          placeholder="Décris la photo en anglais : sujet concret, cadre français, lumière rasante…"
          className="w-full rounded-lg border border-forest/15 px-3 py-2 font-mono text-xs text-forest"
        />
        <p className="text-xs text-forest/55">
          « No people, no text, no logos, no watermark. » est ajouté s’il manque. L’ancienne image
          n’est remplacée qu’une fois la nouvelle produite.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <RegenerateButton pending={pending} />
          {result && (
            <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
              {result.ok ? result.message : result.error}
            </p>
          )}
        </div>
      </form>
    </details>
  )
}

function RegenerateButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-4 py-2 text-sm font-medium text-forest hover:bg-sand disabled:opacity-50"
    >
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImageIcon size={15} aria-hidden />}
      {pending ? 'Image en cours…' : 'Régénérer l’image'}
    </button>
  )
}
