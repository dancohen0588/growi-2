'use client'

import { useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { DELETE_ACCOUNT_CONFIRMATION, type UserProfile } from '@growi/shared'

import { deleteAccountAction } from '@/app/actions/account'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Suppression du compte en libre-service — droit à l'effacement, et exigence
 * des deux boutiques.
 *
 * Deux verrous, parce que le geste est immédiat et sans retour : taper le mot
 * exact, et redonner son mot de passe. Le bouton ne s'active qu'avec le mot
 * juste ; le mot de passe, lui, est vérifié par le serveur.
 *
 * En cas de succès, l'action déconnecte et renvoie vers l'accueil : ce
 * composant ne voit donc jamais de réussite, seulement des erreurs.
 */
export function SupprimerCompteCard({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirmed = confirmation === DELETE_ACCOUNT_CONFIRMATION
  const ready = confirmed && (!profile.hasPassword || password.length > 0)

  function reset(next: boolean) {
    // Pas de fermeture pendant l'envoi : l'issue doit rester lisible.
    if (pending) return
    setOpen(next)
    if (!next) {
      setConfirmation('')
      setPassword('')
      setError(null)
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return
    setError(null)
    startTransition(async () => {
      const result = await deleteAccountAction({
        confirmation,
        ...(profile.hasPassword ? { password } : {}),
      })
      // Le succès ne revient pas : il redirige.
      setError(result.error)
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
      <div className="space-y-1">
        <p className="font-poppins font-semibold text-forest">Supprimer mon compte</p>
        <p className="font-raleway text-sm text-forest/70">
          Tes jardins, tes plantes, tes photos, tes publications, tes annonces et tes
          commentaires sont effacés immédiatement et définitivement.
        </p>
      </div>

      <button
        type="button"
        onClick={() => reset(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-red-600 px-4 font-poppins text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
      >
        <Trash2 size={16} aria-hidden />
        Supprimer mon compte
      </button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-w-md rounded-2xl bg-white">
          <DialogTitle className="font-poppins text-xl text-forest">
            Supprimer ton compte ?
          </DialogTitle>
          <DialogDescription className="font-raleway text-[15px] leading-relaxed text-forest/80">
            Tes jardins, tes plantes, tes photos, tes publications, tes annonces et tes
            commentaires seront effacés <strong>immédiatement et définitivement</strong>. Rien ne
            pourra être récupéré.
          </DialogDescription>

          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="font-raleway text-sm text-forest">
                Tape <strong>{DELETE_ACCOUNT_CONFIRMATION}</strong> pour confirmer
              </span>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={pending}
                className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </label>

            {profile.hasPassword && (
              <label className="block space-y-1.5">
                <span className="font-raleway text-sm text-forest">Ton mot de passe</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={pending}
                  className="h-11 w-full rounded-lg border border-forest/20 bg-white px-4 font-raleway text-sm text-forest focus:outline-none focus:ring-2 focus:ring-lime"
                />
              </label>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-raleway text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 min-[480px]:flex-row min-[480px]:justify-end">
              <button
                type="button"
                onClick={() => reset(false)}
                disabled={pending}
                className="min-h-[44px] rounded-lg px-4 font-poppins text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!ready || pending}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 font-poppins text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
                Supprimer définitivement
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
