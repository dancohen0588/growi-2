import { Text, View } from 'react-native'
import { CheckCircle2, Leaf } from 'lucide-react-native'

/** Les conseils de la semaine, tels que les calcule `buildWeeklyTips`. */
export function WeeklyTips({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null

  return (
    <View className="rounded-2xl border border-border bg-card p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Leaf size={18} color="#1E5631" />
        <Text className="font-poppins text-section text-forest">Conseils de la semaine</Text>
      </View>

      <View className="gap-2.5">
        {tips.map((tip, index) => (
          <View key={index} className="flex-row items-start gap-2">
            <CheckCircle2 size={16} color="#B4DD7F" />
            <Text className="flex-1 font-raleway text-secondary text-forest">{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
