import { File, Paths } from 'expo-file-system'

import { clearTokens } from '@/lib/auth-storage'
import { resetOnboarding } from '@/lib/onboarding-storage'

/**
 * Purge le trousseau à la première ouverture qui suit une installation.
 *
 * Le trousseau iOS **survit à la désinstallation de l'app** — c'est un
 * comportement du système, pas d'`expo-secure-store`. Sans cette purge :
 *
 * - la présentation ne se rejoue jamais après un réinstall, puisque le drapeau
 *   « déjà vue » est toujours là ;
 * - et surtout, un refresh token vaut soixante jours : réinstaller l'app sur un
 *   appareil qu'on a cédé rouvre la session de son ancien porteur.
 *
 * Le marqueur vit dans le bac à sable de l'app, lui bel et bien effacé avec
 * elle : son absence est donc la seule preuve fiable d'une installation neuve.
 *
 * `expo-file-system` est déjà dans le binaire — `expo` en dépend — donc le
 * déclarer ne coûte pas de build : le correctif part en `eas update`.
 */
const MARKER = '.installed'

/**
 * Ne lève jamais : un bac à sable illisible ne doit pas empêcher de démarrer.
 * On préfère alors ne rien purger — au pire on retombe sur l'ancien
 * comportement, jamais sur une session effacée par erreur.
 */
export async function clearKeychainOnFreshInstall(): Promise<void> {
  try {
    const marker = new File(Paths.document, MARKER)
    if (marker.exists) return

    await Promise.all([clearTokens(), resetOnboarding()])
    // `overwrite` plutôt que le défaut : `create` lève si le fichier existe, et
    // une purge réussie suivie d'un marqueur non posé se rejouerait à chaque
    // démarrage — donc déconnecterait à chaque démarrage.
    marker.create({ overwrite: true })
  } catch {
    // Silencieux.
  }
}
