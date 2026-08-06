import type { WeatherForecast } from './types'

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

/** Neutral fallback when the weather API is unreachable. */
function neutralForecast(lat: number, lon: number): WeatherForecast {
  const today = new Date()
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      tempMax: 15,
      tempMin: 15,
      precipSum: 0,
      precipProbabilityMax: 0,
    }
  })

  return {
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    current: { temperature: 15, precipitation: 0, weatherCode: 0 },
    daily,
  }
}

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,precipitation,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    forecast_days: '7',
    timezone: 'auto',
  })

  try {
    const res = await fetch(`${OPEN_METEO_BASE}?${params}`, {
      next: { revalidate: 1800 },
    })

    if (!res.ok) return neutralForecast(lat, lon)

    const data = await res.json()

    const daily: WeatherForecast['daily'] = data.daily.time.map(
      (date: string, i: number) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipSum: data.daily.precipitation_sum[i],
        precipProbabilityMax: data.daily.precipitation_probability_max[i],
      }),
    )

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      current: {
        temperature: data.current.temperature_2m,
        precipitation: data.current.precipitation,
        weatherCode: data.current.weather_code,
      },
      daily,
    }
  } catch {
    return neutralForecast(lat, lon)
  }
}
