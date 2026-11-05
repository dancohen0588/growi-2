import type { WeatherForecast } from './types'

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

/**
 * Jours passés demandés à Open-Meteo, pour la pluie déjà tombée.
 *
 * Le moteur ne regardait que la pluie **prévue** demain : trois jours
 * d'averses n'empêchaient pas de proposer d'arroser le rosier dehors.
 */
const PAST_DAYS = 3

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
    past_days: String(PAST_DAYS),
    timezone: 'auto',
  })

  try {
    const res = await fetch(`${OPEN_METEO_BASE}?${params}`, {
      next: { revalidate: 1800 },
    })

    if (!res.ok) return neutralForecast(lat, lon)

    const data = await res.json()

    const allDays: WeatherForecast['daily'] = data.daily.time.map(
      (date: string, i: number) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipSum: data.daily.precipitation_sum[i],
        precipProbabilityMax: data.daily.precipitation_probability_max[i],
      }),
    )

    // Les règles lisent `daily[0]` comme aujourd'hui : les jours passés en
    // sont retirés, et ne servent qu'au cumul de pluie. Le jour de référence
    // est celui du lieu (`current.time`), pas celui du serveur.
    const today: string =
      typeof data.current?.time === 'string' ? data.current.time.slice(0, 10) : allDays[PAST_DAYS]?.date
    const past = allDays.filter((day) => day.date < today)
    const daily = allDays.filter((day) => day.date >= today)
    const recentPrecipSum =
      past.length > 0
        ? past.reduce((sum, day) => sum + (Number.isFinite(day.precipSum) ? day.precipSum : 0), 0)
        : undefined

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
      recentPrecipSum,
    }
  } catch {
    return neutralForecast(lat, lon)
  }
}
