import { ScrollView, Text, View } from 'react-native'
import { ACTION_HORIZON_LABELS, type ActionHorizon } from '@growi/shared'

import { TaskCard, TASK_CARD_GAP, TASK_CARD_WIDTH } from '@/components/planning/TaskCard'
import { TaskRow } from '@/components/planning/TaskRow'
import type { PlanningTask } from '@/lib/queries/planning'

function SectionTitle({ horizon, count }: { horizon: ActionHorizon; count: number }) {
  return (
    <View className="flex-row items-center gap-2 px-4">
      <Text className="font-poppins text-section text-forest">
        {ACTION_HORIZON_LABELS[horizon]}
      </Text>
      <View className="rounded-full bg-sand-dark px-2 py-0.5">
        <Text className="font-raleway-semibold text-caption text-forest">{count}</Text>
      </View>
    </View>
  )
}

export interface PlanningSectionsProps {
  horizons: readonly ActionHorizon[]
  groups: Record<ActionHorizon, PlanningTask[]>
  /** Jour de référence du planning, pour repérer le retard. */
  today?: string
  showGardenNames: boolean
  onDone: (task: PlanningTask) => void
  onOpenPlant: (task: PlanningTask) => (() => void) | undefined
}

/**
 * Les sections du planning, du plus pressant au plus lointain.
 *
 * Le jour même passe en carrousel — chaque geste a la place de sa photo, et le
 * pouce va de l'un à l'autre. Le reste tient en lignes, pour garder la vue
 * d'ensemble. L'accueil n'affiche que la première section, le calendrier les
 * trois : c'est le même composant, donc le même rendu.
 */
export function PlanningSections({
  horizons,
  groups,
  today,
  showGardenNames,
  onDone,
  onOpenPlant,
}: PlanningSectionsProps) {
  return (
    <>
      {horizons.map((horizon) => {
        const tasks = groups[horizon]
        if (tasks.length === 0) return null

        return (
          <View key={horizon} className="gap-2">
            <SectionTitle horizon={horizon} count={tasks.length} />

            {horizon === 'today' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={TASK_CARD_WIDTH + TASK_CARD_GAP}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: 16, gap: TASK_CARD_GAP }}
              >
                {tasks.map((task) => (
                  <TaskCard
                    key={task.action.id}
                    action={task.action}
                    late={task.action.dueDate < (today ?? '')}
                    gardenName={showGardenNames ? task.gardenName : undefined}
                    onDone={() => onDone(task)}
                    onOpenPlant={onOpenPlant(task)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View className="gap-2 px-4">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.action.id}
                    action={task.action}
                    subtitle={showGardenNames ? task.gardenName : undefined}
                    onDone={() => onDone(task)}
                    onOpenPlant={onOpenPlant(task)}
                  />
                ))}
              </View>
            )}
          </View>
        )
      })}
    </>
  )
}
