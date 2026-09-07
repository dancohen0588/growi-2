'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { expressInterestAction, updateListingAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'

/**
 * Les gestes d'une annonce, côté web.
 *
 * Deux publics dans un seul composant : l'auteur y gère le cycle de vie de son
 * annonce, l'intéressé n'y trouve qu'un bouton. Les séparer aurait dupliqué la
 * même mécanique d'appel et de retour d'erreur.
 */

function Button({
  label,
  onClick,
  pending,
  variant = 'outline',
}: {
  label: string
  onClick: () => void
  pending: boolean
  variant?: 'primary' | 'outline'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-raleway text-sm font-semibold transition-colors disabled:opacity-50',
        variant === 'primary'
          ? 'bg-lime text-forest hover:bg-lime/80'
          : 'border border-forest/15 bg-white text-forest hover:bg-sand',
      )}
    >
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {label}
    </button>
  )
}

export function ListingActions({
  listingId,
  status,
  isMine,
  myThreadId,
}: {
  listingId: string
  status: string
  isMine: boolean
  /** Le fil déjà ouvert par ce lecteur, s'il y en a un. */
  myThreadId: string | null
}) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function patch(
    input: { status?: 'active' | 'reserved' | 'done'; extend?: boolean },
  ) {
    startTransition(async () => {
      const result = await updateListingAction(listingId, input)
      setFeedback(
        result.ok
          ? { ok: true, text: result.message ?? 'Annonce mise à jour.' }
          : { ok: false, text: result.error },
      )
    })
  }

  if (isMine) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          {status === 'active' && (
            <Button
              label="Marquer comme réservée"
              pending={pending}
              onClick={() => patch({ status: 'reserved' })}
            />
          )}
          {status === 'reserved' && (
            <>
              <Button
                label="Marquer comme terminée"
                variant="primary"
                pending={pending}
                onClick={() => patch({ status: 'done' })}
              />
              <Button
                label="Remettre en ligne"
                pending={pending}
                onClick={() => patch({ status: 'active' })}
              />
            </>
          )}
          {status === 'expired' && (
            <Button
              label="Prolonger de 60 jours"
              variant="primary"
              pending={pending}
              onClick={() => patch({ extend: true })}
            />
          )}
        </div>

        {feedback && (
          <p
            role="status"
            className={cn('font-raleway text-sm', feedback.ok ? 'text-forest/70' : 'text-red-700')}
          >
            {feedback.text}
          </p>
        )}
      </div>
    )
  }

  if (myThreadId) {
    return (
      <Button
        label="Reprendre la discussion"
        variant="primary"
        pending={pending}
        onClick={() => router.push(`/dashboard/communaute/messages/${myThreadId}`)}
      />
    )
  }

  return (
    <div className="space-y-3">
      <Button
        label={status === 'active' ? 'Je suis intéressé' : 'Annonce indisponible'}
        variant="primary"
        pending={pending || status !== 'active'}
        onClick={() =>
          startTransition(async () => {
            const result = await expressInterestAction(listingId)
            if (result.ok) {
              // Le service rouvre le fil existant s'il y en a un : dans les deux
              // cas, la bonne destination est la liste des messages.
              router.push('/dashboard/communaute/messages')
            } else {
              setFeedback({ ok: false, text: result.error })
            }
          })
        }
      />

      {feedback && (
        <p role="alert" className="font-raleway text-sm text-red-700">
          {feedback.text}
        </p>
      )}
    </div>
  )
}
