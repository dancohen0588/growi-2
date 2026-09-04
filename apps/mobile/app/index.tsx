import { Redirect } from 'expo-router'

import { useSession } from '@/store/session'

/**
 * Point d'entrée : aiguille vers l'app, la présentation ou la connexion.
 * La restauration de session est déjà terminée ici — le layout racine ne rend
 * rien tant qu'elle est en cours.
 */
export default function Index() {
  const status = useSession((s) => s.status)
  const onboardingSeen = useSession((s) => s.onboardingSeen)

  // Quelqu'un de déjà connecté ne voit jamais la présentation au démarrage,
  // même si le drapeau est absent : c'est le cas d'un utilisateur existant qui
  // met l'app à jour. L'entrée du profil reste là pour la découvrir.
  // L'accueil ayant sa propre pile, il n'est plus l'`index` du groupe : la
  // cible doit être nommée.
  if (status === 'authenticated') return <Redirect href="/(tabs)/accueil" />
  if (!onboardingSeen) return <Redirect href="/onboarding" />
  return <Redirect href="/(auth)/login" />
}
