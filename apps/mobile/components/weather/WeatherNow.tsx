import { Text, View } from 'react-native'
import { CloudRain, Droplets, MapPin, Sprout, Wind } from 'lucide-react-native'
import { getWeatherCodeInfo, type GardenWeather } from '@growi/shared'

import { CARD_SHADOW } from '@/components/ui/Card'
import { WeatherIcon } from '@/components/weather/WeatherIcon'

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
 * La météo du moment : titre de section avec le lieu, une carte (température,
 * ressenti, trois mesures), puis le conseil au jardin qu'appelle le temps
 * qu'il fait. La date n'y est plus — l'en-tête de l'accueil la porte déjà.
 */
export function WeatherNow({ weather }: { weather: GardenWeather }) {
  const { current, locationName } = weather
  const info = getWeatherCodeInfo(current.weatherCode)

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-poppins text-section text-forest">Météo du jardin</Text>
        <View className="shrink flex-row items-center gap-1">
          <MapPin size={14} color="hsl(139 20% 40%)" />
          <Text className="shrink font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
            {locationName}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-2xl bg-card p-4" style={CARD_SHADOW}>
        <View className="flex-row items-center gap-4">
          <WeatherIcon code={current.weatherCode} size={48} />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-baseline gap-2">
              <Text className="font-poppins-bold text-forest" style={{ fontSize: 32, lineHeight: 38 }}>
                {Math.round(current.temperature)}°
              </Text>
              <Text className="font-raleway text-secondary text-muted-foreground">
                ressenti {Math.round(current.apparentTemperature)}°
              </Text>
            </View>
            <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
              {info.label}
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
      </View>

      <View className="flex-row items-start gap-2.5 rounded-xl bg-sand-dark px-3.5 py-3">
        <Sprout size={18} color="#1E5631" />
        <Text className="flex-1 font-raleway-medium text-secondary text-forest">{info.gardenTip}</Text>
      </View>
    </View>
  )
}
