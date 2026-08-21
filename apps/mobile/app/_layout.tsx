import '../global.css'

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins'
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
} from '@expo-google-fonts/raleway'

import { queryClient } from '@/lib/query-client'
import { useSession } from '@/store/session'

// L'écran de démarrage reste affiché tant que les polices ne sont pas prêtes et
// que la session n'est pas restaurée : sans cela, l'app apparaîtrait une
// fraction de seconde avec la police système, puis afficherait le login à
// quelqu'un qui est déjà connecté.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
  })

  const status = useSession((s) => s.status)
  const restore = useSession((s) => s.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  const ready = (fontsLoaded || fontError) && status !== 'restoring'

  useEffect(() => {
    // On masque aussi en cas d'échec de chargement des polices : mieux vaut une
    // police de repli qu'un écran de démarrage bloqué.
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F9F7E8' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
