// growi-frontend/app/api/weather/route.ts
// Proxy route: avoids CORS issues by fetching Open-Meteo server-side
import { NextRequest, NextResponse } from 'next/server'
import { parseOpenMeteoResponse } from '@/lib/weather-api'
import { reverseGeocode } from '@/lib/weather-api'
import type { WeatherData } from '@/types/weather'

export const revalidate = 1800 // 30 minutes

export async function GET(request: NextRequest): Promise<NextResponse<WeatherData | { error: string }>> {
  const { searchParams } = request.nextUrl
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Paramètres lat et lon requis' }, { status: 400 })
  }

  const latNum = parseFloat(lat)
  const lonNum = parseFloat(lon)

  if (isNaN(latNum) || isNaN(lonNum)) {
    return NextResponse.json({ error: 'Coordonnées invalides' }, { status: 400 })
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
  })

  try {
    const [weatherRes, locationName] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        next: { revalidate: 1800 },
      }),
      reverseGeocode(latNum, lonNum).catch(() => `${latNum.toFixed(2)}, ${lonNum.toFixed(2)}`),
    ])

    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: 'La météo est temporairement indisponible' },
        { status: 502 },
      )
    }

    const raw = await weatherRes.json() as Record<string, unknown>
    const data = parseOpenMeteoResponse(raw, locationName)

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'La météo est temporairement indisponible. Réessaie dans quelques instants.' },
      { status: 500 },
    )
  }
}
