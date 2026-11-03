import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { getWeatherCodeInfo, toIsoDate, type GardenWeather } from '@growi/shared'

import { ConseilsSection } from '@/components/blog/ConseilsSection'
import { AroundYouSection } from '@/components/community/AroundYouSection'
import { HomeHero } from '@/components/home/HomeHero'
import { IdentifyCta } from '@/components/home/IdentifyCta'
import { ForecastRow } from '@/components/weather/ForecastRow'
import { GardenContextCard } from '@/components/weather/GardenContextCard'
import { WeatherNow } from '@/components/weather/WeatherNow'
import { WeatherUnavailable } from '@/components/weather/WeatherUnavailable'
import { WeeklyTips } from '@/components/weather/WeeklyTips'
import { ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useSummary } from '@/lib/queries/summary'
import { useGardenWeather } from '@/lib/queries/weather'
import { useSession } from '@/store/session'

/** « Lundi 2 novembre · 9° nuageux » — la météo s'ajoute dès qu'elle est là. */
function heroSubtitle(weather: GardenWeather | undefined): string {
  const day = formatDayLabel()
  const date = day.charAt(0).toUpperCase() + day.slice(1)
  if (!weather) return date
  const label = getWeatherCodeInfo(weather.current.weatherCode).label.toLowerCase()
  return `${date} · ${Math.round(weather.current.temperature)}° ${label}`
}

/**
 * Accueil — l'aperçu du jardin.
 *
 * En haut, une photo d'une plante de l'utilisateur (tirée au sort chaque jour
 * par le serveur) avec le tableau de bord posé dessus, puis l'identification,
 * mise en avant comme sur le web. Viennent ensuite la météo du jardin, son
 * contexte, les conseils de la semaine, la communauté et le blog.
 *
 * Le hero passe sous la barre d'état : elle est claire le temps que l'écran a
 * le focus, et redevient sombre en le quittant — les autres onglets sont sur
 * fond sand.
 */
export default function AccueilScreen() {
  const router = useRouter()
  const firstName = useSession((s) => s.user?.firstName)
  const email = useSession((s) => s.user?.email)
  const summary = useSummary()
  const weather = useGardenWeather()
  const [refreshing, setRefreshing] = useState(false)
  // Les onglets restent montés : un <StatusBar> rendu en permanence
  // imposerait le clair à toute l'app. Il n'est rendu que pendant le focus,
  // et la pile d'expo-status-bar rend la main au « dark » de la racine.
  const [focused, setFocused] = useState(true)

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([summary.refetch(), weather.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [summary, weather])

  const openProfile = () => router.push('/(tabs)/accueil/profil')
  const initial = (firstName || email || '?').trim().charAt(0).toUpperCase()

  return (
    // Pas de bord haut : le hero s'étend sous la barre d'état et gère lui-même
    // la marge de sécurité.
    <SafeAreaView className="flex-1 bg-sand" edges={['left', 'right']}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <HomeHero
          title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
          subtitle={heroSubtitle(weather.data)}
          profileInitial={initial}
          onOpenProfile={openProfile}
          summary={{
            data: summary.data,
            isPending: summary.isPending,
            isError: summary.isError,
            onRetry: () => void summary.refetch(),
          }}
        />

        {/* À cheval sur le bas du hero : la pousse du bouton déborde dessus. */}
        <View className="-mt-10 px-4">
          <IdentifyCta onPress={() => router.push('/(tabs)/identifier')} />
        </View>

        <View className="mt-7 gap-7">
          {/* La météo du jardin, là où l'on ouvre l'app. Sans position, l'API
              répond une erreur de saisie : on la traduit en invitation, pas en
              panne. */}
          {weather.isPending ? (
            <View className="px-4">
              <ListSkeleton count={2} />
            </View>
          ) : weather.isError ? (
            <View className="px-4">
              <WeatherUnavailable
                reason={errorMessage(weather.error)}
                onOpenProfile={openProfile}
              />
            </View>
          ) : (
            <>
              <View className="gap-3">
                <View className="px-4">
                  <WeatherNow weather={weather.data} />
                </View>
                <ForecastRow forecast={weather.data.forecast} today={toIsoDate(new Date())} />
              </View>

              {weather.data.context ? (
                <View className="px-4">
                  <GardenContextCard context={weather.data.context} />
                </View>
              ) : null}

              {weather.data.tips.length > 0 ? (
                <View className="px-4">
                  <WeeklyTips tips={weather.data.tips} />
                </View>
              ) : null}
            </>
          )}

          {/* La communauté après le jardin, et avant le blog : ce que font les
              voisins vaut un coup d'œil plus souvent qu'un article. Muette tant
              que le profil public n'est pas activé. */}
          <AroundYouSection />

          {/* Le blog vient après le jardin : on ouvre l'app pour savoir quoi
              faire aujourd'hui, pas pour lire. */}
          <ConseilsSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
