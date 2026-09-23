'use client'

/**
 * PostHog côté navigateur.
 *
 * Ce module est le **seul** endroit du web qui connaisse posthog-js : les
 * écrans passent par `useTrack()`, typé sur le catalogue de `@growi/shared`.
 * Un nom d'événement inventé sur place ne compile pas.
 *
 * Cinq choix qui ne se devinent pas :
 *
 * 1. **Rien avant le consentement.** Le provider n'est monté que dans l'espace
 *    connecté (`app/dashboard/layout.tsx`), et `posthog.init` n'y est appelé
 *    qu'une fois que le compte a dit oui. Le site public ne charge rien, ne
 *    dépose rien : c'est ce qui rend vraie la phrase « Growi dépose un seul
 *    cookie », et ce qui dispense de bandeau. Ailleurs, `useTrack()` tombe sur
 *    le contexte par défaut — un émetteur muet.
 * 2. **Rien ne part hors production et preview**, ni sans clé. En local, le
 *    provider monte quand même mais l'émetteur est muet : le code appelant
 *    n'a jamais à se demander si l'analyse est configurée.
 * 3. **Aucun cookie, pas d'enregistrement de session.** L'identifiant vit dans
 *    le stockage local, qu'on vide au retrait de l'accord. Le rejeu d'écran
 *    web n'apportait rien à ce stade, et c'est la donnée la plus sensible.
 * 4. **`autocapture` est désactivé.** On ne veut que les faits du catalogue.
 *    L'autocapture remplirait le projet de clics sur des `div` qu'on ne
 *    saurait pas relire, et brouillerait le quota du plan gratuit.
 * 5. **`person_profiles: 'identified_only'`** — rien n'est rattaché à une
 *    personne avant `identify`, qui n'a lieu qu'avec l'accord du compte.
 */

import type { GrowiEventName, GrowiEventProps } from '@growi/shared'
import { createNoopEmitter, createSafeEmitter, type Emitter } from '@growi/shared'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { analyticsEnabled } from '@/lib/analytics/enabled'
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

/** Démarre PostHog — à n'appeler qu'avec l'accord du compte. */
function startPostHog(): boolean {
  if (!KEY || !analyticsEnabled()) return false

  if (started) {
    // Retiré puis redonné dans la même page : l'instance est déjà là, il
    // suffit de rouvrir la capture — sans l'événement `$opt_in`, qui ne dit
    // rien que `analyticsConsentAt` ne porte déjà.
    posthog.opt_in_capturing({ captureEventName: false })
    return true
  }

  const environment = resolveEnvironment()

  posthog.init(KEY, {
    api_host: INGEST_PATH,
    ui_host: UI_HOST,
    // Les vues de page restent utiles ; le reste de la capture automatique, non.
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    disable_session_recording: true,
    // On n'initialise qu'après le oui : pas d'état de refus à persister.
    opt_out_capturing_by_default: false,
  })

  // Un retrait passé laisse un drapeau de refus (`__ph_opt_in_out_…`, que la
  // purge épargne : il n'identifie personne). Relu à l'init, il ferait taire
  // un oui redonné depuis — c'est le compte qui fait foi, pas ce drapeau.
  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing({ captureEventName: false })
  }

  posthog.register({
    surface: 'web',
    app_version: resolveRelease()?.slice(0, 7) ?? 'dev',
    platform: 'web',
    environment,
  })

  started = true
  return true
}

/** Arrête la capture d'une instance démarrée. Sans effet sinon. */
function stopPostHog(): void {
  if (!started) return
  try {
    posthog.opt_out_capturing()
  } catch {
    // Le retrait vaut surtout par l'émetteur muet et la purge qui suivent.
  }
}

/** Vrai pour le nom d'une clé ou d'un cookie écrit par PostHog. */
function isPostHogName(name: string): boolean {
  return name.startsWith('ph_')
}

/** Expire les cookies `ph_*` — héritage de l'ancienne configuration. */
function purgePostHogCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim()
    if (name && isPostHogName(name)) {
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}

/**
 * Efface ce que PostHog a laissé sur le terminal : clés `ph_*` du stockage
 * local et cookies `ph_*`.
 *
 * Appelée au retrait de l'accord, et à chaque chargement du dashboard d'un
 * compte qui n'a pas dit oui — ce qui nettoie aussi les testeurs passés par
 * l'ancienne configuration (cookie + stockage, avant consentement).
 * Idempotente, sans réseau, ne lève jamais.
 */
export function purgeLocalPostHogState(): void {
  try {
    purgePostHogCookies()

    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && isPostHogName(key)) keys.push(key)
    }
    for (const key of keys) window.localStorage.removeItem(key)
  } catch {
    // Stockage indisponible (navigation privée stricte) : rien à effacer.
  }
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

