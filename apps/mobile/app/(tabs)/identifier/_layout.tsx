import { Stack } from 'expo-router'

/**
 * Pile de l'onglet Identifier : la fiche de la plante ajoutée s'ouvre ici,
 * pour que le retour ramène à l'identification.
 */
export default function IdentifierLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="plantes/[plantId]/index" />
      <Stack.Screen name="plantes/[plantId]/diagnostic" />
      <Stack.Screen name="plantes/[plantId]/discussion" />
      <Stack.Screen name="plantes/[plantId]/modifier" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
