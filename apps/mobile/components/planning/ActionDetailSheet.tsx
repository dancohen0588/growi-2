import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Check, Leaf, MessageCircle, Stethoscope, X } from 'lucide-react-native'
import { ACTION_TYPE_LABELS, type GardenAction } from '@growi/shared'

import { ActionIcon } from '@/components/plants/CareIcon'
import { formatActionWhen } from '@/lib/dates'

export interface ActionDetailSheetProps {
  action: GardenAction | null
  onClose: () => void
  onDone?: () => void
  /** Ouvre la fiche de la plante — absent quand on y est déjà. */
  onOpenPlant?: () => void
  /** Ouvre le fil de discussion ancré sur cette action. */
  onAsk?: () => void
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-1">
      <Text className="font-poppins text-caption uppercase text-muted-foreground">{title}</Text>
      <Text className="font-raleway text-body leading-6 text-forest">{body}</Text>
    </View>
  )
}

/**
 * Le détail d'une action, en feuille montante — pour **toutes** les actions.
 *
 * La carte ne portait aucun recours : la consigne y était tronquée à trois
 * lignes, et les actions du moteur n'avaient rien à montrer du tout. C'est ici
 * que vivent désormais le *pourquoi* — écrit par la règle avec les données de
 * la plante — et le *comment faire*, repris du catalogue.
 */
export function ActionDetailSheet({
  action,
  onClose,
  onDone,
  onOpenPlant,
  onAsk,
}: ActionDetailSheetProps) {
  if (!action) return null

  const when = formatActionWhen(action)
  // Le « pourquoi » du moteur, ou la consigne de la tâche acceptée.
  const why = action.why ?? action.detail
  const title = action.shortLabel.endsWith('…') ? ACTION_TYPE_LABELS[action.type] : action.shortLabel

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-forest/40" onPress={onClose} accessibilityLabel="Fermer" />

      <View className="max-h-[80%] rounded-t-3xl bg-sand px-4 pb-10 pt-3">
        {/* Poignée : la feuille se ferme aussi en tapant le fond sombre. */}
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-sand-dark" />

        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-sand-dark">
            {action.plantPhotoUrl ? (
              <Image
                source={action.plantPhotoUrl}
                contentFit="cover"
                transition={150}
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text className="text-3xl">{action.plantEmoji || '🌿'}</Text>
            )}
          </View>

          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <ActionIcon type={action.type} size={16} />
              <Text className="flex-shrink font-poppins text-section text-forest" numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
              {action.plantName ? `${action.plantName} · ` : ''}
              {when.label}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={22} color="#1E5631" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-4 pb-4" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center gap-1.5 self-start rounded-full bg-lime/40 px-2.5 py-1">
            {action.source === 'task' ? (
              <Stethoscope size={12} color="#1E5631" />
            ) : (
              <Leaf size={12} color="#1E5631" />
            )}
            <Text className="font-raleway-medium text-caption text-forest">
              {action.source === 'task' ? 'Issue de ton diagnostic' : 'Proposée par Growi'}
            </Text>
          </View>

          {why ? <Section title="Pourquoi maintenant" body={why} /> : null}
          {/* Sans conseil catalogue, pas de section vide : mieux vaut une
              feuille courte qu'un intertitre qui ne tient pas sa promesse. */}
          {action.howTo ? <Section title="Comment faire" body={action.howTo} /> : null}
          {action.notes ? (
            <Text className="font-raleway text-secondary italic text-muted-foreground">
              {action.notes}
            </Text>
          ) : null}
        </ScrollView>

        {/* Les actions restent en bas, dans la zone du pouce. */}
        <View className="gap-2 pt-2">
          {onDone ? (
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel={`${title} : c'est fait`}
              className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-lime"
              style={({ pressed }) => (pressed ? { backgroundColor: '#a2cf6b' } : null)}
            >
              <Check size={20} color="#1E5631" />
              <Text className="font-raleway-semibold text-body text-forest">C&apos;est fait</Text>
            </Pressable>
          ) : null}

          <View className="flex-row gap-2">
            {onOpenPlant ? (
              <Pressable
                onPress={onOpenPlant}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir la fiche de ${action.plantName ?? 'la plante'}`}
                className="h-12 flex-1 items-center justify-center rounded-xl bg-sand-dark"
                style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
              >
                <Text className="font-raleway-semibold text-secondary text-forest">
                  Ouvrir la fiche
                </Text>
              </Pressable>
            ) : null}

            {onAsk ? (
              <Pressable
                onPress={onAsk}
                accessibilityRole="button"
                accessibilityLabel={`Demander à Growi : ${title}`}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-sand-dark"
                style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
              >
                <MessageCircle size={18} color="#1E5631" />
                <Text className="font-raleway-semibold text-secondary text-forest">
                  Demander à Growi
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}
