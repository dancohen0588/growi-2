import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'

import { MonsteraLeaf } from '@/components/home/illustrations'

/**
 * Les conseils de la semaine, tels que les calcule `buildWeeklyTips`.
 *
 * Un bloc forest au milieu des cartes claires : il casse la succession de
 * surfaces sand et rappelle le haut de l'écran. La feuille en filigrane est
 * décorative, masquée aux lecteurs d'écran.
 */
export function WeeklyTips({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null

  return (
    <View className="gap-3">
      <Text className="font-poppins text-section text-forest">Conseils de la semaine</Text>

      <View className="gap-3 overflow-hidden rounded-2xl bg-forest p-4">
        <View pointerEvents="none" style={{ position: 'absolute', right: -60, bottom: -80 }}>
          <MonsteraLeaf size={200} />
        </View>

        {tips.map((tip, index) => (
          <View key={index} className="flex-row items-start gap-2.5">
            <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-lime">
              <Check size={14} color="#1E5631" strokeWidth={2.6} />
            </View>
            <Text className="flex-1 font-raleway text-secondary text-sand">{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
