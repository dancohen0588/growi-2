import { Text, View } from 'react-native'
import { Droplets, HeartPulse, Scissors, Sprout } from 'lucide-react-native'
import { formatLogDate } from '@/lib/dates'
import {
  HEALTH_STATUS_LABELS,
  type CareLogs,
  type HealthStatus,
} from '@growi/shared'

interface Entry {
  id: string
  at: string
  label: string
  detail?: string | null
  icon: React.ReactNode
}

/**
 * Historique fusionné et trié par date décroissante.
 *
 * L'API renvoie les logs groupés par type ; on les entrelace ici, parce que
 * l'utilisateur pense en « ce que j'ai fait », pas en catégories.
 */
function toEntries(logs: CareLogs): Entry[] {
  const entries: Entry[] = [
    ...logs.watering.map((log) => ({
      id: `w-${log.id}`,
      at: log.wateredAt,
      label: 'Arrosage',
      detail: log.note,
      icon: <Droplets size={18} color="#1E5631" />,
    })),
    ...logs.pruning.map((log) => ({
      id: `p-${log.id}`,
      at: log.prunedAt,
      label: 'Taille',
      detail: log.note ?? log.pruningType,
      icon: <Scissors size={18} color="#1E5631" />,
    })),
    ...logs.fertilizing.map((log) => ({
      id: `f-${log.id}`,
      at: log.fertilizedAt,
      label: 'Fertilisation',
      detail: log.note ?? log.productUsed,
      icon: <Sprout size={18} color="#1E5631" />,
    })),
    ...logs.health.map((log) => ({
      id: `h-${log.id}`,
      at: log.loggedAt,
      label: `Santé — ${HEALTH_STATUS_LABELS[log.status as HealthStatus] ?? log.status}`,
      detail: log.note,
      icon: <HeartPulse size={18} color="#1E5631" />,
    })),
  ]

  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

export function CareHistory({ logs }: { logs: CareLogs }) {
  const entries = toEntries(logs)

  if (entries.length === 0) {
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
      {entries.map((entry) => (
        <View key={entry.id} className="flex-row items-start gap-3 rounded-xl bg-card p-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-sand">
            {entry.icon}
          </View>
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">{entry.label}</Text>
            {entry.detail ? (
              <Text
                className="font-raleway text-secondary text-muted-foreground"
                numberOfLines={2}
              >
                {entry.detail}
              </Text>
            ) : null}
          </View>
          <Text className="font-raleway text-caption text-muted-foreground">
            {formatLogDate(entry.at)}
          </Text>
        </View>
      ))}
    </View>
  )
}
