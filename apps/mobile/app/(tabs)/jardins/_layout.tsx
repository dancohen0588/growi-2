import { Stack } from 'expo-router'

/**
 * Pile de navigation interne à l'onglet Jardins : la barre d'onglets reste
 * visible, et le geste de retour iOS fonctionne d'écran en écran.
 */
export default function JardinsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      {/* Création et édition en modale, avec un bouton Annuler explicite. */}
      <Stack.Screen name="nouveau" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/modifier" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/plantes/nouvelle" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]/plantes/[plantId]/index" />
      <Stack.Screen
        name="[id]/plantes/[plantId]/modifier"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  )
}
