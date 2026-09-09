/**
 * Suivi des écrans.
 *
 * PostHog RN sait capturer les écrans tout seul, mais à partir de
 * react-navigation : sous expo-router, il rendrait des noms de routes
 * internes. On lui donne donc le chemin, **identifiants ôtés** — sans quoi
 * chaque fiche plante ferait son propre écran et aucun entonnoir ne tiendrait.
 */

import { normalizeApiPath } from '@growi/shared'
import { usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'

import { captureScreen } from '@/lib/analytics/posthog'

export function useScreenTracking(): void {
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    const screen = normalizeApiPath(pathname || '/')
    // Un même écran remonté deux fois fausserait le compte des vues : le
    // chemin change parfois sans que l'écran change (paramètres de requête).
    if (screen === last.current) return

    last.current = screen
    captureScreen(screen)
  }, [pathname])
}
