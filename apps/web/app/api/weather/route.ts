// growi-frontend/app/api/weather/route.ts
// Proxy route: avoids CORS issues by fetching Open-Meteo server-side
import { NextRequest, NextResponse } from 'next/server'

import { getWeatherForecast } from '@/lib/services/weather.service'
import { isServiceError } from '@/lib/services/errors'
import type { WeatherData } from '@/types/weather'

// Doit rester un littéral : Next.js analyse cette valeur statiquement.
// À garder aligné avec WEATHER_REVALIDATE_SECONDS du service météo.
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

  try {
    return NextResponse.json(await getWeatherForecast(latNum, lonNum))
  } catch (err) {
    if (isServiceError(err) && err.code === 'UNAVAILABLE') {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    return NextResponse.json(
      { error: 'La météo est temporairement indisponible. Réessaie dans quelques instants.' },
      { status: 500 },
    )
  }
}
