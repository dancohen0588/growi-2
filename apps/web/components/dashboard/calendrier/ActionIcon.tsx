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
} from 'lucide-react'
import { CARE_LOG_ICONS, CARE_LOG_TYPE_BY_ACTION, type ActionType } from '@growi/shared'

/**
 * Icône d'un geste, reliée aux noms partagés dans `@growi/shared`.
 *
 * L'app mobile fait la même chose avec `lucide-react-native` : une récolte
 * porte ainsi le même signe sur les deux plateformes.
 */
const ICONS: Record<string, React.ElementType> = {
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

interface ActionIconProps {
  type: ActionType
  size?: number
  className?: string
}

export function ActionIcon({ type, size = 18, className }: ActionIconProps) {
  const Icon = ICONS[CARE_LOG_ICONS[CARE_LOG_TYPE_BY_ACTION[type] ?? 'other']] ?? Leaf
  return <Icon size={size} className={className} aria-hidden />
}
