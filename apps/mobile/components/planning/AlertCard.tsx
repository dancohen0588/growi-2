import { Text, View } from 'react-native'
import { AlertTriangle, Bug, Snowflake, Sun } from 'lucide-react-native'
import type { AlertSeverity, AlertType, PlantAlert } from '@growi/shared'

const ICONS: Record<AlertType, typeof Sun> = {
  gel: Snowflake,
  canicule: Sun,
  secheresse: AlertTriangle,
  maladie: Bug,
}

/** Le fond porte la gravité ; le texte reste forest pour rester lisible. */
const SEVERITY_TONE: Record<AlertSeverity, string> = {
  high: 'bg-destructive',
  medium: 'bg-sun',
  low: 'bg-lime',
}

export function AlertCard({ alert }: { alert: PlantAlert }) {
  const Icon = ICONS[alert.type] ?? AlertTriangle

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      <View
        className={`h-9 w-9 items-center justify-center rounded-lg ${SEVERITY_TONE[alert.severity]}`}
      >
        <Icon size={18} color="#1E5631" />
      </View>
      <Text className="flex-1 font-raleway text-secondary text-forest">{alert.message}</Text>
    </View>
  )
}
