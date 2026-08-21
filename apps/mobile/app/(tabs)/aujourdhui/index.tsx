import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ACTION_HORIZON_LABELS,
  groupActionsByHorizon,
  type ActionHorizon,
  type GardenAction,
} from '@growi/shared'

import { AlertCard } from '@/components/planning/AlertCard'
import { TaskCard, TASK_CARD_GAP, TASK_CARD_WIDTH } from '@/components/planning/TaskCard'
import { TaskRow } from '@/components/planning/TaskRow'
import { WeatherBanner, WeatherUnavailable } from '@/components/planning/WeatherBanner'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, useTodayPlanning } from '@/lib/queries/planning'

/** Une tâche accompagnée du jardin dont elle vient — nécessaire pour la valider. */
interface Task {
  action: GardenAction
  gardenId: string
  gardenName: string
}

function SectionTitle({ horizon, count }: { horizon: ActionHorizon; count: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="font-poppins text-section text-forest">
        {ACTION_HORIZON_LABELS[horizon]}
      </Text>
      <View className="rounded-full bg-sand-dark px-2 py-0.5">
        <Text className="font-raleway-semibold text-caption text-forest">{count}</Text>
      </View>
    </View>
  )
}

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

  const completeTask = ({ action, gardenId }: Task) => {
    markDone.mutate(
      { actionId: action.id, gardenId, actionType: action.type, plantId: action.plantId },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const openPlant = (action: GardenAction) =>
    action.plantId
      ? () => router.push(`/(tabs)/aujourdhui/plantes/${action.plantId}`)
      : undefined

  const data = planning.data
  const alerts = data?.gardens.flatMap((garden) => garden.alerts) ?? []

  // Les jardins deviennent une source, plus une section : l'écran se range
  // par échéance. Leur nom ne réapparaît que s'il y en a plusieurs.
  const showGardenNames = (data?.gardens.length ?? 0) > 1
  const tasks: Task[] =
    data?.gardens.flatMap((garden) =>
      garden.actions.map((action) => ({
        action,
        gardenId: garden.id,
        gardenName: garden.name,
      })),
    ) ?? []

  const today = data?.date
  const groups = groupActionsByHorizon(
    tasks.map((task) => ({ ...task, dueDate: task.action.dueDate })),
    today,
  )
  const hasGarden = (data?.gardens.length ?? 0) > 0
  const total = tasks.length

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
            {groups.today.length > 0
              ? ` · ${groups.today.length} geste${groups.today.length > 1 ? 's' : ''} aujourd'hui`
              : ''}
          </Text>
        </View>

        {planning.isPending ? (
          <View className="px-4">
            <ListSkeleton count={4} />
          </View>
        ) : planning.isError ? (
          <ErrorState
            message={errorMessage(planning.error)}
            onRetry={() => void planning.refetch()}
          />
        ) : !data ? null : (
          <>
            <View className="px-4">
              {data.weather ? <WeatherBanner weather={data.weather} /> : <WeatherUnavailable />}
            </View>

            {alerts.length > 0 ? (
              <View className="gap-2 px-4">
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
            ) : total === 0 ? (
              <EmptyState
                emoji="🌿"
                title="Tout est à jour"
                message="Rien à faire aujourd'hui. Profites-en pour observer tes plantes — elles te le rendront."
              />
            ) : null}

            {/* Aujourd'hui : le carrousel donne à chaque geste la place de sa
                photo, et le pouce passe de l'un à l'autre. */}
            {groups.today.length > 0 ? (
              <View className="gap-2">
                <View className="px-4">
                  <SectionTitle horizon="today" count={groups.today.length} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={TASK_CARD_WIDTH + TASK_CARD_GAP}
                  snapToAlignment="start"
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    gap: TASK_CARD_GAP,
                  }}
                >
                  {groups.today.map((task) => (
                    <TaskCard
                      key={task.action.id}
                      action={task.action}
                      late={task.action.dueDate < (today ?? '')}
                      gardenName={showGardenNames ? task.gardenName : undefined}
                      onDone={() => completeTask(task)}
                      onOpenPlant={openPlant(task.action)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Demain et plus tard : en lignes, pour garder la vue d'ensemble. */}
            {(['tomorrow', 'later'] as const).map((horizon) =>
              groups[horizon].length > 0 ? (
                <View key={horizon} className="gap-2 px-4">
                  <SectionTitle horizon={horizon} count={groups[horizon].length} />
                  {groups[horizon].map((task) => (
                    <TaskRow
                      key={task.action.id}
                      action={task.action}
                      subtitle={showGardenNames ? task.gardenName : undefined}
                      onDone={() => completeTask(task)}
                      onOpenPlant={openPlant(task.action)}
                    />
                  ))}
                </View>
              ) : null,
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
