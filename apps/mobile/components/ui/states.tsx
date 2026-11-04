import { useEffect } from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useReducedMotion } from '@/lib/use-reduced-motion'

import { Button } from './Button'

/**
 * Les trois états qu'un écran doit savoir afficher en plus du succès.
 * Aucun écran de l'app ne doit pouvoir rester blanc.
 */

/**
 * Fait respirer ce qu'il enveloppe : un squelette immobile se lit comme un
 * écran cassé, pas comme un écran qui charge. Même rythme que `animate-pulse`
 * du web (opacité 1 → 0,5, 2 s), figé quand « Réduire les animations » est
 * actif.
 *
 * L'animation porte sur ce conteneur et non sur chaque `Skeleton` : le `style`
 * va sur l'`Animated.View`, l'apparence sur des `View` internes — même
 * découpage que `Toast.tsx` et `Pagination.tsx`, qui évite de faire dépendre
 * le rendu de l'interop entre NativeWind et les composants animés. `style`
 * sert à placer le conteneur (`{ flex: 1 }`, un `gap`).
 */
export function Pulse({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(opacity)
      opacity.value = 1
      return
    }
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      true,
    )
    return () => cancelAnimation(opacity)
  }, [reduced, opacity])

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={[style, pulse]}>{children}</Animated.View>
}

/**
 * Bloc gris qui préfigure la forme du contenu à venir. Il respire quand il
 * est placé dans un `Pulse` — ce que font déjà `CardSkeleton` et `ListSkeleton`.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <View className={`rounded-lg bg-sand-dark ${className}`} />
}

/** Silhouette d'une carte, pendant le chargement d'une liste. */
export function CardSkeleton() {
  return (
    <View className="rounded-xl bg-card p-4">
      <Pulse style={{ gap: 8 }}>
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </Pulse>
    </View>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3" accessibilityLabel="Chargement en cours">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  )
}

export interface ErrorStateProps {
  /** Dit quoi faire, jamais le code technique. */
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center justify-center gap-3 py-10 px-4">
      <Text className="text-4xl">🌧️</Text>
      <Text className="font-raleway text-body text-forest text-center">{message}</Text>
      {onRetry ? (
        <View className="mt-1 w-full max-w-xs">
          <Button label="Réessayer" variant="outline" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  )
}

export interface EmptyStateProps {
  emoji: string
  title: string
  /** Oriente vers l'action suivante — jamais « aucune donnée ». */
  message: string
  cta?: { label: string; onPress: () => void }
}

export function EmptyState({ emoji, title, message, cta }: EmptyStateProps) {
  return (
    <View className="items-center justify-center gap-3 py-10 px-4">
      <Text className="text-5xl">{emoji}</Text>
      <Text className="font-poppins text-section text-forest text-center">{title}</Text>
      <Text className="font-raleway text-body text-muted-foreground text-center max-w-xs">
        {message}
      </Text>
      {cta ? (
        <View className="mt-1 w-full max-w-xs">
          <Button label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  )
}
