import { Platform } from 'react-native'
import { create } from 'zustand'
import { isApiError } from '@growi/api-client'

import { api, publicApi, setSessionLostHandler } from '@/lib/api'
import { clearTokens, getRefreshToken, saveTokens } from '@/lib/auth-storage'

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
  restore: () => Promise<void>
  signIn: (input: { email: string; password: string }) => Promise<void>
  signUp: (input: { firstName: string; email: string; password: string }) => Promise<void>
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

  /**
   * Au démarrage : s'il existe un jeton, on vérifie qu'il vaut encore quelque
   * chose en demandant le profil. Le client rafraîchit tout seul si l'access
   * token a expiré ; s'il n'y parvient pas, `setSessionLostHandler` remet la
   * session à zéro.
   */
  restore: async () => {
    const refreshToken = await getRefreshToken()
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
   * On révoque le jeton côté serveur, mais une défaillance réseau ne doit
   * jamais empêcher de se déconnecter : les jetons locaux sont effacés dans
   * tous les cas.
   */
  signOut: async () => {
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
  if (error.status === 409) return 'Un compte existe déjà avec cet email.'
  if (error.status === 429) return error.message
  if (error.isUnauthorized) return 'Email ou mot de passe incorrect.'
  if (error.isValidationError) return error.message
  if (error.isServerError) return 'Growi est momentanément indisponible. Réessaie dans un instant.'
  return "Une erreur inattendue s'est produite. Réessaie."
}
