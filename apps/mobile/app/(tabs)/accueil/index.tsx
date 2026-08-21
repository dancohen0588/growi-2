import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Droplets,
  Leaf,
  ScanSearch,
  UserCircle2,
} from 'lucide-react-native'
import { indicatorTone, toIsoDate, type DashboardSummary } from '@growi/shared'

import { StatCard } from '@/components/home/StatCard'
import { ForecastRow } from '@/components/weather/ForecastRow'
import { GardenContextCard } from '@/components/weather/GardenContextCard'
import { WeatherNow } from '@/components/weather/WeatherNow'
import { WeatherUnavailable } from '@/components/weather/WeatherUnavailable'
import { WeeklyTips } from '@/components/weather/WeeklyTips'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useSummary } from '@/lib/queries/summary'
import { useGardenWeather } from '@/lib/queries/weather'
import { useSession } from '@/store/session'

/** Les quatre indicateurs, dans l'ordre du tableau de bord web. */
function indicators(summary: DashboardSummary) {
  return [
    {
      key: 'plants',
      label: 'Plantes',
      value: summary.plants,
      sub:
        summary.gardens > 0
          ? `dans ${summary.gardens} jardin${summary.gardens > 1 ? 's' : ''}`
          : 'aucun jardin',
      tone: indicatorTone('plants', summary),
      icon: <Leaf size={14} color="hsl(139 20% 40%)" />,
      href: '/(tabs)/plantes' as const,
    },
    {
      key: 'tasks',
      label: 'Gestes du jour',
      value: summary.tasksToday,
      sub:
        summary.tasksLate > 0
          ? `dont ${summary.tasksLate} en retard`
          : summary.tasksWeek > 0
            ? `${summary.tasksWeek} cette semaine`
            : 'rien ne presse',
      tone: indicatorTone('tasks', summary),
      icon: <CalendarDays size={14} color="hsl(139 20% 40%)" />,
      href: '/(tabs)/calendrier' as const,
    },
    {
      key: 'water',
      label: 'À arroser',
      value: summary.plantsToWater,
      sub: summary.plantsToWater > 0 ? "aujourd'hui" : 'tout est arrosé',
      tone: indicatorTone('water', summary),
      icon: <Droplets size={14} color="hsl(139 20% 40%)" />,
      href: '/(tabs)/calendrier' as const,
    },
    {
      key: 'alerts',
      label: 'Alertes',
      value: summary.alerts,
      sub:
        summary.alertsHigh > 0
          ? `dont ${summary.alertsHigh} urgente${summary.alertsHigh > 1 ? 's' : ''}`
          : 'en cours',
      tone: indicatorTone('alerts', summary),
      icon: <AlertTriangle size={14} color="hsl(139 20% 40%)" />,
      href: '/(tabs)/calendrier' as const,
    },
  ]
}

/**
 * Accueil — l'aperçu du jardin, sur le modèle du tableau de bord web.
 *
 * Les mêmes indicateurs, dans le même ordre et avec les mêmes couleurs, puis
 * la météo du jardin : c'est ici qu'on ouvre l'app, donc ici qu'elle se
 * consulte. La grille de raccourcis du web n'est pas reprise : la barre
 * d'onglets remplit déjà ce rôle sur téléphone.
 */
export default function AccueilScreen() {
  const router = useRouter()
  const firstName = useSession((s) => s.user?.firstName)
  const summary = useSummary()
  const weather = useGardenWeather()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([summary.refetch(), weather.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [summary, weather])

  const openProfile = () => router.push('/(tabs)/accueil/profil')

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="pb-8 pt-2 gap-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="flex-row items-start justify-between gap-3 px-4">
          <View className="flex-1 gap-0.5">
            <Text className="font-poppins-bold text-screen text-forest">
              {greeting()}
              {firstName ? `, ${firstName}` : ''} 👋
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              Voici un aperçu de ton jardin.
            </Text>
          </View>

          <Pressable
            onPress={openProfile}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
          >
            <UserCircle2 size={28} color="#1E5631" />
          </Pressable>
        </View>

        {/* Indicateurs */}
        <View className="px-4">
          {summary.isPending ? (
            <ListSkeleton count={2} />
          ) : summary.isError ? (
            <ErrorState
              message={errorMessage(summary.error)}
              onRetry={() => void summary.refetch()}
            />
          ) : (
            <View className="gap-3">
              {/* Deux par ligne : quatre colonnes seraient illisibles ici. */}
              {[0, 2].map((start) => (
                <View key={start} className="flex-row gap-3">
                  {indicators(summary.data)
                    .slice(start, start + 2)
                    .map((indicator) => (
                      <StatCard
                        key={indicator.key}
                        label={indicator.label}
                        value={indicator.value}
                        sub={indicator.sub}
                        tone={indicator.tone}
                        icon={indicator.icon}
                        onPress={() => router.push(indicator.href)}
                      />
                    ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Même mise en avant que sur le web : l'identification d'abord. */}
        <Pressable
          onPress={() => router.push('/(tabs)/identifier')}
          accessibilityRole="button"
          className="mx-4 flex-row items-center gap-3 rounded-2xl border border-lime bg-lime/20 p-4"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        >
          <View className="h-12 w-12 items-center justify-center rounded-full bg-forest">
            <ScanSearch size={24} color="#F9F7E8" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-poppins text-body text-forest">
              Identifier une plante en photo
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              L'IA la reconnaît et donne ses besoins.
            </Text>
          </View>
          <ArrowRight size={20} color="#1E5631" />
        </Pressable>

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
            <View className="px-4">
              <WeatherNow weather={weather.data} />
            </View>

            <ForecastRow forecast={weather.data.forecast} today={toIsoDate(new Date())} />

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
      </ScrollView>
    </SafeAreaView>
  )
}
