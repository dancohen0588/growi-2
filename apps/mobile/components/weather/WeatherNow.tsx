import { Text, View } from 'react-native'
import { CloudRain, Droplets, MapPin, Sprout, Wind } from 'lucide-react-native'
import { getWeatherCodeInfo, type GardenWeather } from '@growi/shared'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import { formatDayLabel } from '@/lib/dates'

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const

function cardinal(degrees: number): string {
  return CARDINALS[Math.round(degrees / 45) % 8]
}

function Metric({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      <Text className="font-raleway text-caption text-muted-foreground">{children}</Text>
    </View>
  )
}

/**
 * La météo du moment, reprise de la page Météo du web : lieu, température,
 * ressenti, trois mesures, et le conseil au jardin qu'appelle le temps qu'il
 * fait.
 */
export function WeatherNow({ weather }: { weather: GardenWeather }) {
  const { current, locationName } = weather
  const info = getWeatherCodeInfo(current.weatherCode)

  return (
    <View className="rounded-2xl border border-border bg-card p-4 gap-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-row items-center gap-1.5 flex-1">
          <MapPin size={14} color="hsl(139 20% 40%)" />
          <Text className="font-raleway-medium text-secondary text-forest" numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <Text className="font-raleway text-caption text-muted-foreground">
          {formatDayLabel(new Date(current.time))}
        </Text>
      </View>

      <View className="flex-row items-center gap-4">
        <WeatherIcon code={current.weatherCode} size={56} />
        <View className="flex-1">
          <Text className="font-poppins-bold text-forest" style={{ fontSize: 44, lineHeight: 50 }}>
            {Math.round(current.temperature)}°
          </Text>
          <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={2}>
            {info.label} · ressenti {Math.round(current.apparentTemperature)}°
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-2">
        <Metric icon={<Droplets size={13} color="hsl(139 20% 40%)" />}>
          Humidité {current.humidity} %
        </Metric>
        <Metric icon={<Wind size={13} color="hsl(139 20% 40%)" />}>
          Vent {Math.round(current.windSpeed)} km/h {cardinal(current.windDirection)}
        </Metric>
        <Metric icon={<CloudRain size={13} color="hsl(139 20% 40%)" />}>
          Précip. {current.precipitation} mm
        </Metric>
      </View>

      <View className="flex-row items-start gap-2 rounded-xl bg-lime/40 px-3 py-2.5">
        <Sprout size={16} color="#1E5631" />
        <Text className="flex-1 font-raleway text-secondary text-forest">{info.gardenTip}</Text>
      </View>
    </View>
  )
}
