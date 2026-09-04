'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

type ActionButtonProps = {
  label: string
  description?: string
  /** L'action à exécuter, déjà liée à son `userId` côté serveur. */
  action: () => Promise<ActionResult>
  /** Texte du dialogue. Absent = pas de confirmation. */
  confirm?: { title: string; body: string; cta: string }
  /**
   * Mot à recopier pour armer la confirmation. Réservé aux gestes qui perdent
   * des données : il oblige à lire ce qu'on s'apprête à faire.
   */
  confirmPhrase?: string
  tone?: 'neutral' | 'danger'
}

const TONES = {
  neutral: 'border-forest/15 bg-white text-forest hover:bg-sand',
  danger: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
} as const

export function ActionButton({
  label,
  description,
  action,
  confirm,
  confirmPhrase,
  tone = 'neutral',
}: ActionButtonProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  // Comparaison insensible à la casse **des deux côtés** : la phrase est
  // tantôt un mot-clé (`RESET`), tantôt une adresse email en minuscules.
  const armed =
    !confirmPhrase || typed.trim().toLowerCase() === confirmPhrase.trim().toLowerCase()

  function execute() {
    setOpen(false)
    setTyped('')
    startTransition(async () => {
      setResult(await action())
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirm ? setOpen(true) : execute())}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
            TONES[tone],
          )}
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {label}
        </button>
        {description && <span className="text-sm text-forest/55">{description}</span>}
      </div>

      {result && (
        <p
          // `role="status"` plutôt qu'un simple texte : le retour d'une action
          // doit être annoncé, pas seulement affiché.
          role="status"
          className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}

      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {tone === 'danger' && (
                  <AlertTriangle size={18} className="text-red-600" aria-hidden />
                )}
                {confirm.title}
              </AlertDialogTitle>
              <AlertDialogDescription>{confirm.body}</AlertDialogDescription>
            </AlertDialogHeader>

            {confirmPhrase && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-forest/70">
                  Tape <strong>{confirmPhrase}</strong> pour confirmer.
                </span>
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  className="rounded-lg border border-forest/15 px-3 py-2 text-forest"
                  autoComplete="off"
                />
              </label>
            )}

            <AlertDialogFooter>
              {/* Ces deux boutons sont de simples <button> (voir
                  components/ui/alert-dialog.tsx) : ils ne ferment pas le
                  dialogue d'eux-mêmes et n'ont aucun style par défaut. */}
              <AlertDialogCancel
                onClick={() => {
                  setTyped('')
                  setOpen(false)
                }}
                className="rounded-lg border border-forest/15 px-4 py-2 text-sm font-medium text-forest hover:bg-sand"
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!armed}
                onClick={execute}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40',
                  tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-forest hover:bg-forest/90',
                )}
              >
                {confirm.cta}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
