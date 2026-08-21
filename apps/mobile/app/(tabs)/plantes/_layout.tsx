import { Stack } from 'expo-router'

/** Pile de l'onglet Mes plantes. */
export default function PlantesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[plantId]/index" />
      <Stack.Screen name="[plantId]/modifier" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