const NOOP_EMITTER = createNoopEmitter()

/**
 * Applique un choix du compte et rend l'émetteur à utiliser.
 *
 * - **oui** : PostHog démarre (une fois par page) et l'émetteur réel prend le
 *   relais. Les anciens cookies `ph_*` sont expirés au passage : le stockage
 *   local suffit désormais, et la phrase « un seul cookie » doit rester vraie.
 * - **jamais demandé ou non** : l'émetteur est muet, l'instance éventuelle
 *   cesse de capturer, et le terminal est nettoyé. Pas de `reset()` : il
 *   réécrirait un identifiant anonyme neuf dans le stockage qu'on vient de
 *   vider.
 *
 * Hors de React pour être testée sans monter de composant.
 */
export function applyConsent(consent: boolean | null): Emitter {
  if (consent === true) {
    purgePostHogCookies()
    return startPostHog() ? createBrowserEmitter() : NOOP_EMITTER
  }

  stopPostHog()
  purgeLocalPostHogState()
  return NOOP_EMITTER
}

/** Oublie l'instance démarrée. Réservé aux tests. */
export function resetPostHogStateForTests(): void {
  started = false
}

const EmitterContext = createContext<Emitter>(NOOP_EMITTER)

type ConsentContextValue = {
  /** `null` tant que la question n'a pas reçu de réponse. */
  consent: boolean | null
  /** Applique un choix sur-le-champ, avant même que le serveur l'ait écrit. */
  setConsent: (consent: boolean) => void
}

/**
 * Hors du dashboard, pas de provider : le choix vaut refus, et le modifier
 * n'a pas de sens.
 */
const ConsentContext = createContext<ConsentContextValue>({
  consent: false,
  setConsent: () => {},
})

/**
 * Monté dans `app/dashboard/layout.tsx`, qui lit le choix du compte en base.
 *
 * Le choix reçu du serveur est recopié dans un état local : la boîte de
 * consentement et l'interrupteur de l'onglet Confidentialité écrivent par
 * `/api/user/profile`, qui ne rejoue pas le layout. Sans cette copie, un oui
 * ne prendrait effet qu'au prochain chargement complet.
 */
export function AnalyticsProvider({
  consent: serverConsent,
  children,
}: {
  consent: boolean | null
  children: ReactNode
}) {
  const [consent, setConsent] = useState<boolean | null>(serverConsent)
  const [emitter, setEmitter] = useState<Emitter>(NOOP_EMITTER)

  // Un rendu serveur plus récent (autre onglet, `router.refresh`) fait foi.
  useEffect(() => {
    setConsent(serverConsent)
  }, [serverConsent])

  useEffect(() => {
    setEmitter(applyConsent(consent))
  }, [consent])

  const consentValue = useMemo<ConsentContextValue>(
    () => ({ consent, setConsent }),
    [consent],
  )

  return (
    <ConsentContext.Provider value={consentValue}>
      <EmitterContext.Provider value={emitter}>
        <PostHogReactProvider client={posthog}>
          <AnalyticsIdentity consent={consent} />
          {children}
        </PostHogReactProvider>
      </EmitterContext.Provider>
    </ConsentContext.Provider>
  )
}

/**
 * Rattache la session au profil PostHog — seulement avec l'accord du compte —
 * et l'en détache à la déconnexion.
 *
 * `identify` est idempotent côté SDK, mais on garde le dernier identifiant
 * transmis : sans cela, chaque rendu du layout renverrait un `$identify`.
 */
function AnalyticsIdentity({ consent }: { consent: boolean | null }) {
  const { data: session, status } = useSession()
  const emitter = useAnalytics()
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    const userId = session?.user?.id ?? null

    if (consent !== true) {
      // L'émetteur est muet : on oublie seulement qu'on a identifié, pour que
      // le prochain oui identifie à nouveau.
      lastUserId.current = null
      return
    }

    if (userId && userId !== lastUserId.current) {
      emitter.identify(userId)
      lastUserId.current = userId
      return
    }

    if (!userId && lastUserId.current) {
      emitter.reset()
      lastUserId.current = null
    }
  }, [consent, emitter, session?.user?.id, status])

  return null
}

/** L'émetteur brut — pour identifier, réinitialiser, ou sortir de l'analyse. */
export function useAnalytics(): Emitter {
  return useContext(EmitterContext)
}

/** Le choix du compte quant à la mesure d'usage, et de quoi l'appliquer. */
export function useAnalyticsConsent(): ConsentContextValue {
  return useContext(ConsentContext)
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
