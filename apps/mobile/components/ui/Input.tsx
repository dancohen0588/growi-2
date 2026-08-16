import { forwardRef, useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'

export interface InputProps extends Omit<TextInputProps, 'style' | 'className'> {
  label?: string
  /** Message d'erreur : dit quoi faire, jamais un code technique. */
  error?: string
  hint?: string
  /** Affiche l'œil permettant de révéler le mot de passe. */
  revealable?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, revealable = false, secureTextEntry, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false)
  const hidden = secureTextEntry && !revealed

  return (
    <View className="w-full gap-1.5">
      {label ? (
        <Text className="font-raleway-medium text-secondary text-forest">{label}</Text>
      ) : null}

      <View
        className={[
          'flex-row items-center rounded-lg border bg-card px-4',
          // La hauteur du champ vaut aussi zone tactile : 48 > 44.
          'h-12',
          error ? 'border-destructive' : 'border-input',
        ].join(' ')}
      >
        <TextInput
          ref={ref}
          className="flex-1 font-raleway text-body text-forest"
          placeholderTextColor="hsl(139 20% 40%)"
          secureTextEntry={hidden}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...props}
        />

        {revealable && secureTextEntry !== undefined ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {revealed ? (
              <EyeOff size={20} color="#1E5631" />
            ) : (
              <Eye size={20} color="#1E5631" />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="font-raleway text-caption text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="font-raleway text-caption text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  )
})
