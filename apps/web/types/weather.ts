// growi-frontend/types/weather.ts
import type { LucideIcon } from 'lucide-react'

// ─── Location ────────────────────────────────────────────────────────────────

export type LocationMode = 'account' | 'search' | 'geolocation'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

// ─── Weather data ─────────────────────────────────────────────────────────────

export interface WeatherCurrent {
  temperature: number
  apparentTemperature: number
  humidity: number
  precipitation: number
  weatherCode: number
  windSpeed: number
  windDirection: number
  time: string
}

export interface ForecastDay {
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  precipitationSum: number
  precipitationProbability: number
  sunrise: string
  sunset: string
}

export interface WeatherData {
  locationName: string
  elevation: number
  current: WeatherCurrent
  forecast: ForecastDay[]
  fetchedAt: string
}

// ─── Weather code info ────────────────────────────────────────────────────────

export interface WeatherInfo {
  label: string
  icon: LucideIcon
  gardenTip: string
  severity: 'good' | 'moderate' | 'bad'
}

// ─── Garden context ───────────────────────────────────────────────────────────

export type ClimateZone =
  | 'oceanic'
  | 'mediterranean'
  | 'continental'
  | 'mountain'
  | 'nordic'
  | 'atlantic'

export type GardenSeason =
  | 'early_spring'
  | 'spring'
  | 'early_summer'
  | 'summer'
  | 'late_summer'
  | 'autumn'
  | 'winter'

export interface FrostRisk {
  level: 'none' | 'low' | 'moderate' | 'high'
  label: string
  affectedNights: number
  minTemp: number
}

export interface WateringIndex {
  score: number
  label: string
  reasoning: string
}

export interface PlantWeatherAlert {
  plantName: string
  plantId: string
  alertType: 'frost' | 'heat' | 'overwatering' | 'drought' | 'wind'
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export interface GardenContext {
  climateZone: ClimateZone
  climateZoneLabel: string
  gardenSeason: GardenSeason
  gardenSeasonLabel: string
  frostRisk: FrostRisk
  wateringIndex: WateringIndex
  plantAlerts: PlantWeatherAlert[]
  elevation: number
  generalAdvice: string[]
}
