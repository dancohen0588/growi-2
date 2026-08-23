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
    </Stack>
  )
}
