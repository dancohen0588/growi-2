import Svg, { Path } from 'react-native-svg'

const LIME = '#B4DD7F'
const FOREST = '#1E5631'

export interface SapDropProps {
  size?: number
  /** Le contour : forest sur fond clair, sand sur fond forest. */
  stroke?: string
  /** Une goutte déjà offerte : contour seul, sans remplissage ni nervures. */
  empty?: boolean
  /** Les nervures de la petite feuille ; inutiles en dessous de 20 pt. */
  veins?: boolean
}

/**
 * La goutte de sève — même tracé que les maquettes « Growi — La Sève » :
 * une goutte lime cerclée de forest, et dedans la nervure d'une feuille.
 * Toujours décorative : le texte voisin dit ce qu'elle compte.
 */
export function SapDrop({ size = 24, stroke = FOREST, empty = false, veins = size >= 20 }: SapDropProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} pointerEvents="none">
      <Path
        d="M12 2.5 C 9 7.5, 5.5 10.8, 5.5 15 a6.5 6.5 0 0 0 13 0 c0-4.2-3.5-7.5-6.5-12.5z"
        fill={empty ? 'none' : LIME}
        stroke={stroke}
        strokeOpacity={empty ? 0.45 : 1}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {veins && !empty ? (
        <Path
          d="M12 12.5 v6.5 M12 16 l-2.6 -2.2 M12 14.6 l2.6 -2.2"
          fill="none"
          stroke={FOREST}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  )
}
