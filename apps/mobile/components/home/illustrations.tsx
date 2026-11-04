import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg'

/**
 * Les illustrations de l'accueil, dessinées en vectoriel avec les seules
 * couleurs du design system : rien à télécharger, net à toute densité d'écran.
 *
 * Couleurs en dur, faute de mieux : `react-native-svg` ne lit pas les classes
 * NativeWind. Elles reprennent exactement `tailwind.config.js`.
 */
const LIME = '#B4DD7F'
const FOREST = '#1E5631'
const FOREST_LIGHT = '#2d7a47'
const SUN = '#F6C445'
const SAND = '#F9F7E8'

/** Une feuille qui tombe, à placer par `transform`. */
function FallingLeaf({ x, y, angle, color, size = 1 }: {
  x: number
  y: number
  angle: number
  color: string
  size?: number
}) {
  return (
    <Path
      d="M0 0 C 4 -6, 12 -6, 14 0 C 12 6, 4 6, 0 0 Z"
      fill={color}
      transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}
    />
  )
}

/**
 * Le petit paysage qui remplace la photo tant que l'utilisateur n'en a pas :
 * soleil derrière un nuage, deux tournesols, un plant de tomates, des herbes.
 * Pensé pour un fond forest — il s'étire en largeur et reste calé en bas.
 */
export function GardenScene({ width, height = 150 }: { width: number; height?: number }) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 350 140"
      preserveAspectRatio="xMidYMax slice"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={282} cy={44} r={32} fill={SUN} opacity={0.15} />
      <Circle cx={282} cy={44} r={22} fill={SUN} />
      <Path
        d="M240 66 a15 15 0 0 1 27 -9 a13 13 0 0 1 24 5 a11 11 0 0 1 -1 22 h-46 a10 10 0 0 1 -4 -18z"
        fill={SAND}
        opacity={0.95}
      />

      <Path d="M0 104 C 60 78, 120 86, 185 98 S 300 78, 350 90 L350 140 L0 140 Z" fill={FOREST_LIGHT} />

      {/* Grand tournesol */}
      <Path d="M70 128 C 70 112, 72 96, 70 80" stroke={LIME} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M70 108 C 60 100, 52 101, 49 106 C 55 111, 63 111, 70 108 Z" fill={LIME} />
      <Path d="M71 96 C 81 89, 89 90, 92 95 C 86 100, 78 100, 71 96 Z" fill={LIME} />
      <Circle cx={70} cy={76} r={12} fill={SUN} />
      <Circle cx={70} cy={76} r={5} fill={FOREST} />

      {/* Petit tournesol */}
      <Path d="M100 130 C 100 118, 101 108, 100 98" stroke={LIME} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={100} cy={95} r={8} fill={SUN} />
      <Circle cx={100} cy={95} r={3.5} fill={FOREST} />

      {/* Plant de tomates */}
      <Circle cx={146} cy={118} r={14} fill={LIME} />
      <Circle cx={164} cy={112} r={16} fill={LIME} />
      <Circle cx={180} cy={120} r={12} fill={LIME} />
      <Circle cx={150} cy={114} r={3} fill={SUN} />
      <Circle cx={166} cy={106} r={3} fill={SUN} />
      <Circle cx={176} cy={117} r={3} fill={SUN} />

      {/* Herbes */}
      <Path d="M222 132 C 220 120, 216 112, 210 106" stroke={LIME} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M228 132 C 228 118, 230 108, 234 100" stroke={LIME} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M234 132 C 236 122, 242 114, 250 110" stroke={LIME} strokeWidth={2.5} fill="none" strokeLinecap="round" />

      <Path d="M0 122 C 80 110, 170 128, 250 120 S 330 116, 350 122 L350 140 L0 140 Z" fill={FOREST} />

      <FallingLeaf x={126} y={34} angle={30} color={SUN} />
      <FallingLeaf x={196} y={56} angle={-20} color={LIME} />
      <FallingLeaf x={40} y={40} angle={70} color={SUN} size={0.8} />
      <FallingLeaf x={320} y={92} angle={-50} color={LIME} size={0.8} />
    </Svg>
  )
}

/** La pousse qui sort du bouton « Identifier une plante ». */
export function Sprout({ size = 64 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M32 60 C 32 48, 32 38, 32 26" stroke={FOREST} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path
        d="M32 38 C 20 36, 10 26, 10 14 C 22 14, 32 24, 32 38 Z"
        fill={FOREST_LIGHT}
        stroke={FOREST}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M32 30 C 42 28, 52 18, 54 6 C 42 6, 32 16, 32 30 Z"
        fill={LIME}
        stroke={FOREST}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/**
 * Une feuille de monstera en filigrane, pour les blocs forest. Les nervures
 * sont tracées dans la couleur du fond : elles se lisent comme des découpes.
 */
export function MonsteraLeaf({ size = 200, background = FOREST }: {
  size?: number
  background?: string
}) {
  const ribs: [number, number, number, number][] = [
    [4, -40, 90, -20],
    [4, 0, 98, 22],
    [4, 40, 84, 66],
    [-4, -40, -90, -20],
    [-4, 0, -98, 22],
    [-4, 40, -84, 66],
  ]

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 230 230"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G transform="translate(115 115) rotate(-35)">
        <Path
          d="M0 -100 C 62 -95, 104 -44, 100 22 C 95 78, 46 104, 0 108 C -46 104, -95 78, -100 22 C -104 -44, -62 -95, 0 -100 Z"
          fill={LIME}
          opacity={0.22}
        />
        <Path d="M0 -96 L0 104" stroke={background} strokeWidth={3} />
        {ribs.map(([x1, y1, x2, y2], i) => (
          <Path
            key={i}
            d={`M${x1} ${y1} L${x2} ${y2}`}
            stroke={background}
            strokeWidth={7}
            strokeLinecap="round"
          />
        ))}
        <Ellipse cx={40} cy={-60} rx={7} ry={12} fill={background} transform="rotate(20 40 -60)" />
        <Ellipse cx={-40} cy={-60} rx={7} ry={12} fill={background} transform="rotate(-20 -40 -60)" />
      </G>
    </Svg>
  )
}
