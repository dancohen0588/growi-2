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

## Blog

`api.blog` est la seule famille d'appels **publics** : elle aboutit sans jeton,
et peut donc alimenter un écran visible avant connexion.

```ts
const { posts, pagination } = await api.blog.list({ tag: 'potager', limit: 5 })
const post = await api.blog.get(posts[0].slug)   // post.html : MDX déjà compilé
```

- `list()` rend du plus récent au plus ancien ; `limit` est plafonné à 50 côté
  serveur et `pagination.next` vaut `null` sur la dernière page.
- `get()` renvoie le contenu en **HTML**, pas en MDX : le mobile n'exécute pas
  de React. Les images et les liens internes y sont en URL absolue, prêts à
  être rendus hors du site.
- Le contenu ne change qu'au déploiement du site : un `staleTime` généreux
  côté client (une heure) est le bon réglage.

## Agent conversationnel

`api.chat` ouvre un fil ancré sur une plante, un diagnostic ou une action, puis
lit la réponse au fil de l'eau.

```ts
const fil = await api.chat.open({ kind: 'plant', plantInstanceId })

for await (const event of api.chat.send(fil.id, { content: 'Je la rentre cet hiver ?' })) {
  if (event.event === 'text') append(event.data.delta)
  if (event.event === 'proposals') showCards(event.data.proposals)
  if (event.event === 'done') finish(event.data.assistantMessage, event.data.quota)
  if (event.event === 'error') showRetry(event.data.message)
}
```

- **En React Native, passer le `fetch` d'`expo/fetch`** à
  `createGrowiApiClient` : celui du moteur ne donne pas de `response.body`, et
  la réponse n'arriverait qu'une fois complète — le streaming disparaîtrait
  sans qu'aucune erreur ne le signale.
- Le flux se termine toujours par **exactement un** événement terminal, `done`
  ou `error`. Une panne survenue en cours de route laisse le texte déjà reçu et
  sort en `error` : ce texte est persisté côté serveur, rouvrir le fil le
  retrouve.
- Un refus — quota atteint (429), image illisible (400) — lève une `ApiError`
  **avant le premier événement** : l'attraper autour de la boucle.
- Un événement d'un nom inconnu est ignoré, pour qu'un serveur plus récent
  n'empêche pas une app déjà installée de fonctionner.
- `acceptProposal` n'envoie que deux identifiants : c'est la proposition écrite
  en base qui est exécutée. Il est idempotent, le bouton peut être retapé.

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
