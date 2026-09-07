'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { CommunitySettings } from '@growi/shared'
import {
  BIO_MAX_LENGTH,
  COMMUNITY_RADII_KM,
  COMMUNITY_RADIUS_LABELS,
  HANDLE_MAX_LENGTH,
} from '@growi/shared'

import { cn } from '@/lib/utils'

/**
 * Onglet « Profil public » de Mon compte.
 *
 * C'est le seul endroit du web où l'on rejoint la communauté ou la quitte —
 * le mobile a son écran d'activation, le web y met un onglet plutôt qu'une
 * page à part, parce que c'est un réglage de compte.
 *
 * Il parle à `/api/v1/community/me` comme le mobile, et non à une Server
 * Action : le contrat est déjà écrit, testé, et vaut pour les deux supports.
 */
export function CommunauteForm() {
  const [settings, setSettings] = useState<CommunitySettings | null>(null)
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let active = true

    fetch('/api/v1/community/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !payload?.data) return
        const data = payload.data as CommunitySettings
        setSettings(data)
        setHandle(data.handle ?? '')
        setBio(data.bio ?? '')
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function patch(body: Record<string, unknown>, success: string) {
    startTransition(async () => {
      const response = await fetch('/api/v1/community/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)

      if (response.ok && payload?.data) {
        setSettings(payload.data as CommunitySettings)
        setFeedback({ ok: true, text: success })
      } else {
        setFeedback({
          ok: false,
          text: payload?.error?.message ?? 'Une erreur est survenue. Réessaie dans un instant.',
        })
      }
    })
  }

  if (loading) {
    return <p className="font-raleway text-sm text-forest/50">Chargement…</p>
  }

  if (!settings) {
    return (
      <p role="alert" className="font-raleway text-sm text-red-700">
        Impossible de charger tes réglages de communauté.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {!settings.hasLocation && (
        <p
          role="status"
          className="rounded-2xl border border-sun/40 bg-sun/10 p-4 font-raleway text-sm text-forest/80"
        >
          <strong>Indique d’abord la ville de ton jardin</strong>, dans l’onglet Profil. La
          communauté est locale : sans position, ton profil serait activé mais invisible.
        </p>
      )}

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="font-raleway text-sm font-medium text-forest">Pseudo</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            maxLength={HANDLE_MAX_LENGTH}
            autoComplete="off"
            placeholder="pierre_potager"
            className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
          />
          <span className="block font-raleway text-xs text-forest/50">
            Lettres sans accent, chiffres et « _ ». C’est sous ce nom que les jardiniers du coin
            te verront — ton prénom et ton nom restent privés.
          </span>
        </label>

        <label className="block space-y-1">
          <span className="font-raleway text-sm font-medium text-forest">
            Présentation (facultatif)
          </span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={BIO_MAX_LENGTH}
            rows={3}
            placeholder="Potager de 100 m², beaucoup de tomates."
            className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-forest"
          />
          <span className="block font-raleway text-xs text-forest/50">
            {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </label>

        <button
          type="button"
          disabled={pending || !handle.trim()}
          onClick={() =>
            patch(
              { enabled: true, handle: handle.trim().toLowerCase(), bio: bio.trim() || null },
              settings.enabled ? 'Profil mis à jour.' : 'Te voilà dans la communauté 🌱',
            )
          }
          className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {settings.enabled ? 'Enregistrer' : 'Activer mon profil public'}
        </button>
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-2">
            <p className="font-raleway text-sm font-medium text-forest">Autour de moi</p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_RADII_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  disabled={pending}
                  onClick={() => patch({ radiusKm: km }, 'Rayon enregistré.')}
                  aria-pressed={settings.radiusKm === km}
                  className={cn(
                    'rounded-lg border px-4 py-2 font-raleway text-sm transition-colors disabled:opacity-50',
                    settings.radiusKm === km
                      ? 'border-forest bg-lime font-medium text-forest'
                      : 'border-forest/15 bg-white text-forest/60 hover:bg-sand',
                  )}
                >
                  {COMMUNITY_RADIUS_LABELS[km]}
                </button>
              ))}
            </div>
            <p className="font-raleway text-xs text-forest/50">
              La distance jusqu’à laquelle tu vois les publications et les annonces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-forest/10 pt-4">
            <Link
              href={`/u/${settings.handle}`}
              className="font-raleway text-sm text-forest underline hover:no-underline"
            >
              Voir mon profil public
            </Link>

            <button
              type="button"
              disabled={pending}
              onClick={() => patch({ enabled: false }, 'Tu as quitté la communauté.')}
              className="font-raleway text-sm text-forest/50 underline hover:text-red-700 disabled:opacity-50"
            >
              Quitter la communauté
            </button>
          </div>

          <p className="font-raleway text-xs text-forest/50">
            Quitter la communauté masque ton profil et tes publications. Rien n’est supprimé : tu
            peux revenir quand tu veux.
          </p>
        </>
      )}

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
