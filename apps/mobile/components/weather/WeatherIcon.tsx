import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Cloudy,
  Snowflake,
  Sun,
} from 'lucide-react-native'
import { getWeatherCodeInfo, type WeatherIconName } from '@growi/shared'

/**
 * L'icône d'un code météo WMO.
 *
 * Le libellé, le conseil et la gravité viennent de `@growi/shared` ; seule
 * cette correspondance est propre au mobile, le web ayant la sienne.
 */
const ICONS: Record<WeatherIconName, typeof Sun> = {
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

export function WeatherIcon({
  code,
  size = 24,
  color = '#1E5631',
}: {
  code: number
  size?: number
  color?: string
}) {
  const Icon = ICONS[getWeatherCodeInfo(code).icon]
  return <Icon size={size} color={color} strokeWidth={1.5} />
}
