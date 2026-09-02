import { createGrowiApiClient } from '@growi/api-client'

/**
 * Client de l'API v1 pour le navigateur.
 *
 * Le web n'a pas de jeton : c'est le cookie de session NextAuth qui
 * authentifie, et `requireUserId` le lit aussi bien qu'un Bearer. D'où
 * `credentials: 'include'` et l'absence de `getAccessToken`.
 *
 * `baseUrl` vide donne des chemins relatifs (`/api/v1/…`) : la page et l'API
 * partagent la même origine, et fixer un hôte casserait les aperçus de
 * déploiement.
 *
 * Réservé aux composants clients — le serveur appelle les services
 * directement, sans passer par HTTP.
 */
export const api = createGrowiApiClient({
  baseUrl: '',
  credentials: 'include',
})
