import { Pressable, Text, View } from 'react-native'
import { CloudOff } from 'lucide-react-native'

/**
 * Pas de météo, et pourquoi.
 *
 * Le cas courant est l'absence de position : le message de l'API le dit déjà,
 * on y ajoute le chemin pour la renseigner.
 */
export function WeatherUnavailable({
  reason,
  onOpenProfile,
}: {
  reason: string
  onOpenProfile: () => void
}) {
  return (
    <View className="rounded-2xl border border-border bg-card p-4 gap-3">
      <View className="flex-row items-start gap-3">
        <CloudOff size={22} color="hsl(139 20% 40%)" />
        <Text className="flex-1 font-raleway text-secondary text-muted-foreground">{reason}</Text>
      </View>

      <Pressable onPress={onOpenProfile} accessibilityRole="button" hitSlop={8}>
        <Text className="font-raleway-semibold text-secondary text-forest underline">
          Renseigner ma position
        </Text>
      </Pressable>
    </View>
  )
}
