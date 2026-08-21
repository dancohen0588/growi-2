import { Text, View } from 'react-native'
import {
  Droplets,
  HeartPulse,
  Leaf,
  Scissors,
  ShoppingBasket,
  Shrub,
  Sprout,
  SprayCan,
} from 'lucide-react-native'
import {
  CARE_LOG_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  formatHarvest,
  type CareLog,
  type CareLogType,
  type HealthStatus,
} from '@growi/shared'

import { formatLogDate } from '@/lib/dates'

const ICONS: Record<CareLogType, React.ReactNode> = {
  watering: <Droplets size={18} color="#1E5631" />,
  pruning: <Scissors size={18} color="#1E5631" />,
  fertilizing: <Sprout size={18} color="#1E5631" />,
  health: <HeartPulse size={18} color="#1E5631" />,
  harvest: <ShoppingBasket size={18} color="#1E5631" />,
  treatment: <SprayCan size={18} color="#1E5631" />,
  repotting: <Shrub size={18} color="#1E5631" />,
  sowing: <Leaf size={18} color="#1E5631" />,
  other: <Leaf size={18} color="#1E5631" />,
}

/** Libellé du geste, enrichi de ce qui le précise : état, produit, quantité. */
function describe(log: CareLog): { label: string; detail: string | null } {
  const type = log.type as CareLogType
  let label = CARE_LOG_TYPE_LABELS[type] ?? type

  if (type === 'health' && log.status) {
    label += ` — ${HEALTH_STATUS_LABELS[log.status as HealthStatus] ?? log.status}`
  }
  if (type === 'harvest' && log.quantity) {
    label += ` — ${formatHarvest(log.quantity, log.unit)}`
  }

  const detail = [log.productUsed, log.note].filter(Boolean).join(' · ') || null
  return { label, detail }
}

export function CareHistory({ logs }: { logs: CareLog[] }) {
  if (logs.length === 0) {
    return (
      <View className="rounded-xl bg-card p-4">
        <Text className="font-raleway text-secondary text-muted-foreground text-center">
          Aucun geste enregistré pour l'instant. Le premier arrosage lancera l'historique 🌱
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-2">
      {logs.map((log) => {
        const { label, detail } = describe(log)
        return (
          <View key={log.id} className="flex-row items-start gap-3 rounded-xl bg-card p-3">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-sand">
              {ICONS[log.type as CareLogType] ?? ICONS.other}
            </View>
            <View className="flex-1">
              <Text className="font-raleway-medium text-body text-forest">{label}</Text>
              {detail ? (
                <Text
                  className="font-raleway text-secondary text-muted-foreground"
                  numberOfLines={2}
                >
                  {detail}
                </Text>
              ) : null}
            </View>
            <Text className="font-raleway text-caption text-muted-foreground">
              {formatLogDate(log.occurredAt)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
