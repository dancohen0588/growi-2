import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Check, ChevronRight, Stethoscope } from 'lucide-react-native'
import type { GardenAction } from '@growi/shared'

import { ActionIcon, CareIconBadge } from '@/components/plants/CareIcon'
import { formatDueDate } from '@/lib/dates'

export interface TaskRowProps {
  action: GardenAction
  /** Coche la tâche : le geste correspondant part au journal. */
  onDone: () => void
  /** Ouvre la fiche de la plante — absent sur la fiche elle-même. */
  onOpenPlant?: () => void
  /** Sur la fiche d'une plante, répéter son nom n'apprend rien. */
  showPlantName?: boolean
  /** Précision supplémentaire : le jardin, quand l'utilisateur en a plusieurs. */
  subtitle?: string
}

export function TaskRow({
  action,
  onDone,
  onOpenPlant,
  showPlantName = true,
  subtitle,
}: TaskRowProps) {
  const due = formatDueDate(action.dueDate)

  const meta = [
    showPlantName ? action.plantName : null,
    subtitle,
    due.label,
    action.estimatedMinutes ? `${action.estimatedMinutes} min` : null,
  ].filter(Boolean)

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      {/* La photo identifie la plante ; l'icône, posée dessus, dit le geste. */}
      {action.plantPhotoUrl ? (
        <View className="h-14 w-14 overflow-hidden rounded-xl bg-sand-dark">
          <Image
            source={action.plantPhotoUrl}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
          <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-sand">
            <ActionIcon type={action.type} size={13} />
          </View>
        </View>
      ) : (
        <CareIconBadge>
          <ActionIcon type={action.type} />
        </CareIconBadge>
      )}

      <Pressable
        onPress={onOpenPlant}
        disabled={!onOpenPlant}
        accessibilityRole={onOpenPlant ? 'button' : undefined}
        accessibilityLabel={onOpenPlant ? `Ouvrir la fiche de ${action.plantName}` : undefined}
        className="flex-1 flex-row items-center gap-1"
      >
        <View className="flex-1 gap-0.5 overflow-hidden">
          <View className="flex-row items-center gap-1.5">
            <Text className="flex-shrink font-poppins text-body text-forest" numberOfLines={1}>
              {action.shortLabel}
            </Text>
            {/* Le planning mêle ce que le moteur calcule et ce que
                l'utilisateur a validé depuis un diagnostic : savoir d'où vient
                une tâche est ce qui rend le planning digne de confiance. */}
            {action.source === 'task' ? (
              <View className="shrink-0 flex-row items-center gap-1 rounded-full bg-lime/40 px-2 py-0.5">
                <Stethoscope size={11} color="#1E5631" />
                <Text className="font-raleway-medium text-caption text-forest">Diagnostic</Text>
              </View>
            ) : null}
          </View>
          <Text
            className={[
              'font-raleway text-caption',
              due.late ? 'text-destructive' : 'text-muted-foreground',
            ].join(' ')}
            numberOfLines={1}
          >
            {meta.join(' · ')}
          </Text>
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
