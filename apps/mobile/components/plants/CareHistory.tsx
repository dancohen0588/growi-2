import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import {
  CARE_LOG_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  formatHarvest,
  type CareLog,
  type CareLogType,
  type HealthStatus,
} from '@growi/shared'

import { CareIcon, CareIconBadge } from '@/components/plants/CareIcon'
import { formatLogDate } from '@/lib/dates'

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
            <CareIconBadge>
              <CareIcon type={log.type as CareLogType} />
            </CareIconBadge>
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

              {/* La photo d'un geste ne se voit que là : on l'affiche en
                  vignette plutôt que de la laisser inaccessible. */}
              {log.photoUrl ? (
                <View className="mt-2 h-28 w-full overflow-hidden rounded-lg bg-sand-dark">
                  <Image
                    source={log.photoUrl}
                    contentFit="cover"
                    transition={150}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                </View>
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
