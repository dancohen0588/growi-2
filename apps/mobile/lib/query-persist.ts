import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
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
 * Trois règles :
 *
 * - **Une liste blanche**, pas une liste noire : ne survit au redémarrage que
 *   ce qui sert à l'ouverture de l'app. Ni la messagerie, ni le fil de la
 *   communauté, ni le chat (qui changent vite et ne gagnent rien à revenir
 *   périmés), ni le profil (`me`), inutile au premier écran.
 * - **Vidé à chaque changement de compte** (`clearQueryCache`, appelé par
 *   `store/session.ts`) : connexion, déconnexion, jeton refusé, suppression.
 *   Rien de ce qu'a vu un compte ne doit s'afficher au suivant.
 * - **Invalidé à chaque nouveau build** (`buster`) : la forme d'une réponse
 *   peut changer d'une version à l'autre, et un cache d'une ancienne version
 *   ferait planter un écran qui ne l'attend plus. `CACHE_SCHEMA` sert à forcer
 *   l'invalidation sans nouveau build natif.
 */

const CACHE_SCHEMA = 1

/** Les racines de `lib/queries/keys.ts` que l'on garde. */
const PERSISTED_ROOTS = new Set(['summary', 'planning', 'weather', 'gardens', 'plants', 'blog'])

/** Au-delà d'un jour, des données ne rendent plus service : on repart de zéro. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'growi.query-cache',
  // Une écriture au plus par seconde : chaque réponse ne réécrit pas tout.
  throttleTime: 1000,
})

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE,
  buster: `${CACHE_SCHEMA}-${Application.nativeApplicationVersion ?? '0'}-${Application.nativeBuildVersion ?? '0'}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false
      const [root, , , leaf] = query.queryKey
      if (!PERSISTED_ROOTS.has(String(root))) return false
      // Le plan dessiné d'un jardin est lourd et ne s'ouvre qu'à la demande.
      if (root === 'gardens' && leaf === 'plan') return false
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
