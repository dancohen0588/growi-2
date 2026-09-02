'use client'

import { useState, useTransition } from 'react'
import { Apple, Check, Loader2 } from 'lucide-react'

import { subscribeToIosBeta } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'

/**
 * Le bouton n'ouvre le champ qu'au clic : la home demande d'abord un compte,
 * pas une adresse. Un formulaire déplié d'entrée détournerait l'attention du
 * CTA principal.
 */
export function BetaIosForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border-2 border-white/70 px-6 py-3.5 font-poppins font-semibold text-white">
        <Check size={20} aria-hidden />
        C&apos;est noté — on te préviendra.
      </p>
    )
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="lg"
        className="border-white/70 text-white hover:bg-white/20"
        onClick={() => setOpen(true)}
      >
        <Apple size={20} aria-hidden />
        Être prévenu de la bêta iOS
      </Button>
    )
  }

  return (
    <form
      className="flex w-full max-w-md flex-col items-stretch gap-2 sm:w-auto"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await subscribeToIosBeta(email)
          if (result.success) setDone(true)
          else setError(result.error ?? 'Une erreur est survenue.')
        })
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="beta-ios-email" className="sr-only">
          Ton adresse e-mail
        </label>
        <input
          id="beta-ios-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ton@email.fr"
          aria-describedby={error ? 'beta-ios-error' : undefined}
          className="min-h-[44px] flex-1 rounded-xl border-2 border-white/70 bg-white/95 px-4 font-raleway text-forest placeholder:text-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
        />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 size={18} className="animate-spin" aria-hidden />}
          Me prévenir
        </Button>
      </div>
      {error && (
        <p id="beta-ios-error" role="alert" className="font-raleway text-sm text-white">
          {error}
        </p>
      )}
    </form>
  )
}
