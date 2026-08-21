import { Switch, Text, View } from 'react-native'

export interface ToggleProps {
  label: string
  /** Ce que le réglage change concrètement — évite d'avoir à deviner. */
  hint?: string
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * Interrupteur d'un réglage.
 *
 * L'interrupteur natif est conservé — c'est celui que l'utilisateur connaît —
 * mais teinté aux couleurs de Growi.
 */
export function Toggle({ label, hint, value, onChange, disabled }: ToggleProps) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <Text className="font-raleway-medium text-secondary text-forest">{label}</Text>
        {hint ? (
          <Text className="font-raleway text-caption text-muted-foreground">{hint}</Text>
        ) : null}
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: 'hsl(139 20% 80%)', true: '#B4DD7F' }}
        thumbColor="#F9F7E8"
        ios_backgroundColor="hsl(139 20% 80%)"
      />
    </View>
  )
}
