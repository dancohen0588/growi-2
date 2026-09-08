import { useState } from 'react'
import { Alert, Modal, Pressable, Text, View } from 'react-native'
import { MoreHorizontal } from 'lucide-react-native'
import { ACTION_TYPE_LABELS, type ActionType, type GardenAction } from '@growi/shared'

export interface SectionMenuProps {
  /** Les actions de la section, celles que « Tout marquer fait » va inscrire. */
  actions: GardenAction[]
  onDoneAll: () => void
  /** Absent sur « Ce mois-ci » : on n'ignore que la journée. */
  onClearToday?: () => void
}

/** « 5 arrosages et 1 traitement » — dire ce qui sera écrit au journal. */
function describe(actions: GardenAction[]): string {
  const counts = new Map<ActionType, number>()
  for (const action of actions) counts.set(action.type, (counts.get(action.type) ?? 0) + 1)

  const parts = [...counts.entries()].map(
    ([type, count]) => `${count} ${ACTION_TYPE_LABELS[type].toLowerCase()}${count > 1 ? 's' : ''}`,
  )

  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`
}

/**
 * Le menu d'une section : tout marquer fait, ou ignorer pour aujourd'hui.
 *
 * Deux gestes distincts et non un seul « vider » : l'un écrit les gestes au
 * journal des plantes, l'autre n'écrit rien. Les confondre ferait mentir le
 * journal, dont on tire ensuite la date du dernier arrosage.
 */
export function SectionMenu({ actions, onDoneAll, onClearToday }: SectionMenuProps) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  const engineActions = actions.filter((action) => action.source !== 'task')
  const taskActions = actions.length - engineActions.length

  const confirmDoneAll = () =>
    Alert.alert(
      'Tout marquer comme fait ?',
      `Les ${actions.length} actions seront notées faites et inscrites au journal de tes plantes : ${describe(actions)}.\n\nTu pourras annuler chaque geste depuis « Fait aujourd'hui ».`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: onDoneAll },
      ],
    )

  const confirmClear = () =>
    Alert.alert(
      "Ignorer pour aujourd'hui ?",
      `Les ${engineActions.length} actions proposées par Growi seront masquées jusqu'à demain. Rien ne sera inscrit au journal de tes plantes.` +
        (taskActions > 0
          ? `\n\n${taskActions === 1 ? "L'action issue de ton diagnostic reste affichée." : `Les ${taskActions} actions issues de tes diagnostics restent affichées.`}`
          : ''),
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ignorer', onPress: onClearToday },
      ],
    )

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Actions groupées de la section"
        hitSlop={12}
        className="h-11 w-11 items-center justify-center"
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
      >
        <MoreHorizontal size={20} color="#1E5631" />
      </Pressable>

      {/* Feuille plutôt que menu flottant : la liste est courte et le pouce
          l'atteint en bas, là où un menu ancré au titre serait tout en haut. */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 bg-forest/40"
          onPress={() => setOpen(false)}
          accessibilityLabel="Fermer"
        />

        <View className="gap-2 rounded-t-3xl bg-sand px-4 pb-10 pt-3">
          <View className="mb-1 h-1 w-10 self-center rounded-full bg-sand-dark" />

          <Pressable
            onPress={() => {
              setOpen(false)
              confirmDoneAll()
            }}
            accessibilityRole="button"
            className="h-14 flex-row items-center gap-3 rounded-xl bg-card px-4"
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
          >
            <Text className="text-lg">✅</Text>
            <Text className="font-raleway-semibold text-body text-forest">
              Tout marquer comme fait
            </Text>
          </Pressable>

          {onClearToday ? (
            <Pressable
              onPress={() => {
                setOpen(false)
                confirmClear()
              }}
              accessibilityRole="button"
              className="h-14 flex-row items-center gap-3 rounded-xl bg-card px-4"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <Text className="text-lg">🙈</Text>
              <Text className="font-raleway-semibold text-body text-forest">
                Ignorer pour aujourd&apos;hui
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            className="h-14 items-center justify-center rounded-xl"
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
          >
            <Text className="font-raleway-semibold text-body text-muted-foreground">Annuler</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  )
}
