import { View } from 'react-native'
import Svg, { Circle, Ellipse, G } from 'react-native-svg'

const FOREST = '#1E5631'
const FOREST_LIGHT = '#2d7a47'
const LIME = '#B4DD7F'
const SAND = '#F9F7E8'
const SUN = '#F6C445'
const SUN_PRESSED = '#e4b030'

/** Au-delà, les cernes se serreraient au point de se toucher. */
const MAX_DRAWN_RINGS = 8

const CENTER = 120
const BARK_R = 104
const WOOD_R = 96
const CURRENT_R = 82
const CORE_R = 6
const OUTER_R = 112

export interface TrunkRingsProps {
  /** Cernes formés. */
  count: number
  /** Avancement du cerne en cours, de 0 à 1. */
  progress: number
  size: number
  /**
   * Sur le bloc forest de « Ta sève » : un anneau lime autour de l'écorce
   * redit l'avancement, lisible de loin. Ailleurs, la coupe seule.
   */
  halo?: boolean
  /** Ce que lit un lecteur d'écran — « 3 cernes formés, le 4ᵉ à 20 % ». */
  label: string
}

/** Longueur d'arc pour un avancement, sur un cercle de rayon `r`. */
function dash(r: number, progress: number): string {
  const circumference = 2 * Math.PI * r
  const length = Math.max(0, Math.min(1, progress)) * circumference
  return `${length} ${circumference}`
}

/**
 * La coupe du tronc : un cerne par palier franchi, et celui qui se forme en
 * pointillé, rempli à mesure.
 *
 * Les cernes ne sont pas des cercles parfaits — un léger décalage de centre et
 * d'ovale, déterministe, pour que la coupe ait l'air de bois et non d'une
 * cible. Le même dessin sert à la vignette de l'Accueil et au grand format.
 */
export function TrunkRings({ count, progress, size, halo = false, label }: TrunkRingsProps) {
  const drawn = Math.min(count, MAX_DRAWN_RINGS)
  const inner = CURRENT_R - 10
  const rings = Array.from({ length: drawn }, (_, index) => {
    const i = index + 1
    // Le demi-pas en plus laisse un écart entre le dernier cerne formé et
    // celui qui se forme, même quand il n'y en a qu'un.
    const r = CORE_R + 6 + ((inner - CORE_R - 6) * i) / (drawn + 0.5)
    const wobble = i % 2 === 0 ? 0.8 : -0.8
    return { key: i, r, rx: r + wobble, ry: r - wobble, cx: CENTER + ((i % 3) - 1) * 0.7 }
  })

  // Sans halo, on recadre sur l'écorce : la vignette n'a pas de marge à perdre.
  const viewBox = halo ? '0 0 240 240' : '14 14 212 212'

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={viewBox}>
        {halo ? (
          <G>
            <Circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke={LIME} strokeOpacity={0.22} strokeWidth={8} />
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={OUTER_R}
              fill="none"
              stroke={LIME}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={dash(OUTER_R, progress)}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </G>
        ) : null}

        <Circle cx={CENTER} cy={CENTER} r={BARK_R} fill={FOREST} />
        {/* L'écorce, un ton sous le forest : sur le bloc forest de « Ta
            sève », elle se fondrait sinon dans le fond. */}
        <Circle cx={CENTER} cy={CENTER} r={BARK_R} fill="#000000" fillOpacity={0.28} />
        {/* Le bois : un fond sand teinté de sun, pour rester dans la palette. */}
        <Circle cx={CENTER} cy={CENTER} r={WOOD_R} fill={SAND} />
        <Circle cx={CENTER} cy={CENTER} r={WOOD_R} fill={SUN} fillOpacity={0.42} />

        {/* Le cerne en cours : la trace en pointillé, l'avancement plein. */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={CURRENT_R}
          fill="none"
          stroke={SUN_PRESSED}
          strokeWidth={2.5}
          strokeDasharray="3 6"
        />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={CURRENT_R}
          fill="none"
          stroke={FOREST_LIGHT}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={dash(CURRENT_R, progress)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />

        {rings.map((ring) => (
          <Ellipse
            key={ring.key}
            cx={ring.cx}
            cy={CENTER}
            rx={ring.rx}
            ry={ring.ry}
            fill="none"
            stroke={FOREST}
            strokeOpacity={0.6}
            strokeWidth={2.6}
          />
        ))}

        <Circle cx={CENTER} cy={CENTER} r={CORE_R} fill={FOREST} />
      </Svg>
    </View>
  )
}
