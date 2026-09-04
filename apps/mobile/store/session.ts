import { Platform } from 'react-native'
import { create } from 'zustand'
import { isApiError } from '@growi/api-client'
import type { SocialProvider } from '@growi/shared'

import { api, publicApi, setSessionLostHandler } from '@/lib/api'
import { clearTokens, getRefreshToken, saveTokens } from '@/lib/auth-storage'
import { hasSeenOnboarding } from '@/lib/onboarding-storage'
import { forgetDeviceForPush } from '@/lib/push'
import { requestAppleIdentity, requestGoogleIdentity } from '@/lib/social-auth'

/**
 * Session de l'utilisateur.
 *
 * `status` distingue trois moments : la restauration au démarrage, l'état
 * connecté et l'état déconnecté. L'écran de démarrage reste affiché tant qu'on
 * est en `restoring`, pour ne pas montrer brièvement le login à quelqu'un qui
 * a déjà une session valide.
 */
export type SessionStatus = 'restoring' | 'authenticated' | 'unauthenticated'

/**
 * Ce que l'app affiche de l'utilisateur connecté.
 *
 * Volontairement plus étroit que les types de l'API : la connexion renvoie un
 * `AuthUser`, la restauration un `UserProfile`, et aucun écran n'a besoin de
 * l'identifiant — l'API reconnaît l'utilisateur à son jeton.
 */
export interface SessionUser {
  email: string
  firstName: string | null
}

interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  /**
   * La présentation du premier lancement a déjà été vue sur cet appareil.
   * Vrai par défaut : tant que la restauration n'a rien lu, on n'affiche
   * jamais l'onboarding par erreur à quelqu'un qui l'a déjà passé.
   */
  onboardingSeen: boolean
  setOnboardingSeen: (seen: boolean) => void
  restore: () => Promise<void>
  signIn: (input: { email: string; password: string }) => Promise<void>
  signUp: (input: { firstName: string; email: string; password: string }) => Promise<void>
  /**
   * Connexion par Apple ou Google.
   * @returns `false` si l'utilisateur a refermé la feuille du fournisseur.
   */
  signInWith: (provider: SocialProvider) => Promise<boolean>
  signOut: () => Promise<void>
}

function toSessionUser(user: { email: string; firstName?: string | null }): SessionUser {
  return { email: user.email, firstName: user.firstName ?? null }
}

/** Identifie l'appareil dans la liste des sessions, sans rien collecter de personnel. */
function deviceInfo(): string {
  return `${Platform.OS} ${Platform.Version}`
}

export const useSession = create<SessionState>((set) => ({
  status: 'restoring',
  user: null,
  onboardingSeen: true,

  setOnboardingSeen: (seen) => set({ onboardingSeen: seen }),

  /**
   * Au démarrage : s'il existe un jeton, on vérifie qu'il vaut encore quelque
   * chose en demandant le profil. Le client rafraîchit tout seul si l'access
   * token a expiré ; s'il n'y parvient pas, `setSessionLostHandler` remet la
   * session à zéro.
   *
   * Le drapeau d'onboarding est lu en parallèle et posé avant de sortir de
   * `restoring` : l'aiguillage est ainsi connu au moment où l'écran de
   * démarrage se lève, sans qu'on aperçoive le login au passage.
   */
  restore: async () => {
    const [refreshToken, seen] = await Promise.all([getRefreshToken(), hasSeenOnboarding()])
    set({ onboardingSeen: seen })

    if (!refreshToken) {
      set({ status: 'unauthenticated', user: null })
      return
    }

    try {
      const profile = await api.me.get()
      set({
        status: 'authenticated',
        user: { email: profile.email, firstName: profile.firstName || null },
      })
    } catch {
      await clearTokens()
      set({ status: 'unauthenticated', user: null })
    }
  },

  signIn: async ({ email, password }) => {
    const tokens = await publicApi.auth.login({ email, password, deviceInfo: deviceInfo() })
    await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    set({ status: 'authenticated', user: toSessionUser(tokens.user) })
  },

  signUp: async ({ firstName, email, password }) => {
    const tokens = await publicApi.auth.register({
      firstName,
      email,
      password,
      deviceInfo: deviceInfo(),
    })
    await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    set({ status: 'authenticated', user: toSessionUser(tokens.user) })
  },

  /**
   * Le fournisseur remet un jeton d'identité ; c'est le serveur qui le
   * vérifie, crée le compte au besoin et ouvre la session. Il n'y a donc pas
   * d'inscription séparée : le premier passage vaut création.
   */
  signInWith: async (provider) => {
    const identity =
      provider === 'apple' ? await requestAppleIdentity() : await requestGoogleIdentity()

    if (!identity) return false

    const tokens = await publicApi.auth.social(provider, identity)
    await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    set({ status: 'authenticated', user: toSessionUser(tokens.user) })
    return true
  },

  /**
   * On révoque le jeton côté serveur, mais une défaillance réseau ne doit
   * jamais empêcher de se déconnecter : les jetons locaux sont effacés dans
   * tous les cas.
   */
  signOut: async () => {
    // Avant de perdre l'accès à l'API : sans cela, l'appareil continuerait de
    // recevoir les rappels d'un compte dont il est sorti.
    await forgetDeviceForPush()

    const refreshToken = await getRefreshToken()
    if (refreshToken) {
      await publicApi.auth.logout(refreshToken).catch(() => {})
    }
    await clearTokens()
    set({ status: 'unauthenticated', user: null })
  },
}))

// Quand le rafraîchissement échoue définitivement, l'app doit revenir au login.
setSessionLostHandler(() => {
  useSession.setState({ status: 'unauthenticated', user: null })
})

/**
 * Message affichable pour une erreur d'authentification.
 * Dit quoi faire, jamais le détail technique.
 */
export function authErrorMessage(error: unknown): string {
  if (!isApiError(error)) return "Une erreur inattendue s'est produite. Réessaie."
  if (error.isNetworkError) return 'Impossible de joindre Growi. Vérifie ta connexion.'
  // Le serveur dit précisément quoi faire — « connecte-toi avec ton mot de
  // passe, Apple pourra être rattaché ensuite » vaut mieux qu'un constat.
  if (error.status === 409) return error.message || 'Un compte existe déjà avec cet email.'
  if (error.status === 429) return error.message
  if (error.isUnauthorized) return 'Email ou mot de passe incorrect.'
  if (error.isValidationError) return error.message
  if (error.isServerError) return 'Growi est momentanément indisponible. Réessaie dans un instant.'
  return "Une erreur inattendue s'est produite. Réessaie."
}
