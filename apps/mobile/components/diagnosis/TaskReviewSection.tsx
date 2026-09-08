import { Pressable, Text, View } from 'react-native'
import { History } from 'lucide-react-native'
import type { DiagnosisReview, TaskReviewItem, TaskVerdict } from '@growi/shared'

import { formatLogDate } from '@/lib/dates'

export interface TaskReviewSectionProps {
  review: DiagnosisReview | undefined
  /** Verdict courant par tâche — l'écran en garde l'état, il le renvoie ensuite. */
  verdicts: Record<string, TaskVerdict>
  onVerdict: (taskId: string, verdict: TaskVerdict) => void
  /** Déjà planifié : il n'y a plus de verdict à rendre, seulement à relire. */
  readOnly?: boolean
}

/**
 * « Tes actions en cours sur cette plante » — la revue d'avant planification.
 *
 * Deux diagnostics à une semaine d'écart sur le même rosier donnaient deux jeux
 * de tâches qui coexistaient, y compris quand le second disait « plante
 * saine ». Chaque tâche ouverte reçoit ici un verdict pré-coché et sa raison ;
 * l'utilisateur peut inverser chaque choix — c'est lui qui les avait acceptées.
 */
export function TaskReviewSection({
  review,
  verdicts,
  onVerdict,
  readOnly = false,
}: TaskReviewSectionProps) {
  if (!review) return null

  const showTasks = !readOnly && review.tasks.length > 0
  if (!showTasks && review.superseded.length === 0) return null

  return (
    <View className="gap-2">
      <Text className="font-poppins text-section text-forest">
        Tes actions en cours sur cette plante
      </Text>

      {showTasks
        ? review.tasks.map((task) => (
            <TaskRow
              key={task.taskId}
              task={task}
              verdict={verdicts[task.taskId] ?? task.verdict}
              onVerdict={(verdict) => onVerdict(task.taskId, verdict)}
            />
          ))
        : null}

      {/* Ce que ce diagnostic a lui-même retiré, en relecture d'historique :
          les tâches ne sont jamais supprimées, seulement mises de côté. */}
      {review.superseded.map((task) => (
        <View
          key={task.taskId}
          className="flex-row items-center gap-2 rounded-xl bg-card px-3 py-2.5"
        >
          <History size={14} color="hsl(139 20% 40%)" />
          <Text
            className="flex-1 font-raleway text-caption text-muted-foreground line-through"
            numberOfLines={1}
          >
            {task.shortLabel}
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground">
            retirée {formatLogDate(task.supersededAt)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function TaskRow({
  task,
  verdict,
  onVerdict,
}: {
  task: TaskReviewItem
  verdict: TaskVerdict
  onVerdict: (verdict: TaskVerdict) => void
}) {
  return (
    <View className="gap-2 rounded-xl bg-card p-3">
      <View className="gap-0.5">
        <Text className="font-poppins text-body text-forest">{task.shortLabel}</Text>
        <Text className="font-raleway text-caption text-muted-foreground">{task.reason}</Text>
      </View>

      <View
        className="flex-row overflow-hidden rounded-lg border border-border"
        accessibilityRole="radiogroup"
        accessibilityLabel={`Que faire de : ${task.shortLabel}`}
      >
        {(['keep', 'drop'] as const).map((value) => {
          const active = verdict === value
          return (
            <Pressable
              key={value}
              onPress={() => onVerdict(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={value === 'keep' ? 'Garder' : 'Retirer'}
              className={[
                'h-11 flex-1 items-center justify-center',
                active ? (value === 'drop' ? 'bg-destructive/15' : 'bg-lime/40') : 'bg-sand',
              ].join(' ')}
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <Text
                className={[
                  'font-raleway-semibold text-secondary',
                  active && value === 'drop' ? 'text-destructive' : 'text-forest',
                  active ? '' : 'opacity-60',
                ].join(' ')}
              >
                {value === 'keep' ? 'Garder' : 'Retirer'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
