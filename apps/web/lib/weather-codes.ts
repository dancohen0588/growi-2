/**
 * Adaptation web des codes météo partagés.
 *
 * Les libellés, conseils et gravités vivent dans `@growi/shared` — le mobile
 * s'appuie sur les mêmes. Il ne reste ici qu'à relier chaque nom d'icône au
 * composant `lucide-react` correspondant.
 */
import {
  Sun,
  CloudSun,
  Cloud,
  Cloudy,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
} from 'lucide-react'
import { WEATHER_CODES, getWeatherCodeInfo, type WeatherIconName } from '@growi/shared'
import type { LucideIcon } from 'lucide-react'
import type { WeatherInfo } from '@/types/weather'

const ICONS: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  cloudy: Cloudy,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  'cloud-lightning': CloudLightning,
}

export function getWeatherInfo(code: number): WeatherInfo {
  const { label, icon, gardenTip, severity } = getWeatherCodeInfo(code)
  return { label, icon: ICONS[icon], gardenTip, severity }
}

export { WEATHER_CODES as weatherCodes }
