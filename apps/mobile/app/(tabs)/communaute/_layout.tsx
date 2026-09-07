import { Stack } from 'expo-router'

/**
 * Pile de l'onglet Communauté.
 *
 * Elle vivait dans la pile Accueil tant que la barre était pleine : les cinq
 * onglets étaient pris par les destinations du jardin. « Mon jardin » ayant
 * cédé sa place — les jardins se choisissent désormais depuis « Mes plantes » —
 * la communauté a la sienne, et n'est plus à deux taps de l'accueil.
 *
 * L'activation du profil public reste une **modale** : c'est un réglage qu'on
 * ouvre, qu'on remplit et qu'on referme, pas une destination.
 */
export default function CommunauteLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="activer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="bloques" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="publications/[id]" />
      <Stack.Screen name="u/[handle]/index" />
      <Stack.Screen name="u/[handle]/abonnes" />
      <Stack.Screen name="u/[handle]/abonnements" />
      <Stack.Screen name="bourse/index" />
      <Stack.Screen name="bourse/[id]" />
      <Stack.Screen name="bourse/mes-annonces" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[threadId]" />
    </Stack>
  )
}
