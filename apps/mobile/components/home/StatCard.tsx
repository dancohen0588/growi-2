import { Pressable, Text, View } from 'react-native'
import type { IndicatorTone } from '@growi/shared'

/**
 * Un indicateur de l'accueil.
 *
 * La teinte vient d'`indicatorTone`, partagé avec le web : une même situation
 * se colore pareil des deux côtés. Elle est portée par un liseré et par le
 * chiffre, jamais par le fond — du texte sur lime ou sur sun manquerait de
 * contraste.
 */
const TONE: Record<IndicatorTone, { rail: string; value: string }> = {
  neutral: { rail: 'bg-border', value: 'text-muted-foreground' },
  good: { rail: 'bg-lime', value: 'text-forest' },
  warning: { rail: 'bg-sun', value: 'text-forest' },
  critical: { rail: 'bg-destructive', value: 'text-destructive' },
}

export interface StatCardProps {
  label: string
  value: number
  sub: string
  tone: IndicatorTone
  icon: React.ReactNode
  onPress?: () => void
}

export function StatCard({ label, value, sub, tone, icon, onPress }: StatCardProps) {
  const style = TONE[tone]

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} : ${value}, ${sub}`}
      className="flex-1 flex-row overflow-hidden rounded-xl bg-card"
      style={({ pressed }) => (pressed && onPress ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View className={`w-1 ${style.rail}`} />

      <View className="flex-1 gap-0.5 p-3">
        <View className="flex-row items-center gap-1.5">
          {icon}
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text className={`font-poppins-bold text-screen ${style.value}`}>{value}</Text>
        <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  )
}
