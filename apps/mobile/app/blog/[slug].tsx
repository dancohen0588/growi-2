import { Redirect, useLocalSearchParams } from 'expo-router'

/**
 * Lien profond `growi://blog/<slug>` — pour une future notification
 * « Nouvel article », et pour les liens partagés qui reviennent vers l'app.
 *
 * L'écran d'article vit dans la pile de l'accueil : cette route n'existe que
 * pour y renvoyer, sans dupliquer la destination. La redirection ne contourne
 * aucune garde — c'est le layout des onglets qui exige une session.
 */
export default function BlogDeepLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>()

  if (!slug) return <Redirect href="/(tabs)/accueil/conseils" />

  return <Redirect href={{ pathname: '/(tabs)/accueil/conseils/[slug]', params: { slug } }} />
}
