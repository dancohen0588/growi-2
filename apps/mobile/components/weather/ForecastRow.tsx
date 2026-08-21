import { ScrollView, Text, View } from 'react-native'
import { Droplets } from 'lucide-react-native'
import type { ForecastDay } from '@growi/shared'

import { WeatherIcon } from '@/components/weather/WeatherIcon'
import { shortDayLabel } from '@/lib/dates'

/** Prévision à sept jours, du jour même à J+6. */
export function ForecastRow({ forecast, today }: { forecast: ForecastDay[]; today: string }) {
  return (
    <View className="gap-2">
      <Text className="font-poppins text-section text-forest px-4">Prévisions 7 jours</Text>

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
                'w-[74px] items-center gap-1 rounded-xl py-3',
                isToday ? 'border-2 border-lime bg-lime/20' : 'border border-border bg-card',
              ].join(' ')}
            >
              <Text className="font-raleway-semibold text-caption text-forest">
                {isToday ? "Auj." : shortDayLabel(day.date)}
              </Text>

              <WeatherIcon code={day.weatherCode} size={26} />

              <Text className="font-poppins text-secondary text-forest">
                {Math.round(day.tempMax)}°
              </Text>
              <Text className="font-raleway text-caption text-muted-foreground">
                {Math.round(day.tempMin)}°
              </Text>

              {day.precipitationProbability > 10 ? (
                <View className="flex-row items-center gap-1">
                  <Droplets size={11} color="hsl(139 20% 40%)" />
                  <Text className="font-raleway text-caption text-muted-foreground">
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
