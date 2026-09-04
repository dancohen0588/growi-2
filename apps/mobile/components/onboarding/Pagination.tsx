import { View } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

interface PaginationProps {
  count: number
  index: number
  /** Sur fond forest, les points inactifs passent en sable translucide. */
  tone: 'light' | 'dark'
  /** `false` quand « Réduire les animations » est actif : la pilule saute. */
  animate: boolean
}

const DOT = 8
const ACTIVE_DOT = 24
const DURATION = 200

/**
 * Le `style` va sur l'`Animated.View`, la couleur sur une `View` interne —
 * même découpage que `Toast.tsx`, qui évite de faire dépendre l'apparence de
 * l'interop entre NativeWind et les composants animés.
 */
function Dot({
  active,
  tone,
  animate,
}: {
  active: boolean
  tone: 'light' | 'dark'
  animate: boolean
}) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? ACTIVE_DOT : DOT, { duration: animate ? DURATION : 0 }),
  }))

  return (
    <Animated.View style={[{ height: DOT, borderRadius: DOT / 2, overflow: 'hidden' }, style]}>
      <View
        className={[
          'flex-1 rounded-full',
          active ? 'bg-lime' : tone === 'dark' ? 'bg-sand/35' : 'bg-border',
        ].join(' ')}
      />
    </Animated.View>
  )
}

/**
 * Où l'on en est dans la présentation.
 *
 * Le point actif s'étire en pilule lime plutôt que de seulement changer de
 * couleur : la position reste lisible sans distinguer les teintes.
 */
export function Pagination({ count, index, tone, animate }: PaginationProps) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessibilityRole="progressbar"
      accessibilityLabel={`Écran ${index + 1} sur ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} tone={tone} animate={animate} />
      ))}
    </View>
  )
}
