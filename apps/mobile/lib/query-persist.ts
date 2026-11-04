import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions, Persister } from '@tanstack/react-query-persist-client'
import * as Application from 'expo-application'

import { queryClient } from '@/lib/query-client'

/**
 * Le cache de React Query, gardé sur le téléphone d'un lancement à l'autre.
 *
 * Au démarrage, l'accueil, le planning et les plantes s'affichent aussitôt
 * avec les données du dernier passage, puis chaque requête dont la fraîcheur
 * (`staleTime`) est dépassée repart vers l'API et remplace l'écran dès sa
 * réponse. Sans lui, chaque lancement à froid montrait des squelettes partout,
 * le temps d'un aller-retour par écran.
 *
 * Les règles :
 *
 * - **Une liste blanche**, pas une liste noire : ne survit au redémarrage que
 *   ce qui sert à l'ouverture de l'app. Ni la messagerie, ni le fil de la
 *   communauté, ni le chat (qui changent vite et ne gagnent rien à revenir
 *   périmés), ni le profil (`me`), inutile au premier écran.
 * - **Ce qui vaut pour « aujourd'hui » ne passe pas minuit** (`DAILY_ROOTS`) :
 *   le planning de la veille affiché sous « Aujourd'hui », ou la météo d'hier,
 *   seraient faux — et le resteraient si le réseau manque.
 * - **Rien de plus vieux que `PERSIST_MAX_AGE`** n'est réécrit : une requête
 *   restaurée repart avec un minuteur neuf, et sans ce filtre une fiche ouverte
 *   une fois (ou une plante supprimée depuis) resterait sur le disque à jamais.
 * - **Vidé à chaque changement de compte** (`clearQueryCache`, appelé par
 *   `store/session.ts`) : connexion, déconnexion, jeton refusé, session perdue.
 *   Rien de ce qu'a vu un compte ne doit s'afficher au suivant.
 * - **Invalidé à chaque nouveau build** (`buster`) : la forme d'une réponse
 *   peut changer d'une version à l'autre, et un cache d'une ancienne version
 *   ferait planter un écran qui ne l'attend plus. `CACHE_SCHEMA` sert à forcer
 *   l'invalidation sans nouveau build natif.
 */

const CACHE_SCHEMA = 1

/** Les racines de `lib/queries/keys.ts` que l'on garde. */
export const PERSISTED_ROOTS = ['summary', 'planning', 'weather', 'gardens', 'plants', 'blog'] as const
const PERSISTED = new Set<string>(PERSISTED_ROOTS)

/** Celles qui décrivent « aujourd'hui » : jetées si elles datent d'un autre jour. */
const DAILY_ROOTS = new Set<string>(['summary', 'planning', 'weather'])

/** Au-delà d'un jour, des données ne rendent plus service : on repart de zéro. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000

// Les racines persistées vivent en mémoire aussi longtemps que sur le disque :
// une requête retirée de la mémoire n'est plus réécrite, et disparaîtrait du
// cache disque à la sauvegarde suivante.
for (const root of PERSISTED_ROOTS) {
  queryClient.setQueryDefaults([root], { gcTime: PERSIST_MAX_AGE })
}

const storage = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'growi.query-cache',
  // Une écriture au plus par seconde : chaque réponse ne réécrit pas tout.
  throttleTime: 1000,
})

/** Même jour local ? `toDateString` plutôt qu'`Intl`, absent de Hermes. */
function isToday(timestamp: number): boolean {
  return new Date(timestamp).toDateString() === new Date().toDateString()
}

export const queryPersister: Persister = {
  persistClient: storage.persistClient,
  removeClient: storage.removeClient,
  restoreClient: async () => {
    const client = await storage.restoreClient()
    if (!client) return client
    client.clientState.queries = client.clientState.queries.filter(
      (query) => !DAILY_ROOTS.has(String(query.queryKey[0])) || isToday(query.state.dataUpdatedAt),
    )
    return client
  },
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  buster: `${CACHE_SCHEMA}-${Application.nativeApplicationVersion ?? '0'}-${Application.nativeBuildVersion ?? '0'}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false
      const [root, , , leaf] = query.queryKey
      if (!PERSISTED.has(String(root))) return false
      // Le plan dessiné d'un jardin est lourd et ne s'ouvre qu'à la demande.
      if (root === 'gardens' && leaf === 'plan') return false
      if (Date.now() - query.state.dataUpdatedAt > PERSIST_MAX_AGE) return false
      return true
    },
  },
}

/**
 * Oublie tout : la mémoire et le disque. Ne lève jamais — comme la révocation
 * du jeton, l'effacement est une précaution, pas une condition pour changer
 * de compte.
 */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear()
  try {
    await queryPersister.removeClient()
  } catch {
    // Stockage indisponible : rien de plus à faire.
  }
}
