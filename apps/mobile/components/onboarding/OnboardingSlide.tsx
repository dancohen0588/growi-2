import { Text, View } from 'react-native'
import { Image } from 'expo-image'

import type { OnboardingSlideContent } from './slides'

interface OnboardingSlideProps {
  slide: OnboardingSlideContent
  /** Largeur de la fenêtre : c'est elle qui fait la pagination de la liste. */
  width: number
}

/**
 * Une page de la présentation : le visuel, le titre, le paragraphe.
 *
 * L'image prend la place restante (`flex-1` + `contain`) plutôt qu'une hauteur
 * fixe : sur un iPhone SE elle se réduit d'elle-même et le texte, les points et
 * le CTA restent visibles sans scroll.
 *
 * Pas de placeholder : ces visuels sont embarqués dans le bundle via
 * `require()`, il n'y a ni requête réseau ni état de chargement à couvrir. Le
 * fond de l'écran (sable ou forest) reste visible en attendant le décodage.
 */
export function OnboardingSlide({ slide, width }: OnboardingSlideProps) {
  const dark = slide.tone === 'dark'

  return (
    <View style={{ width }} className="flex-1 px-4">
      {/* Décoratif : le titre et le paragraphe disent déjà tout, un lecteur
          d'écran n'a rien à annoncer de plus. */}
      <Image
        source={slide.image}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
        style={{ flex: 1, width: '100%' }}
      />

      <View className="items-center gap-3 pt-6 self-center" style={{ maxWidth: 320 }}>
        <Text
          numberOfLines={3}
          className={`font-poppins text-screen text-center ${dark ? 'text-sand' : 'text-forest'}`}
        >
          {slide.title}
        </Text>
        {/* Police très agrandie sur un petit écran : mieux vaut une coupure
            nette que du texte poussé sous le CTA. */}
        <Text
          numberOfLines={4}
          className={`font-poppins-regular text-body text-center ${
            dark ? 'text-sand/80' : 'text-muted-foreground'
          }`}
        >
          {slide.text}
        </Text>
      </View>
    </View>
  )
}
