'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { UserProfile } from '@growi/shared'

import { useAnalytics } from '@/lib/analytics/client'

/**
 * Onglet « Confidentialité » de Mon compte.
 *
 * Un seul réglage, et c'est voulu : l'opposition à la mesure d'usage. Les
 * rapports de plantage ne s'y trouvent pas parce qu'ils ne se coupent pas —
 * ils ne portent rien de ce que l'utilisateur écrit, et sans eux un bug peut
 * rester des semaines à l'écran de quelqu'un sans que personne l'apprenne.
 * C'est dit dans le texte plutôt que caché.
 *
 * Le réglage vit sur le **compte** : refuser depuis le téléphone vaut aussi
 * ici, et inversement.
 */
export function ConfidentialiteForm({
  profile,
  updateProfile,
}: {
  profile: UserProfile
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>
}) {
  const analytics = useAnalytics()
  const [helping, setHelping] = useState(!profile.analyticsOptOut)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    // L'effet est immédiat sur ce navigateur, avant même la requête : mieux
    // vaut avoir cessé de mesurer pour rien que l'inverse.
    if (next) analytics.optIn()
    else analytics.optOut()

    setHelping(next)
    setError(null)

    startTransition(async () => {
      const result = await updateProfile({ analyticsOptOut: !next })
      if (result.error) {
        setHelping(!next)
        setError(result.error)
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="font-poppins font-semibold text-forest">
            Aider à améliorer Growi
          </p>
          <p className="font-raleway text-sm text-forest/70">
            Aucune photo ni message n&apos;est transmis. Les rapports de plantage restent
            actifs pour corriger les bugs.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={helping}
          aria-label="Aider à améliorer Growi en partageant des statistiques d’usage"
          disabled={pending}
          onClick={() => toggle(!helping)}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            helping ? 'bg-lime' : 'bg-forest/20'
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              helping ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {pending && (
        <p className="flex items-center gap-2 font-raleway text-sm text-forest/60">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Enregistrement…
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-raleway text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="font-raleway text-sm text-forest/60">
        Le détail de ce qui est mesuré, et de ce qui ne l&apos;est jamais, est dans la{' '}
        <Link href="/confidentialite" className="underline hover:text-forest">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  )
}
