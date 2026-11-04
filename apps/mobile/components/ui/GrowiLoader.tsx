import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  type SharedValue,
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { useReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Le loader de marque : la pousse du logo, animée.
 *
 * Pendant mobile de `apps/web/components/ui/growi-loader.tsx` — mêmes tracés,
 * mêmes durées, mêmes trois mouvements (maquettes : Claude Design « Growi —
 * Loader pousse ») :
 *
 * - `pousse` — la tige monte, les feuilles s'ouvrent puis s'effacent. Attentes
 *   longues : identification, diagnostic.
 * - `balance` — la pousse se balance depuis le pied. Un écran qui tarde.
 * - `souffle` — les feuilles respirent. Petites tailles (< 24 pt), dans un
 *   bouton.
 *
 * Pour le chargement ordinaire d'un écran, les squelettes de `states.tsx`
 * restent la règle : la pousse est pour les attentes qu'on doit habiter.
 *
 * Construction : trois calques `Svg` superposés (la tige, chaque feuille avec
 * sa nervure), chacun dans une `Animated.View`. Animer la vue plutôt que les
 * groupes SVG garde les transformations sur le thread UI sans dépendre du
 * support des `transform` animés dans react-native-svg ; seuls les traits
 * (`strokeDashoffset`) passent par des props animées. Une seule horloge `t`
 * (0 → 1, en boucle) pilote tout.
 */

export type GrowiLoaderMotion = 'pousse' | 'balance' | 'souffle'
/** Le fond sur lequel la pousse est posée. */
export type GrowiLoaderTone = 'sand' | 'lime' | 'forest'

// Valeurs de `tailwind.config.js` : des props SVG ne lisent pas les classes.
const TONES: Record<GrowiLoaderTone, { leaf: string; vein: string }> = {
  sand: { leaf: '#1E5631', vein: '#9CC86E' },
  lime: { leaf: '#1E5631', vein: '#B4DD7F' },
  forest: { leaf: '#B4DD7F', vein: '#2d7a47' },
}

const VIEW_BOX = '182 222 660 660'
const LEAF_LEFT =
  'M 512 528 C 498 420, 400 296, 207 278 C 197 400, 234 505, 318 550 C 388 586, 464 578, 512 562 Z'
const LEAF_RIGHT =
  'M 512 528 C 526 420, 624 296, 817 278 C 827 400, 790 505, 706 550 C 636 586, 560 578, 512 562 Z'
const STEM = 'M 512 833 L 512 530'
const VEIN_LEFT = 'M 488 527 L 275 338'
const VEIN_RIGHT = 'M 536 527 L 749 338'
const STEM_LENGTH = 310
const VEIN_LENGTH = 290

/** Points d'appui, en % du calque : base des feuilles, pied de la tige. */
const LEAF_ORIGIN = '50% 48.9%'
const FOOT_ORIGIN = '50% 92.6%'

const DURATION: Record<GrowiLoaderMotion, number> = { pousse: 2800, balance: 2600, souffle: 1600 }

const AnimatedPath = Animated.createAnimatedComponent(Path)

interface GrowiLoaderProps {
  motion?: GrowiLoaderMotion
  tone?: GrowiLoaderTone
  /** Côté en pt. */
  size?: number
  /**
   * Ce que lit le lecteur d'écran. `null` quand un texte voisin dit déjà ce
   * qui se passe.
   */
  label?: string | null
}

export function GrowiLoader({
  motion = 'balance',
  tone = 'sand',
  size = 48,
  label = 'Chargement en cours',
}: GrowiLoaderProps) {
  const reduced = useReducedMotion()
  const t = useSharedValue(0)
  const { leaf, vein } = TONES[tone]

  useEffect(() => {
    if (reduced) {
      cancelAnimation(t)
      t.value = 0
      return
    }
    t.value = 0
    t.value = withRepeat(withTiming(1, { duration: DURATION[motion], easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [motion, reduced, t])

  // `still` : réglage « Réduire les animations » → la pousse entière, immobile.
  const still = reduced

  const plantStyle = useAnimatedStyle(() => {
    if (still || motion !== 'balance') return { transform: [{ rotate: '0deg' }] }
    return { transform: [{ rotate: `${Math.sin(t.value * 2 * Math.PI) * 5}deg` }] }
  })

  const leftStyle = useLeafStyle(t, 'left', motion, still)
  const rightStyle = useLeafStyle(t, 'right', motion, still)

  const stemStyle = useAnimatedStyle(() => {
    if (still || motion !== 'pousse') return { opacity: 1 }
    return { opacity: interpolate(t.value, [0.86, 0.96], [1, 0], Extrapolation.CLAMP) }
  })

  const stemProps = useAnimatedProps(() => ({
    strokeDashoffset:
      still || motion !== 'pousse'
        ? 0
        : interpolate(t.value, [0, 0.26], [STEM_LENGTH, 0], Extrapolation.CLAMP),
  }))

  const veinProps = useAnimatedProps(() => ({
    strokeDashoffset:
      still || motion !== 'pousse'
        ? 0
        : interpolate(t.value, [0.52, 0.7], [VEIN_LENGTH, 0], Extrapolation.CLAMP),
  }))

  const layer = { position: 'absolute' as const, top: 0, left: 0, width: size, height: size }

  return (
    <View
      style={{ width: size, height: size }}
      accessible={label !== null}
      accessibilityRole={label !== null ? 'progressbar' : undefined}
      accessibilityLabel={label ?? undefined}
      importantForAccessibility={label === null ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={label === null}
    >
      <Animated.View style={[layer, { transformOrigin: FOOT_ORIGIN }, plantStyle]}>
        <Animated.View style={[layer, stemStyle]}>
          <Svg width={size} height={size} viewBox={VIEW_BOX}>
            <AnimatedPath
              d={STEM}
              stroke={leaf}
              strokeWidth={46}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={STEM_LENGTH}
              animatedProps={stemProps}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, { transformOrigin: LEAF_ORIGIN }, leftStyle]}>
          <Svg width={size} height={size} viewBox={VIEW_BOX}>
            <Path d={LEAF_LEFT} fill={leaf} />
            <AnimatedPath
              d={VEIN_LEFT}
              stroke={vein}
              strokeWidth={16}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={VEIN_LENGTH}
              animatedProps={veinProps}
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, { transformOrigin: LEAF_ORIGIN }, rightStyle]}>
          <Svg width={size} height={size} viewBox={VIEW_BOX}>
            <Path d={LEAF_RIGHT} fill={leaf} />
            <AnimatedPath
              d={VEIN_RIGHT}
              stroke={vein}
              strokeWidth={16}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={VEIN_LENGTH}
              animatedProps={veinProps}
            />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

/** Une feuille : son ouverture (pousse), sa respiration (souffle), son frémissement (balance). */
function useLeafStyle(
  t: SharedValue<number>,
  side: 'left' | 'right',
  motion: GrowiLoaderMotion,
  still: boolean,
) {
  return useAnimatedStyle(() => {
    if (still) return { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] }
    const v = t.value
    if (motion === 'pousse') {
      // La feuille droite s'ouvre un dixième de seconde après la gauche.
      const start = side === 'left' ? 0.2 : 0.24
      const sign = side === 'left' ? 1 : -1
      const steps = [start, start + 0.32, start + 0.4]
      const scale = interpolate(v, steps, [0.01, 1, 1], Extrapolation.CLAMP)
      const rotate = interpolate(v, steps, [28 * sign, -3 * sign, 0], Extrapolation.CLAMP)
      const opacity = interpolate(v, [start, start + 0.1, 0.86, 0.96], [0, 1, 1, 0], Extrapolation.CLAMP)
      return { opacity, transform: [{ scale }, { rotate: `${rotate}deg` }] }
    }
    if (motion === 'souffle') {
      const breath = (1 - Math.cos(v * 2 * Math.PI)) / 2 // 0 → 1 → 0
      return { opacity: 0.6 + 0.4 * breath, transform: [{ scale: 0.9 + 0.1 * breath }, { rotate: '0deg' }] }
    }
    // balance : à contretemps de la tige, comme portées par l'air.
    const flutter = -3.5 * Math.sin(v * 2 * Math.PI)
    return { opacity: 1, transform: [{ scale: 1 }, { rotate: `${flutter}deg` }] }
  })
}
