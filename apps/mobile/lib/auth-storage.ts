import * as SecureStore from 'expo-secure-store'

/**
 * Stockage des jetons dans le trousseau de l'appareil (Keychain iOS,
 * Keystore Android) — jamais dans AsyncStorage, qui est lisible en clair sur
 * un appareil compromis.
 *
 * Ce module ne connaît ni l'API ni le store de session : il ne fait que lire
 * et écrire, ce qui évite les dépendances circulaires entre les deux.
 */

const ACCESS_TOKEN_KEY = 'growi.accessToken'
const REFRESH_TOKEN_KEY = 'growi.refreshToken'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
}

export async function saveTokens({ accessToken, refreshToken }: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ])
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}
