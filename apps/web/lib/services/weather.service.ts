/**
 * Service météo — proxy Open-Meteo.
 *
 * L'appel reste côté serveur (évite les problèmes de CORS et centralise le
 * cache) ; la route API et, à terme, l'API v1 consommée par le mobile
 * s'appuient toutes deux sur ce service.
 */

import { parseOpenMeteoResponse, reverseGeocode } from '@/lib/weather-api'
import { ServiceError } from '@/lib/services/errors'
import type { WeatherData } from '@/types/weather'

/** Durée de cache de la prévision, en secondes. */
export const WEATHER_REVALIDATE_SECONDS = 1800

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
] as const

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
] as const

/**
 * Météo courante et prévision à 7 jours pour des coordonnées données.
 *
 * @throws ServiceError('UNAVAILABLE') si Open-Meteo ne répond pas.
 */
export async function getWeatherForecast(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: CURRENT_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    timezone: 'auto',
    forecast_days: '7',
  })

  const [weatherRes, locationName] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
    }),
    reverseGeocode(lat, lon).catch(() => `${lat.toFixed(2)}, ${lon.toFixed(2)}`),
  ])

  if (!weatherRes.ok) {
    throw new ServiceError('UNAVAILABLE', 'La météo est temporairement indisponible')
  }

  const raw = (await weatherRes.json()) as Record<string, unknown>
  return parseOpenMeteoResponse(raw, locationName)
}
