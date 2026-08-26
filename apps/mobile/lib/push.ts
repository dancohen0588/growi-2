import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

import { api } from '@/lib/api'

/**
 * Notifications push — permission, jeton de l'appareil, canal Android.
 *
 * Le serveur fait déjà tout le reste : `push.service.ts` compose les rappels du
 * matin et les envoie à l'API Expo. Ce module ne s'occupe que de lui faire
 * connaître l'appareil, et de l'oublier à la déconnexion.
 *
 * Rien ici ne lève : une notification qu'on n'a pas pu enregistrer est un
 * agrément en moins, jamais une raison d'interrompre l'utilisateur. La
 * tentative est refaite à chaque ouverture de l'app, et la route
 * `/me/push-tokens` est idempotente.
 */

/**
 * Affichage quand l'app est déjà ouverte.
 *
 * Posé au chargement du module, avant qu'une notification puisse arriver.
 * Sans son, volontairement : le rappel du matin n'a rien d'urgent, et une
 * bannière suffit à le porter. Le badge est posé par le serveur ; on ne le
 * recompte pas ici.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

/**
 * Ce que l'appareil autorise.
 *
 * `unsupported` couvre le simulateur et l'émulateur, qui n'ont pas d'accès aux
 * services de notification : leur demander la permission ne mènerait nulle
 * part. C'est un état à part, pas un refus.
 */
export type PushState = 'unsupported' | 'granted' | 'denied' | 'undetermined'

export interface PushRegistration {
  state: PushState
  /** Le serveur connaît-il cet appareil ? Faux si le réseau a manqué. */
  registered: boolean
}

/** Jeton du moment, retenu pour pouvoir le retirer à la déconnexion. */
let currentToken: string | null = null

/** Identifiant du projet EAS, que le service Expo exige pour émettre un jeton. */
function easProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId
  return typeof fromConfig === 'string' ? fromConfig : undefined
}

/**
 * Le canal porte le nom qu'Android affichera dans ses réglages.
 *
 * Sans canal déclaré, Android range les notifications dans un « Divers »
 * anonyme — et l'utilisateur qui veut couper les rappels coupe alors tout.
 * `defaultChannel` d'`app.json` désigne ce canal auprès de FCM.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Rappels du jardin',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#B4DD7F',
  })
}

/** État actuel, sans rien demander à l'utilisateur. */
export async function getPushState(): Promise<PushState> {
  if (!Device.isDevice) return 'unsupported'

  try {
    const { status } = await Notifications.getPermissionsAsync()
    return status
  } catch {
    return 'undetermined'
  }
}

/**
 * Enregistre cet appareil auprès de Growi.
 *
 * @param request demander la permission si elle n'a jamais été posée. iOS ne
 * laisse poser la question qu'une fois : passé un refus, seuls les réglages du
 * téléphone peuvent revenir dessus, d'où `canAskAgain`.
 */
export async function registerDeviceForPush(request = false): Promise<PushRegistration> {
  if (!Device.isDevice) return { state: 'unsupported', registered: false }

  let state: PushState
  try {
    const permission = await Notifications.getPermissionsAsync()
    state = permission.status

    if (state !== 'granted' && request && permission.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync()
      state = asked.status
    }
  } catch {
    return { state: 'undetermined', registered: false }
  }

  if (state !== 'granted') return { state, registered: false }

  try {
    await ensureAndroidChannel()

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId(),
    })

    await api.me.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    })

    // De quoi viser cet appareil depuis expo.dev/notifications pendant la mise
    // au point. Le jeton n'est un secret que très relativement — il ne permet
    // que d'écrire à l'appareil — mais il n'a rien à faire dans un build public.
    if (__DEV__) console.log('[push] jeton de cet appareil :', token)

    currentToken = token
    return { state, registered: true }
  } catch (error) {
    // Réseau absent, service Expo indisponible, jeton refusé : la permission
    // est acquise, seul l'enregistrement a manqué. La prochaine ouverture
    // réessaiera.
    console.warn('[push] enregistrement impossible', error)
    return { state, registered: false }
  }
}

/**
 * Retire cet appareil du compte, à la déconnexion.
 *
 * À appeler tant que les jetons d'accès sont encore valides. Une défaillance
 * est passée sous silence : on ne retient personne à cause d'un appel qui n'a
 * pas abouti — le serveur oubliera de toute façon le jeton dès qu'Expo le
 * déclarera mort.
 */
export async function forgetDeviceForPush(): Promise<void> {
  const token = currentToken
  currentToken = null

  if (!token) return

  try {
    await api.me.unregisterPushToken(token)
  } catch (error) {
    console.warn('[push] désenregistrement impossible', error)
  }
}

/** Efface la pastille de l'icône — ce qui était en attente a été vu. */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0)
  } catch {
    // Android sans lanceur compatible, entre autres : sans conséquence.
  }
}
