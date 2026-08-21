import { Stack } from 'expo-router'

/**
 * Pile de l'onglet Accueil.
 *
 * Le profil s'y ouvre en modale depuis l'en-tête : les cinq onglets sont pris
 * par les écrans du jardin, et un profil se consulte rarement.
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
      <Stack.Screen name="plantes/[plantId]/index" />
      <Stack.Screen name="plantes/[plantId]/modifier" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
