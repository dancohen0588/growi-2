'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { toggleBlockAction, toggleFollowAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'

/**
 * « Suivre » et « Bloquer », sur un profil public.
 *
 * Le suivi bascule immédiatement — attendre le serveur pour ce bouton se
 * verrait — et revient en arrière si l'appel échoue. Le blocage, lui, attend :
 * afficher une protection avant de la savoir posée donnerait un faux
 * sentiment de sécurité.
 */
export function FollowButton({
  handle,
  isFollowing,
  isBlocked,
  followerCount,
}: {
  handle: string
  /** `null` pour un lecteur anonyme : le bouton renvoie alors à la connexion. */
  isFollowing: boolean | null
  isBlocked: boolean | null
  followerCount: number
}) {
  const [following, setFollowing] = useState(isFollowing ?? false)
  const [count, setCount] = useState(followerCount)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (isFollowing === null) {
    return (
      <a
        href="/login"
        className="inline-block rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
      >
        Se connecter pour suivre
      </a>
    )
  }

  if (isBlocked) {
    return (
      <div className="space-y-2">
        <p className="font-raleway text-sm text-forest/60">Tu as bloqué ce compte.</p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await toggleBlockAction(handle, false)
              if (!result.ok) setError(result.error)
            })
          }
          className="rounded-lg border border-forest/15 bg-white px-4 py-2 font-raleway text-sm text-forest hover:bg-sand disabled:opacity-50"
        >
          Débloquer
        </button>
        {error && (
          <p role="alert" className="font-raleway text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    )
  }

  function toggle() {
    const next = !following
    setFollowing(next)
    setCount((value) => value + (next ? 1 : -1))

    startTransition(async () => {
      const result = await toggleFollowAction(handle, next)
      if (!result.ok) {
        setFollowing(!next)
        setCount((value) => value + (next ? -1 : 1))
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={following}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-raleway text-sm font-semibold transition-colors disabled:opacity-50',
            following
              ? 'border border-forest/15 bg-white text-forest hover:bg-sand'
              : 'bg-lime text-forest hover:bg-lime/80',
          )}
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {following ? 'Abonné·e' : 'Suivre'}
        </button>

        <span className="font-raleway text-sm text-forest/60">
          {count} abonné{count > 1 ? 's' : ''}
        </span>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleBlockAction(handle, true)
            if (!result.ok) setError(result.error)
          })
        }
        className="font-raleway text-xs text-forest/40 underline hover:text-red-700 disabled:opacity-50"
      >
        Bloquer ce compte
      </button>

      {error && (
        <p role="alert" className="font-raleway text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
