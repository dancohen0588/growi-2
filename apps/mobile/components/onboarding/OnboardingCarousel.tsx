import { useCallback, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { X } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { markOnboardingSeen } from '@/lib/onboarding-storage'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { useSession } from '@/store/session'

import { OnboardingSlide } from './OnboardingSlide'
import { Pagination } from './Pagination'
import { SLIDES } from './slides'

/**
 * Les deux fonds de la présentation.
 *
 * Seul endroit de l'onboarding où une couleur est écrite en dur : une
 * interpolation a besoin des valeurs, pas d'une classe. Elles doivent rester
 * synchrones avec `sand` et `forest` du tailwind.config.js.
 */
const BACKGROUND = { light: '#F9F7E8', dark: '#1E5631' } as const
const FADE = 200

/** Teinte de l'icône de fermeture, qui ne peut pas passer par une classe. */
const CLOSE_TINT = { light: '#1E5631', dark: '#F9F7E8' } as const

/**
 * La présentation du premier lancement.
 *
 * Swipe en `FlatList` `pagingEnabled` plutôt qu'une bibliothèque de carrousel :
 * cinq pages plein écran n'en demandent pas une, et le projet est en CNG — un
 * module natif de plus imposerait un nouveau build.
 *
 * Les sorties passent toutes par `leave()` : on marque la présentation vue puis
 * on `replace`, jamais `push`, pour qu'un retour arrière ne la ramène pas.
 */
export function OnboardingCarousel() {
  const router = useRouter()
  const setOnboardingSeen = useSession((s) => s.setOnboardingSeen)
  const { width } = useWindowDimensions()
  const reducedMotion = useReducedMotion()

  // Rejouée depuis le profil : l'utilisateur est déjà connecté, il n'y a ni
  // compte à créer ni drapeau à poser — seulement une sortie.
  const { from } = useLocalSearchParams<{ from?: string }>()
  const replay = from === 'profil'

  const listRef = useRef<FlatList<(typeof SLIDES)[number]>>(null)
  const [index, setIndex] = useState(0)

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  // FlatList exige des références stables : redéfinir ces deux valeurs à chaque
  // rendu lui fait lever « Changing onViewableItemsChanged on the fly ».
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 })
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]
    if (first?.index != null) setIndex(first.index)
  })

  const goNext = useCallback(() => {
    listRef.current?.scrollToIndex({ index: index + 1, animated: !reducedMotion })
  }, [index, reducedMotion])

  const leave = useCallback(
    async (to: '/(auth)/login' | '/(auth)/register') => {
      await markOnboardingSeen()
      setOnboardingSeen(true)
      router.replace(to)
    },
    [router, setOnboardingSeen],
  )

  /** Sortie du mode « revoir » : on revient d'où l'on vient, sans rien écrire. */
  const close = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/accueil')
  }, [router])

  const dark = slide.tone === 'dark'

  // Le fond suit le slide courant. La bascule sèche entre sable et forest est
  // brutale sur un écran plein ; 200 ms suffisent à l'adoucir sans retarder.
  const background = useAnimatedStyle(() => ({
    backgroundColor: withTiming(BACKGROUND[dark ? 'dark' : 'light'], {
      duration: reducedMotion ? 0 : FADE,
    }),
  }))

  return (
    <Animated.View style={[{ flex: 1 }, background]}>
      {/* Le layout racine pose `dark` ; le dernier écran est sur fond forest et
          demande l'inverse. Au démontage, le réglage racine reprend. */}
      <StatusBar style={dark ? 'light' : 'dark'} />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* Hauteur réservée même sans bouton : sinon les pages sautent en
            arrivant sur le dernier écran. */}
        <View className="h-11 flex-row items-center justify-between px-4">
          {replay ? (
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Fermer la présentation"
              // Marge négative : la zone de 44 pt déborde du padding d'écran
              // pour que l'icône, elle, reste alignée sur la marge de 16.
              className="-ml-2.5 h-11 w-11 items-center justify-center"
            >
              <X size={24} color={CLOSE_TINT[dark ? 'dark' : 'light']} />
            </Pressable>
          ) : (
            <View />
          )}

          {!replay && !isLast ? (
            <Pressable
              onPress={() => void leave('/(auth)/login')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Passer la présentation"
            >
              <Text
                className={`font-poppins-medium text-body ${
                  dark ? 'text-sand/80' : 'text-muted-foreground'
                }`}
              >
                Passer
              </Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OnboardingSlide slide={item} width={width} />}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          // Sans cela, `scrollToIndex` échoue sur une page pas encore montée.
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
          className="flex-1"
        />

        <View className="gap-6 px-4 pb-2 pt-6">
          <Pagination
            count={SLIDES.length}
            index={index}
            tone={slide.tone}
            animate={!reducedMotion}
          />

          {isLast && replay ? (
            <Button label="C'est parti" size="lg" font="poppins" onPress={close} />
          ) : isLast ? (
            <View className="gap-2">
              <Button
                label="Créer mon compte"
                size="lg"
                font="poppins"
                onPress={() => void leave('/(auth)/register')}
              />
              <Button
                label="J'ai déjà un compte"
                variant="ghost-inverse"
                size="lg"
                font="poppins"
                onPress={() => void leave('/(auth)/login')}
              />
            </View>
          ) : (
            <Button label="Suivant" size="lg" font="poppins" onPress={goNext} />
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  )
}
