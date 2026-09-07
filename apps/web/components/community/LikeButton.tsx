'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'

import { toggleLikeAction } from '@/app/actions/community'
import { cn } from '@/lib/utils'

/**
 * Le cœur d'une publication.
 *
 * Bascule immédiate : attendre le serveur pour un cœur se verrait. Un échec le
 * remet dans sa position d'avant, compteur compris — c'est la seule façon de
 * ne pas mentir sur un chiffre qui reste affiché.
 *
 * `likedByMe` vaut `null` pour un lecteur anonyme : le bouton devient alors un
 * lien vers la connexion, plutôt qu'un cœur qui ne fait rien.
 */
export function LikeButton({
  postId,
  likedByMe,
  likeCount,
}: {
  postId: string
  likedByMe: boolean | null
  likeCount: number
}) {
  const [liked, setLiked] = useState(likedByMe ?? false)
  const [count, setCount] = useState(likeCount)
  const [pending, startTransition] = useTransition()

  if (likedByMe === null) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-1.5 font-raleway text-sm text-forest/60 hover:text-forest"
      >
        <Heart size={18} aria-hidden />
        {count}
      </a>
    )
  }

  function toggle() {
    const next = !liked
    setLiked(next)
    setCount((value) => value + (next ? 1 : -1))

    startTransition(async () => {
      const result = await toggleLikeAction(postId, next)
      if (!result.ok) {
        setLiked(!next)
        setCount((value) => value + (next ? -1 : 1))
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Retirer mon cœur' : 'Aimer'}
      className={cn(
        'inline-flex items-center gap-1.5 font-raleway text-sm transition-colors disabled:opacity-60',
        liked ? 'text-forest' : 'text-forest/60 hover:text-forest',
      )}
    >
      <Heart size={18} aria-hidden fill={liked ? '#B4DD7F' : 'transparent'} />
      {count}
    </button>
  )
}
