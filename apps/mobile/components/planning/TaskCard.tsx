import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Check, Clock, Stethoscope } from 'lucide-react-native'
import type { GardenAction } from '@growi/shared'

import { ActionIcon } from '@/components/plants/CareIcon'
import { formatActionWhen } from '@/lib/dates'

/** Largeur d'une carte du carrousel — la suivante déborde volontairement. */
export const TASK_CARD_WIDTH = 268
export const TASK_CARD_GAP = 12

export interface TaskCardProps {
  action: GardenAction
  /** Nom du jardin, affiché seulement quand l'utilisateur en a plusieurs. */
  gardenName?: string
  onDone: () => void
  /** Ouvre la feuille de détail — par le bouton, ou par un tap sur la carte. */
  onOpenDetail: () => void
}

/**
 * Carte d'une tâche prioritaire : photo, verbe, une ligne, deux boutons.
 *
 * La photo fait le travail que le texte faisait mal — reconnaître la plante
 * avant de lire. À défaut, l'emoji tient la place sur le fond sable. La
 * consigne, elle, a quitté la carte : elle y était coupée à trois lignes sans
 * recours, et personne ne la lisait avant d'agir.
 */
export function TaskCard({ action, gardenName, onDone, onOpenDetail }: TaskCardProps) {
  const when = formatActionWhen(action)
  // Le « pourquoi » de la règle tient lieu de contexte ; sinon l'échéance,
  // et le jardin quand l'utilisateur en a plusieurs.
  const context = action.why ?? action.detail ?? [gardenName, when.label].filter(Boolean).join(' · ')

  return (
    <View
      className="overflow-hidden rounded-2xl bg-card"
      style={{ width: TASK_CARD_WIDTH }}
    >
      <Pressable
        onPress={onOpenDetail}
        accessibilityRole="button"
        accessibilityLabel={`Détails : ${action.label}`}
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

          {/* Une seule ligne de contexte : le reste est dans la feuille. */}
          <View className="flex-row items-center gap-1.5">
            {when.late ? <Clock size={13} color="hsl(0 84% 60%)" /> : null}
            <Text
              className={[
                'flex-1 font-raleway text-caption',
                when.late ? 'text-destructive' : 'text-muted-foreground',
              ].join(' ')}
              numberOfLines={1}
            >
              {context}
            </Text>
          </View>
        </View>

        {/* Valider reste l'action principale ; « Détails » est un vrai bouton
            à côté, jamais un lien souligné qu'on cherche du regard. */}
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

          <Pressable
            onPress={onOpenDetail}
            accessibilityRole="button"
            accessibilityLabel={`Détails : ${action.shortLabel}`}
            className="h-12 items-center justify-center rounded-xl bg-sand-dark px-4"
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
          >
            <Text className="font-raleway-semibold text-secondary text-forest">Détails</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
