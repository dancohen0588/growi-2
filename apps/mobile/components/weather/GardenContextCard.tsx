import { Text, View } from 'react-native'
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Globe,
  Info,
  Leaf,
  Mountain,
  Thermometer,
} from 'lucide-react-native'
import type { FrostLevel, GardenContext, PlantWeatherAlert } from '@growi/shared'

/** Le gel se lit à la couleur, du vert au rouge. */
const FROST_TONE: Record<FrostLevel, { label: string; color: string }> = {
  none: { label: 'Aucun', color: '#1E5631' },
  low: { label: 'Faible', color: '#8a6a00' },
  moderate: { label: 'Modéré', color: '#b45309' },
  high: { label: 'Élevé', color: 'hsl(0 84% 60%)' },
}

const ALERT_TONE: Record<PlantWeatherAlert['severity'], string> = {
  info: 'bg-sand',
  warning: 'bg-sun/30',
  critical: 'bg-destructive/15',
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-lime/30 px-3 py-1">
      {icon}
      <Text className="font-raleway text-caption text-forest">{children}</Text>
    </View>
  )
}

/** Barre de l'index d'arrosage : vert tant qu'il n'y a rien à faire. */
function WateringBar({ score }: { score: number }) {
  const tone = score <= 3 ? 'bg-lime' : score <= 6 ? 'bg-sun' : 'bg-destructive'

  return (
    <View
      className="h-2 w-full overflow-hidden rounded-full bg-sand-dark"
      accessibilityRole="progressbar"
      accessibilityValue={{ now: score, min: 0, max: 10 }}
    >
      <View className={`h-full rounded-full ${tone}`} style={{ width: `${(score / 10) * 100}%` }} />
    </View>
  )
}

/**
 * Le contexte du jardin : zone climatique, saison, altitude, index d'arrosage,
 * risque de gel et alertes par plante. Même contenu que la carte du web.
 */
export function GardenContextCard({ context }: { context: GardenContext }) {
  const frost = FROST_TONE[context.frostRisk.level]

  return (
    <View className="rounded-2xl border border-border bg-card p-4 gap-4">
      <View className="flex-row items-center gap-2">
        <Globe size={18} color="#1E5631" />
        <Text className="font-poppins text-section text-forest">Ton contexte jardin</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Chip icon={<Globe size={12} color="#1E5631" />}>{context.climateZoneLabel}</Chip>
        <Chip icon={<Leaf size={12} color="#1E5631" />}>{context.gardenSeasonLabel}</Chip>
        <Chip icon={<Mountain size={12} color="#1E5631" />}>{context.elevation} m</Chip>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1 rounded-xl bg-sand p-3">
          <View className="flex-row items-center gap-1.5">
            <Droplets size={15} color="hsl(139 20% 40%)" />
            <Text className="font-poppins text-secondary text-forest">Arrosage</Text>
          </View>
          <Text className="font-poppins-bold text-section text-forest">
            {context.wateringIndex.score}
            <Text className="font-raleway text-caption text-muted-foreground"> /10</Text>
          </Text>
          <WateringBar score={context.wateringIndex.score} />
          <Text className="font-raleway text-caption text-muted-foreground">
            {context.wateringIndex.label}
          </Text>
        </View>

        <View className="flex-1 gap-1 rounded-xl bg-sand p-3">
          <View className="flex-row items-center gap-1.5">
            <Thermometer size={15} color={frost.color} />
            <Text className="font-poppins text-secondary text-forest">Gel</Text>
          </View>
          <Text className="font-poppins-bold text-section" style={{ color: frost.color }}>
            {frost.label}
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={3}>
            {context.frostRisk.label}
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <AlertTriangle size={15} color="hsl(139 20% 40%)" />
          <Text className="font-poppins text-secondary text-forest">Alertes pour tes plantes</Text>
        </View>

        {context.plantAlerts.length === 0 ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-lime/20 p-3">
            <CheckCircle2 size={16} color="#1E5631" />
            <Text className="flex-1 font-raleway text-secondary text-forest">
              Tes plantes sont prêtes pour la météo de la semaine 🌱
            </Text>
          </View>
        ) : (
          context.plantAlerts.map((alert, index) => (
            <View
              key={`${alert.plantId}-${alert.alertType}-${index}`}
              className={`flex-row items-start gap-2 rounded-xl p-3 ${ALERT_TONE[alert.severity]}`}
            >
              {alert.severity === 'info' ? (
                <Info size={15} color="hsl(139 20% 40%)" />
              ) : (
                <AlertTriangle
                  size={15}
                  color={alert.severity === 'critical' ? 'hsl(0 84% 60%)' : '#8a6a00'}
                />
              )}
              <Text className="flex-1 font-raleway text-secondary text-forest">
                {alert.message}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}
