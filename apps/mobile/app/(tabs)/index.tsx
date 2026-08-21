import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type { GardenAction, GardenPlanning } from '@growi/shared'

import { AlertCard } from '@/components/planning/AlertCard'
import { TaskRow } from '@/components/planning/TaskRow'
import { WeatherBanner, WeatherUnavailable } from '@/components/planning/WeatherBanner'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, useTodayPlanning } from '@/lib/queries/planning'

export default function AujourdhuiScreen() {
  const router = useRouter()
  const toast = useToast()

  const planning = useTodayPlanning()
  const markDone = useMarkActionDone()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await planning.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [planning])

  const completeTask = (garden: GardenPlanning, action: GardenAction) => {
    markDone.mutate(
      {
        actionId: action.id,
        gardenId: garden.id,
        actionType: action.type,
        plantId: action.plantId,
      },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const data = planning.data
  const taskCount = data?.gardens.reduce((total, g) => total + g.actions.length, 0) ?? 0
  const alerts = data?.gardens.flatMap((garden) => garden.alerts) ?? []
  const hasGarden = (data?.gardens.length ?? 0) > 0
  // Le nom du jardin n'aide qu'à distinguer : avec un seul, c'est du bruit.
  const showGardenNames = (data?.gardens.length ?? 0) > 1

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="px-4 pb-8 pt-2 gap-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="gap-0.5">
          <Text className="font-poppins-bold text-screen text-forest">{greeting()} 👋</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            {formatDayLabel()}
            {taskCount > 0 ? ` · ${taskCount} geste${taskCount > 1 ? 's' : ''} à faire` : ''}
          </Text>
        </View>

        {planning.isPending ? (
          <ListSkeleton count={4} />
        ) : planning.isError ? (
          <ErrorState
            message={errorMessage(planning.error)}
            onRetry={() => void planning.refetch()}
          />
        ) : !data ? null : (
          <>
            {data.weather ? <WeatherBanner weather={data.weather} /> : <WeatherUnavailable />}

            {alerts.length > 0 ? (
              <View className="gap-2">
                <Text className="font-poppins text-section text-forest">À surveiller</Text>
                {alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            ) : null}

            {!hasGarden ? (
              <EmptyState
                emoji="🌱"
                title="Ton premier jardin t'attend"
                message="Crée un jardin et ajoute tes plantes : les gestes du jour apparaîtront ici."
                cta={{ label: 'Créer un jardin', onPress: () => router.push('/(tabs)/jardins') }}
              />
            ) : taskCount === 0 ? (
              <EmptyState
                emoji="🌿"
                title="Tout est à jour"
                message="Rien à faire aujourd'hui. Profites-en pour observer tes plantes — elles te le rendront."
              />
            ) : (
              data.gardens
                .filter((garden) => garden.actions.length > 0)
                .map((garden) => (
                  <View key={garden.id} className="gap-2">
                    {showGardenNames ? (
                      <Text className="font-poppins text-section text-forest">{garden.name}</Text>
                    ) : null}

                    {garden.actions.map((action) => (
                      // Aucune désactivation pendant l'envoi : la ligne cochée
                      // disparaît aussitôt, et on coche souvent d'affilée.
                      <TaskRow
                        key={action.id}
                        action={action}
                        onDone={() => completeTask(garden, action)}
                        onOpenPlant={
                          action.plantId
                            ? () =>
                                router.push(
                                  `/(tabs)/jardins/${garden.id}/plantes/${action.plantId}`,
                                )
                            : undefined
                        }
                      />
                    ))}
                  </View>
                ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
