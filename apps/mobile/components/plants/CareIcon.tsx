import { View } from 'react-native'
import {
  Droplets,
  HeartPulse,
  Leaf,
  Recycle,
  Scissors,
  ShoppingBasket,
  Shovel,
  SprayCan,
  Sprout,
} from 'lucide-react-native'
import {
  CARE_LOG_ICONS,
  CARE_LOG_TYPE_BY_ACTION,
  type ActionType,
  type CareLogType,
} from '@growi/shared'

/**
 * Une icône par geste, partagée par l'historique et le planning.
 *
 * Le libellé d'une tâche se lit mal en diagonale ; l'icône donne la nature du
 * geste avant la lecture. Le choix vit dans `@growi/shared` — le web dessine
 * les mêmes gestes avec `lucide-react` ; ici on relie ces noms aux composants
 * de `lucide-react-native`.
 */
const ICONS: Record<string, typeof Droplets> = {
  droplets: Droplets,
  scissors: Scissors,
  recycle: Recycle,
  'heart-pulse': HeartPulse,
  'shopping-basket': ShoppingBasket,
  'spray-can': SprayCan,
  shovel: Shovel,
  sprout: Sprout,
  leaf: Leaf,
}

export interface CareIconProps {
  type: CareLogType
  size?: number
  color?: string
}

export function CareIcon({ type, size = 18, color = '#1E5631' }: CareIconProps) {
  const Icon = ICONS[CARE_LOG_ICONS[type]] ?? Leaf
  return <Icon size={size} color={color} />
}

/** L'icône d'une tâche du planning, via le geste qui l'accomplit. */
export function ActionIcon({ type, ...rest }: Omit<CareIconProps, 'type'> & { type: ActionType }) {
  return <CareIcon type={CARE_LOG_TYPE_BY_ACTION[type] ?? 'other'} {...rest} />
}

/** Pastille ronde qui porte l'icône, telle qu'on la voit dans les listes. */
export function CareIconBadge({ children }: { children: React.ReactNode }) {
  return (
    <View className="h-9 w-9 items-center justify-center rounded-lg bg-sand">{children}</View>
  )
}
