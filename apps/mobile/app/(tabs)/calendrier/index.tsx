import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ACTION_HORIZONS } from '@growi/shared'

import { PlanningSections } from '@/components/planning/PlanningSections'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, usePlanningTasks, type PlanningTask } from '@/lib/queries/planning'

/**
 * Calendrier : les trois échéances d'un seul tenant — aujourd'hui, demain,
 * plus tard. Même découpage que la page Calendrier du web, aux mêmes règles.
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
          <Text className="font-poppins-bold text-screen text-forest">Calendrier</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            Tes prochains gestes, du plus urgent au plus lointain.
          </Text>
        </View>

        {planning.query.isPending ? (
          <View className="px-4">
            <ListSkeleton count={5} />
          </View>
        ) : planning.query.isError ? (
          <ErrorState
            message={errorMessage(planning.query.error)}
            onRetry={() => void planning.query.refetch()}
          />
        ) : planning.total === 0 ? (
          <EmptyState
            emoji="🌿"
            title="Rien de prévu"
            message={
              planning.hasGarden
                ? 'Ton jardin est à jour. Les prochains gestes apparaîtront ici dès que tes plantes en auront besoin.'
                : 'Crée un jardin et ajoute tes plantes pour voir ton planning se remplir.'
            }
            cta={
              planning.hasGarden
                ? undefined
                : { label: 'Créer un jardin', onPress: () => router.push('/(tabs)/jardins') }
            }
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
      </ScrollView>
    </SafeAreaView>
  )
}
