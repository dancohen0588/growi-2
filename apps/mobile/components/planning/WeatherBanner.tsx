import { Text, View } from 'react-native'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Cloudy,
  Droplets,
  Snowflake,
  Sun,
  Thermometer,
} from 'lucide-react-native'
import {
  getWeatherCodeInfo,
  type PlanningWeather,
  type WeatherIconName,
} from '@growi/shared'

/**
 * Chaque nom d'icône partagé, relié à son composant natif.
 *
 * Le libellé, le conseil et la gravité viennent de `@growi/shared` : seule
 * cette correspondance est propre au mobile, le web ayant la sienne avec
 * `lucide-react`.
 */
const ICONS: Record<WeatherIconName, typeof Sun> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  cloudy: Cloudy,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  'cloud-lightning': CloudLightning,
}

/** Pastille de gravité : le fond porte la couleur, jamais le texte. */
const SEVERITY_TONE = {
  good: 'bg-lime',
  moderate: 'bg-sun',
  bad: 'bg-destructive',
} as const

function round(value: number): string {
  return `${Math.round(value)}°`
}

export function WeatherBanner({ weather }: { weather: PlanningWeather }) {
  const info = getWeatherCodeInfo(weather.current.weatherCode)
  const Icon = ICONS[info.icon]
  const today = weather.today

  return (
    <View className="rounded-xl bg-card p-4 gap-3">
      <View className="flex-row items-center gap-3">
        <View className={`h-12 w-12 items-center justify-center rounded-lg ${SEVERITY_TONE[info.severity]}`}>
          <Icon size={26} color="#1E5631" />
        </View>

        <View className="flex-1">
          <Text className="font-poppins text-section text-forest" numberOfLines={1}>
            {round(weather.current.temperature)} · {info.label}
          </Text>
          <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
            {weather.locationName}
            {today ? ` · ${round(today.tempMin)} / ${round(today.tempMax)}` : ''}
          </Text>
        </View>
      </View>

      {today ? (
        <View className="flex-row gap-4">
          <View className="flex-row items-center gap-1.5">
            <Droplets size={14} color="hsl(139 20% 40%)" />
            <Text className="font-raleway text-caption text-muted-foreground">
              {Math.round(today.precipitationProbability)} % de pluie
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Thermometer size={14} color="hsl(139 20% 40%)" />
            <Text className="font-raleway text-caption text-muted-foreground">
              ressenti {round(weather.current.apparentTemperature)}
            </Text>
          </View>
        </View>
      ) : null}

      <Text className="font-raleway text-secondary text-forest">{info.gardenTip}</Text>
    </View>
  )
}

/**
 * Sans coordonnées, pas de météo — on le dit sans promettre de bouton, la
 * localisation se réglant depuis le profil.
 */
export function WeatherUnavailable() {
  return (
    <View className="rounded-xl bg-card p-4 flex-row items-center gap-3">
      <Cloudy size={22} color="hsl(139 20% 40%)" />
      <Text className="flex-1 font-raleway text-secondary text-muted-foreground">
        Renseigne ta ville depuis ton profil — l'icône en haut à droite de l'Accueil — pour voir
        la météo de ton jardin.
      </Text>
    </View>
  )
}
