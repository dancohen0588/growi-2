import { Redirect, Stack } from 'expo-router'

import { useSession } from '@/store/session'

export default function AuthLayout() {
  const status = useSession((s) => s.status)

  // Déjà connecté : rien à faire sur les écrans d'authentification.
  if (status === 'authenticated') return <Redirect href="/(tabs)/aujourdhui" />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9F7E8' },
      }}
    />
  )
}
