# @growi/api-client

Client TypeScript de l'API Growi v1 (`/api/v1/*`), consommé par l'app mobile
et utilisable depuis le web.

Package « source-first » : pas d'étape de build, on importe le TypeScript
directement.

## Utilisation

```ts
import { createGrowiApiClient, isApiError } from '@growi/api-client'

const api = createGrowiApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  getAccessToken: () => SecureStore.getItemAsync('accessToken'),
  onUnauthorized: async () => {
    // Rafraîchir le jeton (phase 3). Renvoyer true rejoue la requête une fois.
    return refreshAccessToken()
  },
})

const gardens = await api.gardens.list()
const plant = await api.gardens.addPlant(gardens[0].id, { location: 'OUTDOOR' })
await api.plants.addLog(plant.id, { type: 'watering', note: 'Copieux' })
```

Depuis le web, où l'authentification passe par les cookies NextAuth, il suffit
de ne pas fournir `getAccessToken` et de passer `credentials: 'include'`.

## Erreurs

Toute défaillance remonte en `ApiError`, avec un `code` stable et des
accesseurs pour les cas courants :

```ts
try {
  await api.gardens.get(id)
} catch (err) {
  if (isApiError(err) && err.isNotFound) { /* … */ }
}
```

| Accesseur | Cas |
|---|---|
| `isUnauthorized` | 401 — jeton absent, expiré ou refusé |
| `isNotFound` | 404 — ressource inexistante, ou appartenant à un autre compte |
| `isValidationError` | 400 — corps de requête invalide |
| `isServerError` | 5xx — réessayer a du sens |
| `isNetworkError` | la requête n'a pas atteint le serveur (hors ligne, DNS, timeout) |

## Rafraîchissement du jeton

Sur un 401, le client appelle `onUnauthorized()`. Si le callback renvoie
`true`, la requête est rejouée **une seule fois** avec le nouveau jeton ;
sinon l'`ApiError` remonte à l'appelant, qui peut déconnecter l'utilisateur.

## Tests

```bash
pnpm --filter @growi/api-client test
```
