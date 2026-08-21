import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ACTION_HORIZONS } from '@growi/shared'

import { AlertCard } from '@/components/planning/AlertCard'
import { PlanningSections } from '@/components/planning/PlanningSections'
import { WeatherBanner, WeatherUnavailable } from '@/components/planning/WeatherBanner'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, usePlanningTasks, type PlanningTask } from '@/lib/queries/planning'

/**
 * Calendrier — l'écran qui s'appelait « Aujourd'hui ».
 *
 * Météo du jour, ce qu'il y a à surveiller, puis les gestes rangés par
 * échéance : aujourd'hui en carrousel, demain et plus tard en lignes. Même
 * découpage que la page Calendrier du web, aux mêmes règles.
 */
export default function CalendrierScreen() {
  const router = useRouter()
  const toast = useToast()

  const planning = usePlanningTasks()
  const markDone = useMarkActionDone()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await planning.query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [planning.query])

  const completeTask = ({ action, gardenId }: PlanningTask) => {
    markDone.mutate(
      { actionId: action.id, gardenId, actionType: action.type, plantId: action.plantId },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const openPlant = ({ action }: PlanningTask) =>
    action.plantId
      ? () => router.push(`/(tabs)/calendrier/plantes/${action.plantId}`)
      : undefined

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="pb-8 pt-2 gap-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="gap-0.5 px-4">
          <Text className="font-poppins-bold text-screen text-forest">{greeting()} 👋</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            {formatDayLabel()}
            {planning.groups.today.length > 0
              ? ` · ${planning.groups.today.length} geste${
                  planning.groups.today.length > 1 ? 's' : ''
                } aujourd'hui`
              : ''}
          </Text>
        </View>

        {planning.query.isPending ? (
          <View className="px-4">
            <ListSkeleton count={4} />
          </View>
        ) : planning.query.isError ? (
          <ErrorState
            message={errorMessage(planning.query.error)}
            onRetry={() => void planning.query.refetch()}
          />
        ) : (
          <>
            <View className="px-4">
              {planning.weather ? (
                <WeatherBanner weather={planning.weather} />
              ) : (
                <WeatherUnavailable />
              )}
            </View>

            {planning.alerts.length > 0 ? (
              <View className="gap-2 px-4">
                <Text className="font-poppins text-section text-forest">À surveiller</Text>
                {planning.alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            ) : null}

            {!planning.hasGarden ? (
              <EmptyState
                emoji="🌱"
                title="Ton premier jardin t'attend"
                message="Crée un jardin et ajoute tes plantes : les gestes du jour apparaîtront ici."
                cta={{ label: 'Créer un jardin', onPress: () => router.push('/(tabs)/jardins') }}
              />
            ) : planning.total === 0 ? (
              <EmptyState
                emoji="🌿"
                title="Tout est à jour"
                message="Rien à faire aujourd'hui. Profites-en pour observer tes plantes — elles te le rendront."
              />
            ) : (
              <PlanningSections
                horizons={ACTION_HORIZONS}
                groups={planning.groups}
                today={planning.date}
                showGardenNames={planning.showGardenNames}
                onDone={completeTask}
                onOpenPlant={openPlant}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
