import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ACTION_HORIZONS, type GardenAction } from '@growi/shared'

import { AlertCard } from '@/components/planning/AlertCard'
import { actionChatQuery } from '@/components/chat/links'
import { ActionDetailSheet } from '@/components/planning/ActionDetailSheet'
import { DoneTodayList } from '@/components/planning/DoneTodayList'
import { PlanningSections } from '@/components/planning/PlanningSections'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import {
  useClearToday,
  useMarkActionDone,
  useMarkActionsDoneBulk,
  usePlanningTasks,
  useUndoAction,
  type PlanningTask,
} from '@/lib/queries/planning'

/**
 * Calendrier — l'écran qui s'appelait « Aujourd'hui ».
 *
 * Ce qu'il y a à surveiller, puis les gestes rangés par échéance :
 * aujourd'hui en carrousel, demain et plus tard en lignes. Même découpage que
 * la page Calendrier du web, aux mêmes règles.
 *
 * La météo a rejoint l'accueil, où elle se consulte d'un coup d'œil à
 * l'ouverture, plutôt que de doubler ici.
 */
export default function CalendrierScreen() {
  const router = useRouter()
  const toast = useToast()

  const planning = usePlanningTasks()
  const markDone = useMarkActionDone()
  const markDoneBulk = useMarkActionsDoneBulk()
  const clearToday = useClearToday()
  const undoAction = useUndoAction()
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState<PlanningTask | null>(null)

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
      {
        actionId: action.id,
        gardenId,
        actionType: action.type,
        plantId: action.plantId,
        taskId: action.taskId,
      },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  /**
   * « Tout arrosé », « Tout marquer comme fait ».
   *
   * Les tâches sont regroupées par jardin : le planning les réunit tous, et
   * l'endpoint groupé n'en accepte qu'un par appel.
   */
  const completeMany = (tasks: PlanningTask[]) => {
    if (tasks.length === 0) return

    const byGarden = new Map<string, PlanningTask[]>()
    for (const task of tasks) {
      byGarden.set(task.gardenId, [...(byGarden.get(task.gardenId) ?? []), task])
    }

    for (const [gardenId, group] of byGarden) {
      markDoneBulk.mutate(
        {
          gardenId,
          actionIds: group.map((task) => task.action.id),
          items: group.map(({ action }) => ({
            actionType: action.type,
            plantId: action.plantId,
            taskId: action.taskId,
          })),
        },
        {
          onSuccess: ({ done }) =>
            toast(`${done} geste${done > 1 ? 's' : ''} noté${done > 1 ? 's' : ''} 🌱`),
          onError: (error) => toast(errorMessage(error), 'error'),
        },
      )
    }
  }

  /** « Ignorer pour aujourd'hui », et son « Rétablir ». */
  const setCleared = (undo: boolean) =>
    clearToday.mutate(
      { gardenId: planning.gardenIds[0] ?? '', gardenIds: planning.gardenIds, undo },
      {
        onSuccess: () =>
          toast(
            undo
              ? 'Actions rétablies.'
              : "Actions du jour ignorées. Rien n'a été inscrit au journal.",
          ),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )

  const undo = (action: GardenAction) => {
    if (!action.careLogId) return

    undoAction.mutate(
      {
        gardenId: planning.gardenIds[0] ?? '',
        careLogId: action.careLogId,
        taskId: action.taskId,
        plantId: action.plantId,
      },
      {
        onSuccess: () => toast('Geste annulé.'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const openPlant = ({ action }: PlanningTask) =>
    action.plantId
      ? () => router.push(`/(tabs)/calendrier/plantes/${action.plantId}`)
      : undefined

  // Sans plante rattachée, il n'y a rien à demander : l'agent ne répond que
  // sur une plante précise.
  const askAbout = ({ action }: PlanningTask) =>
    action.plantId
      ? () =>
          router.push(
            `/(tabs)/calendrier/plantes/${action.plantId}/discussion${actionChatQuery(action)}`,
          )
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
            ) : planning.total === 0 && !planning.clearedToday ? (
              <EmptyState
                emoji="🌿"
                title="Tout est à jour"
                message="Rien à faire aujourd'hui. Profites-en pour observer tes plantes — elles te le rendront."
              />
            ) : (
              <PlanningSections
                horizons={ACTION_HORIZONS}
                groups={planning.groups}
                showGardenNames={planning.showGardenNames}
                onDone={completeTask}
                onDoneMany={completeMany}
                onOpenDetail={setDetail}
                onClearToday={() => setCleared(false)}
                cleared={planning.clearedToday}
                onRestore={() => setCleared(true)}
              />
            )}

            <DoneTodayList actions={planning.doneToday} onUndo={undo} />
          </>
        )}
      </ScrollView>

      <ActionDetailSheet
        action={detail?.action ?? null}
        onClose={() => setDetail(null)}
        onDone={
          detail
            ? () => {
                const task = detail
                setDetail(null)
                completeTask(task)
              }
            : undefined
        }
        onOpenPlant={
          detail
            ? (() => {
                const open = openPlant(detail)
                return open ? () => { setDetail(null); open() } : undefined
              })()
            : undefined
        }
        onAsk={
          detail
            ? (() => {
                const ask = askAbout(detail)
                return ask ? () => { setDetail(null); ask() } : undefined
              })()
            : undefined
        }
      />
    </SafeAreaView>
  )
}
