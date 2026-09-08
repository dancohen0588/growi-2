import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { GardenAction } from '@growi/shared'

export interface DoneTodayListProps {
  actions: GardenAction[]
  onUndo: (action: GardenAction) => void
}

/** « 8:12 » — l'heure du geste, seule information utile pour le reconnaître. */
function timeOf(action: GardenAction): string {
  if (!action.doneAt) return ''
  const date = new Date(action.doneAt)
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Ce qui a été fait aujourd'hui, avec un « Annuler » qui annule vraiment.
 *
 * La liste vient du journal des plantes et non d'un état local : elle survit
 * donc à la fermeture de l'app, et « Annuler » efface le geste au lieu de
 * faire disparaître une ligne à l'écran.
 */
export function DoneTodayList({ actions, onUndo }: DoneTodayListProps) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  return (
    <View className="gap-2 px-4">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${actions.length} gestes faits aujourd'hui`}
        className="h-11 flex-row items-center gap-2"
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
      >
        <Text className="flex-1 font-raleway text-secondary text-muted-foreground">
          ✅ {actions.length} geste{actions.length > 1 ? 's' : ''} fait
          {actions.length > 1 ? 's' : ''} aujourd&apos;hui
        </Text>
        <Text className="font-raleway-semibold text-secondary text-forest">
          {open ? 'Masquer' : 'Voir'}
        </Text>
      </Pressable>

      {open
        ? actions.map((action) => (
            <View
              key={action.id}
              className="flex-row items-center gap-3 rounded-xl bg-card px-3 py-2.5 opacity-80"
            >
              <Text className="text-lg">{action.plantEmoji || '🌿'}</Text>
              <View className="flex-1 gap-0.5">
                <Text
                  className="font-raleway text-secondary text-forest line-through"
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
                {timeOf(action) ? (
                  <Text className="font-raleway text-caption text-muted-foreground">
                    Fait à {timeOf(action)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => onUndo(action)}
                accessibilityRole="button"
                accessibilityLabel={`Annuler : ${action.label}`}
                hitSlop={8}
                className="h-11 items-center justify-center px-2"
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
              >
                <Text className="font-raleway-semibold text-secondary text-forest">Annuler</Text>
              </Pressable>
            </View>
          ))
        : null}
    </View>
  )
}
