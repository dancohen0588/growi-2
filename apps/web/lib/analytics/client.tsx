'use client'

/**
 * PostHog côté navigateur.
 *
 * Ce module est le **seul** endroit du web qui connaisse posthog-js : les
 * écrans passent par `useTrack()`, typé sur le catalogue de `@growi/shared`.
 * Un nom d'événement inventé sur place ne compile pas.
 *
 * Quatre choix qui ne se devinent pas :
 *
 * 1. **Rien ne part hors production et preview**, ni sans clé. En local, le
 *    provider monte quand même mais l'émetteur est muet : le code appelant
 *    n'a jamais à se demander si l'analyse est configurée.
 * 2. **`autocapture` est désactivé.** On ne veut que les faits du catalogue.
 *    L'autocapture remplirait le projet de clics sur des `div` qu'on ne
 *    saurait pas relire, et brouillerait le quota du plan gratuit.
 * 3. **Les enregistrements de session masquent tout le texte.** Un jardin,
 *    une adresse, un message : rien de tout cela n'a à être rejoué.
 * 4. **`person_profiles: 'identified_only'`** — un visiteur anonyme du site
 *    marketing ne crée pas de profil de personne.
 */

import type { GrowiEventName, GrowiEventProps } from '@growi/shared'
import { createNoopEmitter, createSafeEmitter, type Emitter } from '@growi/shared'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react'
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

import { resolveEnvironment, resolveRelease } from '@/lib/observability/sentry-options'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

/**
 * L'ingestion passe par notre domaine (`/ingest`, réécrit dans
 * `next.config.mjs`) : appelée directement, `eu.i.posthog.com` est bloquée par
 * les bloqueurs de publicité, c'est-à-dire précisément chez les utilisateurs
 * les plus outillés.
 */
const INGEST_PATH = '/ingest'

/** Interface d'affichage, pour que les liens « voir dans PostHog » aboutissent. */
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com'

let started = false

function startPostHog(): boolean {
  const environment = resolveEnvironment()
  if (!KEY || environment === 'development') return false
  if (started) return true

  posthog.init(KEY, {
    api_host: INGEST_PATH,
    ui_host: UI_HOST,
    // Les vues de page restent utiles (le site marketing en vit) ; le reste de
    // la capture automatique, non.
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      // Tout le texte, pas seulement les champs : une publication de la
      // communauté ou le nom d'un jardin n'ont pas à être rejoués.
      maskTextSelector: '*',
    },
  })

  posthog.register({
    surface: 'web',
    app_version: resolveRelease()?.slice(0, 7) ?? 'dev',
    platform: 'web',
    environment,
  })

  started = true
  return true
}

function createBrowserEmitter(): Emitter {
  return createSafeEmitter({
    track: (name, props) => posthog.capture(name, props),
    identify: (userId) => posthog.identify(userId),
    reset: () => posthog.reset(),
    setPersonProperties: (properties) => posthog.setPersonProperties(properties),
    optOut: () => posthog.opt_out_capturing(),
    optIn: () => posthog.opt_in_capturing(),
  })
}

const EmitterContext = createContext<Emitter>(createNoopEmitter())

/**
 * Monté dans `app/layout.tsx`, à l'intérieur du `SessionProvider` : c'est de
 * la session que vient l'identifiant, et il faut donc pouvoir la lire.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const emitter = useMemo<Emitter>(
    () => (startPostHog() ? createBrowserEmitter() : createNoopEmitter()),
    [],
  )

  return (
    <EmitterContext.Provider value={emitter}>
      <PostHogReactProvider client={posthog}>
        <AnalyticsIdentity />
        {children}
      </PostHogReactProvider>
    </EmitterContext.Provider>
  )
}

/**
 * Rattache la session au profil PostHog, et l'en détache à la déconnexion.
 *
 * `identify` est idempotent côté SDK, mais on garde le dernier identifiant
 * transmis : sans cela, chaque rendu du layout renverrait un `$identify`.
 */
function AnalyticsIdentity() {
  const { data: session, status } = useSession()
  const emitter = useAnalytics()
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    const userId = session?.user?.id ?? null

    if (userId && userId !== lastUserId.current) {
      emitter.identify(userId)
      lastUserId.current = userId
      return
    }

    if (!userId && lastUserId.current) {
      emitter.reset()
      lastUserId.current = null
    }
  }, [emitter, session?.user?.id, status])

  return null
}

/** L'émetteur brut — pour identifier, réinitialiser, ou sortir de l'analyse. */
export function useAnalytics(): Emitter {
  return useContext(EmitterContext)
}

/**
 * Émet un événement du catalogue.
 *
 * ```ts
 * const track = useTrack()
 * track('identify_result_accepted', { rank: 1 })
 * ```
 */
export function useTrack() {
  const emitter = useAnalytics()
  return useMemo(
    () =>
      <N extends GrowiEventName>(name: N, props: GrowiEventProps<N>): void => {
        emitter.track(name, props)
      },
    [emitter],
  )
}
