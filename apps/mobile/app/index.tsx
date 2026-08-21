import { Redirect } from 'expo-router'

import { useSession } from '@/store/session'

/**
 * Point d'entrée : aiguille vers l'app ou vers la connexion.
 * La restauration de session est déjà terminée ici — le layout racine ne rend
 * rien tant qu'elle est en cours.
 */
export default function Index() {
  const status = useSession((s) => s.status)

  return <Redirect href={status === 'authenticated' ? '/(tabs)' : '/(auth)/login'} />
}
