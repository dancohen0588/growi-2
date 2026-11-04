import { ScrollView, Text, View } from 'react-native'
import { Droplets } from 'lucide-react-native'
import type { ForecastDay } from '@growi/shared'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import { shortDayLabel } from '@/lib/dates'

/**
 * Prévision à sept jours, du jour même à J+6.
 *
 * Sans titre : elle suit la carte « Météo du jardin », qui en tient lieu. Le
 * jour même est en forest plein, comme le reste des repères de l'accueil.
 */
export function ForecastRow({ forecast, today }: { forecast: ForecastDay[]; today: string }) {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        accessibilityLabel="Prévisions météo sur sept jours"
      >
        {forecast.map((day) => {
          const isToday = day.date === today

          return (
            <View
              key={day.date}
              className={[
                'w-[64px] items-center gap-1 rounded-xl py-3',
                isToday ? 'bg-forest' : 'bg-card',
              ].join(' ')}
            >
              <Text
                className={`font-raleway-semibold text-caption ${isToday ? 'text-lime' : 'text-muted-foreground'}`}
              >
                {isToday ? 'Auj.' : shortDayLabel(day.date)}
              </Text>

              <WeatherIcon code={day.weatherCode} size={22} color={isToday ? '#F9F7E8' : '#1E5631'} />

              <Text className={`font-poppins text-secondary ${isToday ? 'text-sand' : 'text-forest'}`}>
                {Math.round(day.tempMax)}°
              </Text>
              <Text className={`font-raleway text-caption ${isToday ? 'text-lime' : 'text-muted-foreground'}`}>
                {Math.round(day.tempMin)}°
              </Text>

              {day.precipitationProbability > 10 ? (
                <View className="flex-row items-center gap-1">
                  <Droplets size={11} color={isToday ? '#B4DD7F' : 'hsl(139 20% 40%)'} />
                  <Text className={`font-raleway text-caption ${isToday ? 'text-lime' : 'text-muted-foreground'}`}>
                    {Math.round(day.precipitationProbability)} %
                  </Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
