import { Pressable, Text, View } from 'react-native'

export interface Option<T extends string> {
  value: T
  label: string
}

export interface OptionGroupProps<T extends string> {
  label?: string
  options: readonly Option<T>[]
  value: T | undefined
  onChange: (value: T) => void
  error?: string
}

/**
 * Choix parmi quelques valeurs, sous forme de pastilles.
 *
 * Préféré à un sélecteur natif : les listes du domaine sont courtes (cinq
 * types de jardin, quatre emplacements) et tout reste visible d'un coup d'œil,
 * sans ouvrir de surcouche.
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: OptionGroupProps<T>) {
  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="font-raleway-medium text-secondary text-forest">{label}</Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              // h-11 : la pastille fait aussi office de zone tactile (44 pt).
              className={[
                'h-11 justify-center rounded-lg border px-4',
                selected ? 'border-forest bg-lime' : 'border-input bg-card',
              ].join(' ')}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
            >
              <Text
                className={[
                  'font-raleway-medium text-secondary',
                  selected ? 'text-forest' : 'text-muted-foreground',
                ].join(' ')}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {error ? (
        <Text className="font-raleway text-caption text-destructive">{error}</Text>
      ) : null}
    </View>
  )
}
