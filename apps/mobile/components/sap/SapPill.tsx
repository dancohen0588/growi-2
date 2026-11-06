import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'

import { useSapSummary } from '@/lib/queries/sap'

import { SapDrop } from './SapDrop'

/**
 * La sève, en pastille dans l'en-tête de l'Accueil — à côté de la cloche.
 *
 * Rien tant que la lecture n'a pas abouti : une pastille vide ou un « 0 »
 * provisoire mentiraient, et la carte plus bas porte déjà les états.
 */
export function SapPill() {
  const router = useRouter()
  const summary = useSapSummary()

  if (!summary.data) return null
  const { total } = summary.data

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/accueil/seve')}
      accessibilityRole="button"
      accessibilityLabel={`Ta sève : ${total}. Ouvrir`}
      className="h-11 flex-row items-center gap-1.5 rounded-full bg-sand pl-2 pr-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : null)}
    >
      <SapDrop size={24} />
      <Text className="font-poppins-bold text-body text-forest">{total}</Text>
    </Pressable>
  )
}
