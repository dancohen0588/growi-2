import { Pressable, Text, View } from 'react-native'

/**
 * Même sélection que le formulaire web (`PlantForm`), pour que les deux
 * plateformes proposent les mêmes symboles.
 */
export const PLANT_EMOJIS = [
  '🌿',
  '🌹',
  '🍅',
  '🌱',
  '🌸',
  '🌺',
  '🌻',
  '🎋',
  '🌵',
  '🍋',
  '🍃',
  '💜',
] as const

export interface EmojiPickerProps {
  label?: string
  value: string | undefined
  onChange: (emoji: string) => void
}

/**
 * Grille de choix plutôt qu'un champ texte : sur mobile, saisir un emoji
 * suppose d'ouvrir le clavier emoji et de le chercher, alors que le besoin se
 * limite à une poignée de symboles de jardin.
 */
export function EmojiPicker({ label, value, onChange }: EmojiPickerProps) {
  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="font-raleway-medium text-secondary text-forest">{label}</Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {PLANT_EMOJIS.map((emoji) => {
          const selected = emoji === value
          return (
            <Pressable
              key={emoji}
              onPress={() => onChange(emoji)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Emoji ${emoji}`}
              // 44 pt : la case est elle-même la zone tactile.
              className={[
                'h-11 w-11 items-center justify-center rounded-lg border',
                selected ? 'border-forest bg-lime' : 'border-transparent bg-card',
              ].join(' ')}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.95 }] } : null)}
            >
              <Text className="text-xl">{emoji}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
