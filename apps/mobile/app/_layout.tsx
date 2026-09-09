import '../global.css'

import { useEffect } from 'react'
import * as Sentry from '@sentry/react-native'
import { Stack, useNavigationContainerRef } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins'
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
} from '@expo-google-fonts/raleway'

import { ToastProvider } from '@/components/ui/Toast'
import { initAnalytics } from '@/lib/analytics/posthog'
import { useScreenTracking } from '@/lib/analytics/use-screen-tracking'
import { initSentry, navigationIntegration } from '@/lib/observability/sentry'
import { queryClient } from '@/lib/query-client'
import { useSession } from '@/store/session'

// Au chargement du module, avant le premier rendu : le layout racine est le
// premier module de l'app à être évalué, et une erreur de démarrage est
// justement celle qu'aucun simulateur ne reproduit. L'appel ne fait rien en
// développement ni sans DSN.
initSentry()
initAnalytics()

// L'écran de démarrage reste affiché tant que les polices ne sont pas prêtes et
// que la session n'est pas restaurée : sans cela, l'app apparaîtrait une
// fraction de seconde avec la police système, puis afficherait le login à
// quelqu'un qui est déjà connecté.
SplashScreen.preventAutoHideAsync()

function RootLayout() {
  useScreenTracking()

  // Le conteneur de navigation d'expo-router, remis à Sentry pour qu'une
  // transaction porte le nom de l'écran (`(tabs)/jardins/[id]`) plutôt qu'un
  // identifiant. Le ref n'existe qu'au premier rendu, d'où l'effet.
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef)
    }
  }, [navigationRef])

  const [fontsLoaded, fontError] = useFonts({
    // Les graisses légères de Poppins ne servent qu'à l'onboarding, seul écran
    // dont le corps de texte n'est pas en Raleway (décision produit).
    Poppins_400Regular,
    Poppins_500Medium,
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
        <ToastProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F9F7E8' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          {/* Publier n'est pas une destination mais un geste, et il part de
              partout — le fil, l'accueil, la fiche plante (qui existe dans
              quatre piles). Déclarée ici, à la racine, elle s'ouvre par un
              chemin absolu sans être recopiée dans chaque pile ; une modale
              ne peut de toute façon pas vivre dans un navigateur d'onglets. */}
          <Stack.Screen name="publier" options={{ presentation: 'modal' }} />
          <Stack.Screen name="annonce" options={{ presentation: 'modal' }} />
        </Stack>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

// `Sentry.wrap` enveloppe la racine : c'est lui qui mesure le démarrage à
// froid et rattache les erreurs de rendu React à la bonne transaction. Sans
// enveloppe, on ne voit que les erreurs déjà remontées à la main.
export default Sentry.wrap(RootLayout)
