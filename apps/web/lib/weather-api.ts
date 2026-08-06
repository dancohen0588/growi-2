// growi-frontend/lib/weather-api.ts
import type { WeatherData, GeocodingResult, WeatherCurrent, ForecastDay } from '@/types/weather'

// ─── Open-Meteo fetch (via Next.js proxy route) ───────────────────────────────

export async function fetchWeatherByCoordinates(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  })

  const res = await fetch(`/api/weather?${params.toString()}`, {
    next: { revalidate: 1800 },
  })

  if (!res.ok) {
    throw new Error(`Erreur météo: ${res.status}`)
  }

  const data: WeatherData = await res.json() as WeatherData
  return data
}

// ─── Geocoding: address text → coordinates ────────────────────────────────────

export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'fr',
    format: 'json',
  })

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
  )

  if (!res.ok) return []

  const json = await res.json() as { results?: Array<{
    name: string
    latitude: number
    longitude: number
    country: string
    admin1?: string
  }> }

  return (json.results ?? []).map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }))
}

// ─── Reverse geocoding: coordinates → city name ───────────────────────────────

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    'accept-language': 'fr',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: { 'User-Agent': 'Growi-App/1.0' },
    },
  )

  if (!res.ok) return `${lat.toFixed(2)}, ${lon.toFixed(2)}`

  const json = await res.json() as {
    address?: {
      city?: string
      town?: string
      village?: string
      county?: string
      state?: string
    }
    display_name?: string
  }

  const addr = json.address
  const city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.county ?? ''
  const region = addr?.state ?? ''

  if (city && region) return `${city}, ${region}`
  if (city) return city
  return json.display_name?.split(',')[0] ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

// ─── Parse raw Open-Meteo response ───────────────────────────────────────────

export function parseOpenMeteoResponse(
  raw: Record<string, unknown>,
  locationName: string,
): WeatherData {
  const cur = raw.current as Record<string, unknown>
  const daily = raw.daily as Record<string, unknown[]>

  const current: WeatherCurrent = {
    temperature: cur.temperature_2m as number,
    apparentTemperature: cur.apparent_temperature as number,
    humidity: cur.relative_humidity_2m as number,
    precipitation: cur.precipitation as number,
    weatherCode: cur.weather_code as number,
    windSpeed: cur.wind_speed_10m as number,
    windDirection: cur.wind_direction_10m as number,
    time: cur.time as string,
  }

  const dates = daily.time as string[]
  const forecast: ForecastDay[] = dates.map((date, i) => ({
    date,
    weatherCode: (daily.weather_code as number[])[i],
    tempMax: (daily.temperature_2m_max as number[])[i],
    tempMin: (daily.temperature_2m_min as number[])[i],
    precipitationSum: (daily.precipitation_sum as number[])[i],
    precipitationProbability: (daily.precipitation_probability_max as number[])[i],
    sunrise: (daily.sunrise as string[])[i],
    sunset: (daily.sunset as string[])[i],
  }))

  return {
    locationName,
    elevation: raw.elevation as number,
    current,
    forecast,
    fetchedAt: new Date().toISOString(),
  }
}
