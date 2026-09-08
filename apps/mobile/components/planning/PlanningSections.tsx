import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  ACTION_HORIZON_LABELS,
  groupWateringActions,
  type ActionHorizon,
  type GardenAction,
} from '@growi/shared'

import { SectionMenu } from '@/components/planning/SectionMenu'
import { TaskCard, TASK_CARD_GAP, TASK_CARD_WIDTH } from '@/components/planning/TaskCard'
import { TaskRow } from '@/components/planning/TaskRow'
import { WateringGroupCard } from '@/components/planning/WateringGroupCard'
import type { PlanningTask } from '@/lib/queries/planning'

/** Au-delà, une section « à ton rythme » occupe l'écran sans rien presser. */
const FOLD_THRESHOLD = 4

function SectionTitle({
  horizon,
  count,
  actions,
  onDoneAll,
  onClearToday,
}: {
  horizon: ActionHorizon
  count: number
  actions: GardenAction[]
  onDoneAll?: () => void
  onClearToday?: () => void
}) {
  return (
    <View className="flex-row items-center gap-2 px-4">
      <Text className="font-poppins text-section text-forest">
        {ACTION_HORIZON_LABELS[horizon]}
      </Text>
      <View className="rounded-full bg-sand-dark px-2 py-0.5">
        <Text className="font-raleway-semibold text-caption text-forest">{count}</Text>
      </View>
      <View className="flex-1" />
      {onDoneAll ? (
        <SectionMenu actions={actions} onDoneAll={onDoneAll} onClearToday={onClearToday} />
      ) : null}
    </View>
  )
}

export interface PlanningSectionsProps {
  horizons: readonly ActionHorizon[]
  groups: Record<ActionHorizon, PlanningTask[]>
  showGardenNames: boolean
  onDone: (task: PlanningTask) => void
  /** Coche plusieurs actions d'un coup — carte groupée et menu de section. */
  onDoneMany?: (tasks: PlanningTask[]) => void
  onOpenDetail: (task: PlanningTask) => void
  /** « Ignorer pour aujourd'hui » — la section du jour seulement. */
  onClearToday?: () => void
  /** Le planning est en pause : la section l'annonce et propose de rétablir. */
  cleared?: boolean
  onRestore?: () => void
}

/**
 * Les sections du planning, du plus pressant au plus lointain.
 *
 * Le jour même passe en carrousel — chaque geste a la place de sa photo, et le
 * pouce va de l'un à l'autre. Le reste tient en lignes, pour garder la vue
 * d'ensemble. L'accueil n'affiche que la première section, le calendrier les
 * quatre : c'est le même composant, donc le même rendu.
 */
export function PlanningSections({
  horizons,
  groups,
  showGardenNames,
  onDone,
  onDoneMany,
  onOpenDetail,
  onClearToday,
  cleared,
  onRestore,
}: PlanningSectionsProps) {
  const [expanded, setExpanded] = useState<ActionHorizon | null>(null)

  return (
    <>
      {horizons.map((horizon) => {
        const tasks = groups[horizon]
        if (tasks.length === 0) {
          // Une section vidée par « Ignorer » doit le dire : sinon la liste
          // maigrit sans qu'on sache pourquoi ni comment revenir en arrière.
          if (horizon !== 'today' || !cleared) return null

          return (
            <View key={horizon} className="gap-2">
              <SectionTitle horizon={horizon} count={0} actions={[]} />
              <View className="mx-4 flex-row items-center gap-2 rounded-xl bg-card px-4 py-3">
                <Text className="flex-1 font-raleway text-secondary text-muted-foreground">
                  🙈 Actions ignorées pour aujourd&apos;hui.
                </Text>
                <Pressable
                  onPress={onRestore}
                  accessibilityRole="button"
                  accessibilityLabel="Rétablir les actions du jour"
                  hitSlop={8}
                  className="h-11 items-center justify-center px-2"
                  style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
                >
                  <Text className="font-raleway-semibold text-secondary text-forest">Rétablir</Text>
                </Pressable>
              </View>
            </View>
          )
        }

        const actions = tasks.map((task) => task.action)
        // Seul l'arrosage est groupé : c'est le seul geste qu'on fasse en
        // tournée. Le groupe retrouve ses tâches par identifiant d'action.
        const { groups: cards, singles } = groupWateringActions(actions, horizon)
        const taskOf = (action: GardenAction) => tasks.find((t) => t.action.id === action.id)!
        const tasksOf = (list: GardenAction[]) => list.map(taskOf)

        const folds = horizon === 'month' && expanded !== horizon && singles.length > FOLD_THRESHOLD
        const visible = folds ? singles.slice(0, FOLD_THRESHOLD) : singles

        return (
          <View key={horizon} className="gap-2">
            <SectionTitle
              horizon={horizon}
              count={tasks.length}
              actions={actions}
              onDoneAll={
                onDoneMany && (horizon === 'today' || horizon === 'month')
                  ? () => onDoneMany(tasks)
                  : undefined
              }
              onClearToday={horizon === 'today' ? onClearToday : undefined}
            />

            {horizon === 'today' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={TASK_CARD_WIDTH + TASK_CARD_GAP}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: 16, gap: TASK_CARD_GAP }}
              >
                {cards.map((group) => (
                  <WateringGroupCard
                    key={group.key}
                    group={group}
                    width={TASK_CARD_WIDTH}
                    onDoneMany={(chosen) => onDoneMany?.(tasksOf(chosen))}
                    onOpenDetail={(action) => onOpenDetail(taskOf(action))}
                  />
                ))}
                {singles.map((action) => {
                  const task = taskOf(action)
                  return (
                    <TaskCard
                      key={action.id}
                      action={action}
                      gardenName={showGardenNames ? task.gardenName : undefined}
                      onDone={() => onDone(task)}
                      onOpenDetail={() => onOpenDetail(task)}
                    />
                  )
                })}
              </ScrollView>
            ) : (
              <View className="gap-2 px-4">
                {cards.map((group) => (
                  <WateringGroupCard
                    key={group.key}
                    group={group}
                    onDoneMany={(chosen) => onDoneMany?.(tasksOf(chosen))}
                    onOpenDetail={(action) => onOpenDetail(taskOf(action))}
                  />
                ))}
                {visible.map((action) => {
                  const task = taskOf(action)
                  return (
                    <TaskRow
                      key={action.id}
                      action={action}
                      subtitle={showGardenNames ? task.gardenName : undefined}
                      onDone={() => onDone(task)}
                      onOpenPlant={undefined}
                      onOpenDetail={() => onOpenDetail(task)}
                    />
                  )
                })}

                {folds ? (
                  <Pressable
                    onPress={() => setExpanded(horizon)}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir les ${singles.length} actions`}
                    className="h-11 items-center justify-center"
                    style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
                  >
                    <Text className="font-raleway-semibold text-secondary text-forest">
                      Voir les {singles.length} actions ⌄
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        )
      })}
    </>
  )
}
