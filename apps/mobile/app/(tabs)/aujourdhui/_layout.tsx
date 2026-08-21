import { Stack } from 'expo-router'

/**
 * Pile de navigation interne à l'onglet Aujourd'hui.
 *
 * Ouvrir une plante depuis une tâche doit ramener ici au retour, pas dans
 * l'onglet Jardins : chaque onglet garde sa propre pile.
 */
export default function AujourdhuiLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="plantes/[plantId]/index" />
      <Stack.Screen name="plantes/[plantId]/modifier" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
