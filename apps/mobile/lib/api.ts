import { createGrowiApiClient } from '@growi/api-client'

import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './auth-storage'

/**
 * Client de l'API Growi, porteur du jeton d'accès et capable de le rafraîchir.
 *
 * Ce module ne dépend pas du store de session : quand la session est
 * définitivement perdue, il appelle un gestionnaire que le store enregistre au
 * démarrage. Sans cette inversion, les deux modules s'importeraient mutuellement.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL

if (!baseUrl) {
  console.warn(
    "EXPO_PUBLIC_API_URL n'est pas défini : les appels à l'API échoueront. " +
      "Copie .env.example vers .env et renseigne l'adresse de ton serveur.",
  )
}

const API_BASE_URL = baseUrl ?? 'http://localhost:3000'

/**
 * L'API et le site web partagent la même origine : c'est elle qu'on ouvre
 * pour les écrans que le mobile ne porte pas encore, comme le plan du jardin.
 */
export const WEB_BASE_URL = API_BASE_URL

// ─── Perte de session ──────────────────────────────────────────────────────

type SessionLostHandler = () => void

let onSessionLost: SessionLostHandler = () => {}

/** Enregistre le traitement à effectuer quand le rafraîchissement échoue. */
export function setSessionLostHandler(handler: SessionLostHandler): void {
  onSessionLost = handler
}

// ─── Rafraîchissement ──────────────────────────────────────────────────────

/**
 * Client dépourvu de `onUnauthorized`, réservé à l'appel de rafraîchissement :
 * l'utiliser avec le client principal provoquerait une récursion.
 */
const bareClient = createGrowiApiClient({ baseUrl: API_BASE_URL })

/**
 * Une seule tentative de rafraîchissement à la fois.
 *
 * Sans ce verrou, plusieurs requêtes recevant un 401 simultanément
 * déclencheraient chacune un rafraîchissement ; la rotation des jetons côté
 * serveur invaliderait alors les jetons des autres, et la détection de rejeu
 * révoquerait toutes les sessions de l'utilisateur.
 */
let refreshInFlight: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false

  try {
    const tokens = await bareClient.auth.refresh(refreshToken)
    await saveTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
    return true
  } catch {
    // Jeton expiré, révoqué ou rejoué : la session est perdue pour de bon.
    await clearTokens()
    onSessionLost()
    return false
  }
}

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

// ─── Client principal ──────────────────────────────────────────────────────

export const api = createGrowiApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken,
  onUnauthorized: refreshSession,
})

/** Client sans rafraîchissement — pour la connexion et l'inscription. */
export const publicApi = bareClient
