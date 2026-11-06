'use client'

import { useId, useState, useTransition } from 'react'
import {
  SAP_GIFT_MESSAGE_MAX_LENGTH,
  SAP_GIFT_REASON_LABELS,
  SAP_GIFT_REASONS,
  SAP_GIFTS_PER_WEEK,
  type SapGiftReason,
} from '@growi/shared'

import { getGiftQuotaAction, giveSapDropAction } from '@/app/actions/sap'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { GiftDrops, SapDrop } from './SapDrop'

const PLACEHOLDERS: Record<SapGiftReason, string> = {
  conseil: 'Merci pour ton conseil !',
  bouture: 'Merci pour la bouture !',
  jardin: 'Ton jardin donne envie !',
  aide: 'Merci pour le coup de main !',
}

interface Quota {
  giftsLeft: number
  giftsPerWeek: number
}

/**
 * « Offrir une goutte » — le bouton et sa boîte, comme la feuille de l'app
 * mobile (`components/sap/GiftSheet.tsx`).
 *
 * Les gouttes restantes sont lues à l'ouverture, pas au rendu de la page :
 * un fil de vingt publications n'a pas à demander vingt fois le même compteur.
 * Plus de gouttes : la boîte l'explique et le bouton se désactive avant que le
 * serveur ne refuse.
 */
export function GiftButton({
  handle,
  postId,
  variant = 'chip',
}: {
  handle: string
  postId?: string
  /** `chip` sous une publication, `button` sur un profil. */
  variant?: 'chip' | 'button'
}) {
  const [open, setOpen] = useState(false)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [reason, setReason] = useState<SapGiftReason>(postId ? 'jardin' : 'conseil')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<Quota | null>(null)
  const [pending, startTransition] = useTransition()
  const messageId = useId()

  function openDialog() {
    setOpen(true)
    setSent(null)
    setError(null)
    startTransition(async () => {
      const result = await getGiftQuotaAction()
      if (result.ok) setQuota(result.data)
      else setError(result.error)
    })
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await giveSapDropAction({
        handle,
        reason,
        message: message.trim() || null,
        postId: postId ?? null,
      })
      if (result.ok) {
        const next = { giftsLeft: result.data.giftsLeft, giftsPerWeek: quota?.giftsPerWeek ?? SAP_GIFTS_PER_WEEK }
        setQuota(next)
        setSent(next)
        setMessage('')
        return
      }
      // Les gouttes sont parties ailleurs entre-temps : on aligne le compteur.
      if (result.code === 'QUOTA_EXCEEDED') setQuota((current) => current && { ...current, giftsLeft: 0 })
      setError(result.error)
    })
  }

  const perWeek = quota?.giftsPerWeek ?? SAP_GIFTS_PER_WEEK
  const left = quota?.giftsLeft ?? perWeek

  return (
    <>
      {variant === 'chip' ? (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-lime/30 px-3 font-raleway text-sm font-bold text-forest transition-colors hover:bg-lime/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          <SapDrop size={18} veins={false} />
          Offrir une goutte
        </button>
      ) : (
        <Button variant="outline" onClick={openDialog} className="gap-2">
          <SapDrop size={20} veins={false} />
          Offrir une goutte
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center" role="status">
              <SapDrop size={56} />
              <DialogTitle className="font-poppins text-xl font-bold text-forest">
                Goutte envoyée à {handle}
              </DialogTitle>
              <DialogDescription className="font-raleway text-forest-light">
                {handle} verra ton merci « {SAP_GIFT_REASON_LABELS[reason].toLowerCase()} » dans ses
                notifications.{' '}
                {sent.giftsLeft > 0
                  ? `Il te reste ${sent.giftsLeft} goutte${sent.giftsLeft > 1 ? 's' : ''} cette semaine.`
                  : 'C’était ta dernière goutte de la semaine.'}
              </DialogDescription>
              <Button variant="forest" size="lg" className="w-full" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime font-poppins text-lg font-bold text-forest">
                  {handle.charAt(0).toUpperCase()}
                  <SapDrop size={24} className="absolute -bottom-1 -right-1.5" />
                </span>
                <div>
                  <DialogTitle className="font-poppins text-lg font-bold text-forest">
                    Offrir une goutte à {handle}
                  </DialogTitle>
                  <DialogDescription className="font-raleway text-sm text-forest/60">
                    Un merci en plus : ta propre sève ne baisse pas.
                  </DialogDescription>
                </div>
              </div>

              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 font-raleway text-sm font-bold text-forest">Pour quoi ?</legend>
                <div className="flex flex-wrap gap-2">
                  {SAP_GIFT_REASONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={reason === value}
                      onClick={() => setReason(value)}
                      className={cn(
                        'min-h-[44px] rounded-full border-2 border-forest px-4 font-raleway text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
                        reason === value ? 'bg-forest text-white' : 'bg-white text-forest hover:bg-sand',
                      )}
                    >
                      {SAP_GIFT_REASON_LABELS[value]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={messageId} className="font-raleway text-sm font-bold text-forest">
                  Un petit mot <span className="font-medium text-forest/60">(facultatif)</span>
                </label>
                <input
                  id={messageId}
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={SAP_GIFT_MESSAGE_MAX_LENGTH}
                  placeholder={PLACEHOLDERS[reason]}
                  className="h-12 rounded-xl border border-forest/20 bg-white px-3.5 font-raleway text-forest placeholder:text-forest/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
                />
              </div>

              <p className="flex items-center gap-2.5 font-raleway text-sm text-forest/60">
                <GiftDrops left={left} perWeek={perWeek} />
                {left === 0
                  ? 'Tu as offert tes gouttes de la semaine — elles reviennent lundi.'
                  : `Il te reste ${left} goutte${left > 1 ? 's' : ''} à offrir cette semaine`}
              </p>

              {error ? (
                <p role="alert" className="font-raleway text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button
                  variant="forest"
                  size="lg"
                  onClick={submit}
                  disabled={pending || left === 0 || quota === null}
                >
                  {pending && quota !== null ? 'Envoi…' : 'Offrir une goutte'}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
