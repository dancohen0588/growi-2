import { Pressable, Text, View } from 'react-native'
import { Check, ChevronRight } from 'lucide-react-native'
import type { ActionPriority, GardenAction } from '@growi/shared'

import { ActionIcon, CareIconBadge } from '@/components/plants/CareIcon'

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
  /** Ouvre la fiche de la plante — absent sur la fiche elle-même. */
  onOpenPlant?: () => void
  /** Sur la fiche d'une plante, répéter son nom n'apprend rien. */
  showPlantName?: boolean
}

export function TaskRow({ action, onDone, onOpenPlant, showPlantName = true }: TaskRowProps) {
  const late = action.dueDate < new Date().toISOString().slice(0, 10)

  const meta = [
    showPlantName ? action.plantName : null,
    late ? 'en retard' : null,
    action.estimatedMinutes ? `${action.estimatedMinutes} min` : null,
  ].filter(Boolean)

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      <CareIconBadge>
        <ActionIcon type={action.type} />
      </CareIconBadge>

      <Pressable
        onPress={onOpenPlant}
        disabled={!onOpenPlant}
        accessibilityRole={onOpenPlant ? 'button' : undefined}
        accessibilityLabel={onOpenPlant ? `Ouvrir la fiche de ${action.plantName}` : undefined}
        className="flex-1 flex-row items-center gap-1"
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
              {meta.length > 0 ? meta.join(' · ') : action.shortLabel}
            </Text>
          </View>
        </View>

        {onOpenPlant ? <ChevronRight size={18} color="hsl(139 20% 40%)" /> : null}
      </Pressable>

      {/* Valider est l'action principale de la ligne : un vrai bouton lime,
          pas une case à cocher qu'on cherche du regard. */}
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={`${action.shortLabel} : c'est fait`}
        className="h-11 flex-row items-center gap-1 rounded-lg bg-lime px-3"
        style={({ pressed }) => (pressed ? { backgroundColor: '#a2cf6b' } : null)}
      >
        <Check size={18} color="#1E5631" />
        <Text className="font-raleway-semibold text-secondary text-forest">Fait</Text>
      </Pressable>
    </View>
  )
}
