import { Pressable, Text, View } from 'react-native'
import { ArrowRight, Camera } from 'lucide-react-native'

import { Sprout } from '@/components/home/illustrations'

/**
 * L'appel à identifier une plante : l'élément le plus lumineux de l'accueil.
 *
 * Posé à cheval sur le bas du hero (marge négative côté écran), avec une pousse
 * qui en sort — c'est elle qui attire l'œil vers le bouton. Lime en fond, texte
 * forest : le lime n'a pas le contraste d'un texte, il reste une surface.
 */
export function IdentifyCta({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Identifier une plante en photo"
      accessibilityHint="Ouvre l'appareil photo"
      className="min-h-[76px] flex-row items-center gap-3.5 rounded-2xl border-2 border-forest bg-lime px-4"
      style={({ pressed }) => [
        {
          shadowColor: '#1E5631',
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
        pressed ? { transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -44, right: 64 }}
      >
        <Sprout size={64} />
      </View>

      <View className="h-12 w-12 items-center justify-center rounded-full bg-forest">
        <Camera size={24} color="#B4DD7F" />
      </View>

      <View className="flex-1 gap-0.5 py-3">
        <Text className="font-poppins-bold text-body text-forest" style={{ fontSize: 17 }}>
          Identifier une plante
        </Text>
        <Text className="font-raleway-medium text-caption text-forest-light">
          Une photo, et Growi te dit tout sur elle
        </Text>
      </View>

      <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">
        <ArrowRight size={18} color="#1E5631" />
      </View>
    </Pressable>
  )
}
