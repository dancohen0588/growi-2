import { Pressable, Text, View, type ViewProps } from 'react-native'

/** Élévation douce teintée forest, conforme au design system. */
const SHADOW = {
  shadowColor: '#1E5631',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const

export interface CardProps extends ViewProps {
  /** Rend la carte tactile ; la zone entière devient le point de contact. */
  onPress?: () => void
  accessibilityLabel?: string
}

export function Card({ children, onPress, accessibilityLabel, ...props }: CardProps) {
  const className = 'rounded-xl bg-card p-4'

  if (!onPress) {
    return (
      <View className={className} style={SHADOW} {...props}>
        {children}
      </View>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={className}
      style={({ pressed }) => [SHADOW, pressed ? { transform: [{ scale: 0.98 }] } : null]}
    >
      {children}
    </Pressable>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="font-poppins text-section text-forest" numberOfLines={2}>
      {children}
    </Text>
  )
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={3}>
      {children}
    </Text>
  )
}
