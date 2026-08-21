import { Pressable, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import type { ActionPriority, GardenAction } from '@growi/shared'

/** L'urgence se lit à la pastille ; le texte reste lisible en toutes circonstances. */
const PRIORITY_TONE: Record<ActionPriority, string> = {
  high: 'bg-destructive',
  medium: 'bg-sun',
  low: 'bg-lime',
}

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: 'Priorité haute',
  medium: 'Priorité moyenne',
  low: 'Priorité basse',
}

export interface TaskRowProps {
  action: GardenAction
  /** Coche la tâche : le geste correspondant part au journal. */
  onDone: () => void
  /** Ouvre la fiche de la plante — absent quand la tâche n'en vise aucune. */
  onOpenPlant?: () => void
  disabled?: boolean
}

export function TaskRow({ action, onDone, onOpenPlant, disabled }: TaskRowProps) {
  const late = action.dueDate < new Date().toISOString().slice(0, 10)

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      {/* Case à cocher : 44 pt de zone tactile pour un visuel de 28. */}
      <Pressable
        onPress={onDone}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false, disabled }}
        accessibilityLabel={`Marquer « ${action.shortLabel} » comme fait`}
        className={[
          'h-7 w-7 items-center justify-center rounded-full border-2 border-forest',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
        style={({ pressed }) => (pressed && !disabled ? { backgroundColor: '#B4DD7F' } : null)}
      >
        <Check size={16} color="#1E5631" opacity={0.25} />
      </Pressable>

      <Pressable
        onPress={onOpenPlant}
        disabled={!onOpenPlant}
        accessibilityRole={onOpenPlant ? 'button' : undefined}
        accessibilityLabel={onOpenPlant ? `Ouvrir la fiche de ${action.plantName}` : undefined}
        className="flex-1 flex-row items-center gap-2"
      >
        <View className="flex-1 gap-0.5">
          <Text className="font-raleway-medium text-body text-forest" numberOfLines={2}>
            {action.label}
          </Text>

          <View className="flex-row items-center gap-2">
            <View
              className={`h-2 w-2 rounded-full ${PRIORITY_TONE[action.priority]}`}
              accessibilityLabel={PRIORITY_LABEL[action.priority]}
            />
            <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
              {action.plantName ?? action.shortLabel}
              {late ? ' · en retard' : ''}
              {action.estimatedMinutes ? ` · ${action.estimatedMinutes} min` : ''}
            </Text>
          </View>
        </View>

        {onOpenPlant ? <ChevronRight size={18} color="hsl(139 20% 40%)" /> : null}
      </Pressable>
    </View>
  )
}
