import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from './Button'

export interface ScreenPlaceholderProps {
  title: string
  emoji: string
  /** Texte d'état vide : oriente vers l'action suivante, jamais « aucune donnée ». */
  message: string
  cta?: { label: string; onPress: () => void }
}

/**
 * État vide provisoire des onglets, en attendant leur implémentation (phase 5).
 *
 * Un écran ne doit jamais afficher de blanc : même inachevé, il annonce ce
 * qu'il fera et reste dans le ton de l'app.
 */
export function ScreenPlaceholder({ title, emoji, message, cta }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-2">
        <Text className="font-poppins-bold text-screen text-forest">{title}</Text>

        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-5xl">{emoji}</Text>
          <Text className="font-raleway text-body text-muted-foreground text-center max-w-xs">
            {message}
          </Text>
          {cta ? (
            <View className="mt-2 w-full max-w-xs">
              <Button label={cta.label} onPress={cta.onPress} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  )
}
