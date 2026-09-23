'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import type { ActionResult } from '@/components/admin/ActionButton'
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

/**
 * « Publier », avec la case « Prévenir les utilisateurs ».
 *
 * La case, cochée par défaut, demande l'annonce push du lendemain matin. Elle
 * n'apparaît qu'à la **première** publication : un article déjà publié une
 * fois a eu sa chance, le republier après une correction ne notifie personne.
 */
export function PublishButton({
  action,
  firstPublication,
}: {
  action: (notify: boolean) => Promise<ActionResult>
  firstPublication: boolean
}) {
  const [open, setOpen] = useState(false)
  const [notify, setNotify] = useState(true)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function execute() {
    setOpen(false)
    startTransition(async () => setResult(await action(firstPublication && notify)))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-4 py-2 text-sm font-medium text-forest transition-colors hover:bg-sand disabled:opacity-50"
      >
        {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
        Publier
      </button>

      {result && (
        <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
          {result.ok ? result.message : result.error}
        </p>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier cet article ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il apparaîtra aussitôt sur le blog, et dans l’app mobile dans l’heure. As-tu vérifié les
              chiffres de l’encart « À vérifier » ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {firstPublication ? (
            <label className="flex items-start gap-2 text-sm text-forest">
              <input
                type="checkbox"
                checked={notify}
                onChange={(event) => setNotify(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-forest"
              />
              <span>
                Prévenir les utilisateurs
                <span className="block text-xs text-forest/55">
                  Une notification part à la prochaine tournée du matin (6 h UTC : 8 h à Paris
                  l’été, 7 h l’hiver), avec les rappels, à ceux qui ont laissé « Nouveaux
                  conseils » activé.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-sm text-forest/60">
              Cet article a déjà été publié une fois : le republier ne renvoie pas de notification.
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setOpen(false)}
              className="rounded-lg border border-forest/15 px-4 py-2 text-sm font-medium text-forest hover:bg-sand"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={execute}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90"
            >
              Publier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
