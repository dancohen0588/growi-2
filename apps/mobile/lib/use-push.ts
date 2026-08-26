import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'

import { clearBadge, registerDeviceForPush } from '@/lib/push'
import { useProfile } from '@/lib/queries/me'

/**
 * Branchement des notifications, monté une fois par session connectée.
 *
 * Trois choses, qui n'ont de sens qu'une fois l'utilisateur identifié :
 * enregistrer l'appareil, effacer la pastille quand il revient dans l'app, et
 * ouvrir le bon écran quand il tape une notification.
 */

/** Ce que le serveur peut demander d'ouvrir (`data.screen` du message). */
const SCREENS = {
  calendrier: '/(tabs)/calendrier',
} as const

type ScreenKey = keyof typeof SCREENS

function screenRoute(data: unknown): (typeof SCREENS)[ScreenKey] | null {
  if (typeof data !== 'object' || data === null) return null

  const screen = (data as { screen?: unknown }).screen
  if (typeof screen !== 'string') return null

  return screen in SCREENS ? SCREENS[screen as ScreenKey] : null
}

/**
 * @param enabled faux tant que la session n'est pas établie — l'enregistrement
 * du jeton est un appel authentifié, et rien ne doit partir avant.
 */
export function usePushNotifications(enabled: boolean): void {
  const router = useRouter()

  /*
   * Le canal choisi par l'utilisateur commande la suite : demander la
   * permission du téléphone à quelqu'un qui a déjà coupé ses notifications
   * dans Growi, ce serait lui reposer une question à laquelle il a répondu.
   * La requête est celle de l'onglet Profil, servie par le cache.
   */
  const channel = useProfile({ enabled }).data?.alertConfig.channel
  const wantsPush = channel === undefined ? null : channel === 'push' || channel === 'both'

  useEffect(() => {
    if (!enabled || wantsPush === null) return

    /*
     * On enregistre l'appareil dans les deux cas — un jeton connu du serveur
     * est inerte tant que le canal est coupé, mais il rend la déconnexion
     * propre et le rallumage immédiat. Seule la *demande* de permission suit
     * le choix de l'utilisateur.
     *
     * iOS et Android ne présentent leur fenêtre qu'une fois : passé un refus,
     * `canAskAgain` empêche toute relance, et c'est l'onglet Profil qui
     * renvoie vers les réglages du téléphone.
     */
    void registerDeviceForPush(wantsPush)
  }, [enabled, wantsPush])

  // La pastille dit ce qui attend d'être vu : revenir dans l'app l'acquitte.
  useEffect(() => {
    if (!enabled) return

    void clearBadge()

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void clearBadge()
    })

    return () => subscription.remove()
  }, [enabled])

  /*
   * `useLastNotificationResponse` restitue aussi la notification qui a
   * démarré l'app depuis un état fermé — sans elle, taper un rappel sur un
   * téléphone au repos ouvrirait l'accueil.
   */
  const response = Notifications.useLastNotificationResponse()
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !response) return

    // La même réponse est restituée à chaque rendu : sans ce garde-fou, on
    // renaviguerait par-dessus l'écran que l'utilisateur consulte.
    const id = response.notification.request.identifier
    if (handled.current === id) return
    handled.current = id

    const route = screenRoute(response.notification.request.content.data)
    if (route) router.navigate(route)
  }, [enabled, response, router])
}
