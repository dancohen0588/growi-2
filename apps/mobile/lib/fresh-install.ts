import { File, Paths } from 'expo-file-system'
import * as SecureStore from 'expo-secure-store'

import { clearTokens } from '@/lib/auth-storage'
import { forgetUser } from '@/lib/observability/sentry'
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
 * `expo-file-system` est déjà dans le binaire — `expo` en dépend — donc le
 * déclarer ne coûte pas de build : le correctif part en `eas update`.
 */

/** Le marqueur, dans le bac à sable — effacé avec l'app, lui. */
const MARKER = '.installed'

/**
 * Le témoin, dans le trousseau — qui survit à la désinstallation, et c'est
 * justement ce qu'on lui demande.
 *
 * Sans lui, la toute première ouverture de la version qui introduit ce contrôle
 * ressemblerait trait pour trait à une réinstallation : aucun bac à sable ne
 * porte encore le marqueur, et tous les testeurs déjà équipés se seraient fait
 * déconnecter d'un coup. Le témoin dit « ce contrôle a déjà tourné sur ce
 * trousseau » : tant qu'il manque, on se contente d'adopter l'installation en
 * place. Une fois posé, un bac à sable vide ne peut plus signifier qu'une
 * chose — l'app a été supprimée puis réinstallée.
 */
const ADOPTED_KEY = 'growi.install.adopted'

/**
 * Ne lève jamais : un bac à sable illisible ne doit pas empêcher de démarrer.
 * On préfère alors ne rien purger — au pire on retombe sur l'ancien
 * comportement, jamais sur une session effacée par erreur.
 */
export async function clearKeychainOnFreshInstall(): Promise<void> {
  try {
    const marker = new File(Paths.document, MARKER)
    if (marker.exists) return

    if ((await SecureStore.getItemAsync(ADOPTED_KEY)) === '1') {
      await Promise.all([clearTokens(), resetOnboarding()])
      // L'appareil a changé de mains, ou du moins d'installation : ce qui
      // sera remonté ensuite ne doit plus porter le compte précédent.
      forgetUser()
    } else {
      // Installation déjà en place au moment où ce contrôle arrive : on
      // l'adopte telle quelle, session comprise.
      await SecureStore.setItemAsync(ADOPTED_KEY, '1')
    }

    // `overwrite` plutôt que le défaut : `create` lève si le fichier existe, et
    // une purge réussie suivie d'un marqueur non posé se rejouerait à chaque
    // démarrage — donc déconnecterait à chaque démarrage.
    marker.create({ overwrite: true })
  } catch {
    // Silencieux.
  }
}
