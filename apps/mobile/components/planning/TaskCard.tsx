import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Check, Clock, MessageCircle, Stethoscope } from 'lucide-react-native'
import type { GardenAction } from '@growi/shared'

import { ActionIcon } from '@/components/plants/CareIcon'

/** Largeur d'une carte du carrousel — la suivante déborde volontairement. */
export const TASK_CARD_WIDTH = 268
export const TASK_CARD_GAP = 12

export interface TaskCardProps {
  action: GardenAction
  late: boolean
  /** Nom du jardin, affiché seulement quand l'utilisateur en a plusieurs. */
  gardenName?: string
  onDone: () => void
  onOpenPlant?: () => void
  /** Ouvre le fil de discussion sur cette tâche — « Comment faire ? ». */
  onAsk?: () => void
}

/**
 * Carte d'une tâche prioritaire : grande photo, geste en titre, validation
 * pleine largeur.
 *
 * La photo fait le travail que le texte faisait mal — reconnaître la plante
 * avant de lire. À défaut, l'emoji tient la place sur le fond sable.
 */
export function TaskCard({ action, late, gardenName, onDone, onOpenPlant, onAsk }: TaskCardProps) {
  const meta = [
    gardenName,
    action.estimatedMinutes ? `${action.estimatedMinutes} min` : null,
  ].filter(Boolean)

  return (
    <View
      className="overflow-hidden rounded-2xl bg-card"
      style={{ width: TASK_CARD_WIDTH }}
    >
      <Pressable
        onPress={onOpenPlant}
        disabled={!onOpenPlant}
        accessibilityRole={onOpenPlant ? 'button' : undefined}
        accessibilityLabel={onOpenPlant ? `Ouvrir la fiche de ${action.plantName}` : undefined}
      >
        <View className="h-44 items-center justify-center bg-sand-dark">
          {action.plantPhotoUrl ? (
            <Image
              source={action.plantPhotoUrl}
              contentFit="cover"
              transition={150}
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text className="text-6xl">{action.plantEmoji || '🌿'}</Text>
          )}

          {/* Voile sombre : le nom doit rester lisible sur une photo claire. */}
          <View className="absolute inset-x-0 bottom-0 h-20 bg-forest/45" />
          <Text
            className="absolute bottom-3 left-4 right-4 font-poppins text-section text-sand"
            numberOfLines={1}
            // Ceinture et bretelles : sur une photo très claire, l'ombre porte
            // le texte même là où le voile ne suffit pas.
            style={{ textShadowColor: 'rgba(20,45,28,0.55)', textShadowRadius: 4 }}
          >
            {action.plantName ?? 'Ma plante'}
          </Text>
        </View>
      </Pressable>

      <View className="gap-3 p-4">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <ActionIcon type={action.type} size={16} />
            <Text className="flex-shrink font-poppins text-body text-forest" numberOfLines={1}>
              {action.shortLabel}
            </Text>
            {action.source === 'task' ? (
              <View className="shrink-0 flex-row items-center gap-1 rounded-full bg-lime/40 px-2 py-0.5">
                <Stethoscope size={11} color="#1E5631" />
                <Text className="font-raleway-medium text-caption text-forest">Diagnostic</Text>
              </View>
            ) : null}
          </View>

          {/* La consigne complète d'une recommandation : le titre seul ne
              suffit pas à agir (dosage, moment de la journée). */}
          {action.detail ? (
            <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={3}>
              {action.detail}
            </Text>
          ) : null}

          {late ? (
            <View className="flex-row items-center gap-1.5">
              <Clock size={13} color="hsl(0 84% 60%)" />
              <Text className="font-raleway-medium text-caption text-destructive">
                En retard
              </Text>
            </View>
          ) : meta.length > 0 ? (
            <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
              {meta.join(' · ')}
            </Text>
          ) : null}
        </View>

        {/* Valider reste l'action principale ; demander comment faire est
            juste à côté, pour qui ne sait pas par où commencer. */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel={`${action.shortLabel} : c'est fait`}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-lime"
            style={({ pressed }) => (pressed ? { backgroundColor: '#a2cf6b' } : null)}
          >
            <Check size={19} color="#1E5631" />
            <Text className="font-raleway-semibold text-body text-forest">C'est fait</Text>
          </Pressable>

          {onAsk ? (
            <Pressable
              onPress={onAsk}
              accessibilityRole="button"
              accessibilityLabel={`Comment faire : ${action.shortLabel}`}
              className="h-12 w-12 items-center justify-center rounded-xl bg-sand-dark"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <MessageCircle size={20} color="#1E5631" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}
