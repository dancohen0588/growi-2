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
import { CARE_LOG_TYPE_BY_ACTION, type ActionType, type CareLogType } from '@growi/shared'

/**
 * Une icône par geste, partagée par l'historique et le planning.
 *
 * Le libellé d'une tâche se lit mal en diagonale ; l'icône donne la nature du
 * geste avant la lecture. Elles doivent donc rester distinctes les unes des
 * autres, et identiques d'un écran à l'autre.
 */
const ICONS: Record<CareLogType, typeof Droplets> = {
  watering: Droplets,
  pruning: Scissors,
  fertilizing: Recycle,
  health: HeartPulse,
  harvest: ShoppingBasket,
  treatment: SprayCan,
  repotting: Shovel,
  sowing: Sprout,
  other: Leaf,
}

export interface CareIconProps {
  type: CareLogType
  size?: number
  color?: string
}

export function CareIcon({ type, size = 18, color = '#1E5631' }: CareIconProps) {
  const Icon = ICONS[type] ?? Leaf
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
