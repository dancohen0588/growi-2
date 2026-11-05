import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWeatherForecast } from '../weather-adapter'

// Les règles lisent `daily[0]` comme le jour même : les jours passés demandés
// pour la pluie déjà tombée ne doivent jamais s'y glisser.

function openMeteo(days: Array<{ date: string; rain: number }>, now = '2026-11-04T16:15') {
  return {
    latitude: 48.87,
    longitude: 2.22,
    timezone: 'Europe/Paris',
    current: { time: now, temperature_2m: 9, precipitation: 0, weather_code: 3 },
    daily: {
      time: days.map((d) => d.date),
      temperature_2m_max: days.map(() => 12),
      temperature_2m_min: days.map(() => 4),
      precipitation_sum: days.map((d) => d.rain),
      precipitation_probability_max: days.map(() => 50),
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchWeatherForecast', () => {
  it('sépare la pluie des trois derniers jours de la prévision', async () => {
    const body = openMeteo([
      { date: '2026-11-01', rain: 6 },
      { date: '2026-11-02', rain: 4.5 },
      { date: '2026-11-03', rain: 2 },
      { date: '2026-11-04', rain: 1 },
      { date: '2026-11-05', rain: 0 },
    ])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body })
    vi.stubGlobal('fetch', fetchMock)

    const forecast = await fetchWeatherForecast(48.87, 2.22)

    expect(String(fetchMock.mock.calls[0][0])).toContain('past_days=3')
    expect(forecast.daily.map((d) => d.date)).toEqual(['2026-11-04', '2026-11-05'])
    expect(forecast.recentPrecipSum).toBeCloseTo(12.5)
  })

  it('ne prétend pas qu’il n’a pas plu quand l’API ne rend aucun jour passé', async () => {
    const body = openMeteo([{ date: '2026-11-04', rain: 0 }])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))

    expect((await fetchWeatherForecast(48.87, 2.22)).recentPrecipSum).toBeUndefined()
  })
})
