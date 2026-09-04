import * as SecureStore from 'expo-secure-store'

/**
 * Mémorise que la présentation du premier lancement a été vue.
 *
 * SecureStore plutôt qu'AsyncStorage — non par besoin de confidentialité, mais
 * parce que c'est le seul stockage persistant déjà présent dans le binaire :
 * ajouter AsyncStorage imposerait un module natif de plus, donc un nouveau
 * build EAS (le projet est en CNG, sans dossiers `ios/`/`android/`). Cela ne
 * contredit pas la règle « jamais AsyncStorage » de `auth-storage.ts`, qui
 * porte sur les jetons.
 *
 * Clé versionnée : incrémenter le suffixe si un futur onboarding doit être
 * re-montré à tout le monde.
 */
const KEY = 'growi.onboarding.seen.v1'

/**
 * En cas d'échec de lecture, on répond `true` : mieux vaut priver quelqu'un de
 * la présentation que le bloquer derrière un écran qu'on ne sait pas passer.
 */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1'
  } catch {
    return true
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1')
  } catch {
    // Silencieux : au pire la présentation se rejoue au prochain lancement.
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Silencieux.
  }
}
