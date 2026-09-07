import { Stack } from 'expo-router'

/**
 * Pile de l'onglet Accueil.
 *
 * Le profil s'y ouvre en modale depuis l'en-tête : les cinq onglets sont pris
 * par les destinations du jardin, et un profil se consulte rarement.
 *
 * Le blog vit ici plutôt que dans un sixième onglet : on y arrive depuis les
 * « Conseils du moment » de l'accueil, et une barre à six entrées ne tiendrait
 * pas sur un iPhone SE.
 *
 * La communauté (`communaute/*`) suit le même raisonnement, pour la même
 * raison : on y entre depuis l'accueil et depuis le profil, pas depuis un
 * onglet qu'il faudrait prendre à « Identifier ».
 */
export default function AccueilLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="profil" options={{ presentation: 'modal' }} />
      <Stack.Screen name="conseils/index" />
      <Stack.Screen name="conseils/[slug]" />
      {/* L'activation est une modale : elle s'ouvre depuis le profil, qui en
          est déjà une, et depuis l'accueil. */}
      <Stack.Screen name="communaute/activer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="communaute/bloques" />
      <Stack.Screen name="communaute/index" />
      <Stack.Screen name="communaute/publications/[id]" />
      <Stack.Screen name="communaute/notifications" />
      <Stack.Screen name="communaute/u/[handle]/index" />
      <Stack.Screen name="communaute/u/[handle]/abonnes" />
      <Stack.Screen name="communaute/u/[handle]/abonnements" />
      <Stack.Screen name="communaute/bourse/index" />
      <Stack.Screen name="communaute/bourse/[id]" />
      <Stack.Screen name="communaute/bourse/mes-annonces" />
      <Stack.Screen name="communaute/messages/index" />
      <Stack.Screen name="communaute/messages/[threadId]" />
    </Stack>
  )
}
