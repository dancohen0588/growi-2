import { Stack } from 'expo-router'

/** Pile de l'onglet Calendrier — ouvrir une plante y reste. */
export default function CalendrierLayout() {
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
