import { createGrowiApiClient } from '@growi/api-client'

/**
 * Client de l'API Growi.
 *
 * `getAccessToken` et `onUnauthorized` sont branchés sur le stockage sécurisé
 * à l'étape 4.2 ; pour l'instant le client fonctionne en anonyme, ce qui
 * suffit à vérifier que la configuration réseau est correcte.
 */

const baseUrl = process.env.EXPO_PUBLIC_API_URL

if (!baseUrl) {
  // Message explicite plutôt qu'un échec réseau incompréhensible au premier appel.
  console.warn(
    "EXPO_PUBLIC_API_URL n'est pas défini : les appels à l'API échoueront. " +
      'Copie .env.example vers .env et renseigne l\'adresse de ton serveur.',
  )
}

export const api = createGrowiApiClient({
  baseUrl: baseUrl ?? 'http://localhost:3000',
})
