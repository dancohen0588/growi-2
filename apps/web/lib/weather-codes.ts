// growi-frontend/lib/weather-codes.ts
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
import type { WeatherInfo } from '@/types/weather'

const weatherCodes: Record<number, WeatherInfo> = {
  // Clear sky
  0: {
    label: 'Ciel dégagé',
    icon: Sun,
    gardenTip: "Idéal pour arroser tôt le matin ou en soirée pour éviter l'évaporation.",
    severity: 'good',
  },
  // Mainly clear, partly cloudy, overcast
  1: {
    label: 'Principalement dégagé',
    icon: CloudSun,
    gardenTip: 'Bonne journée pour travailler au jardin. Profites-en pour tailler ou désherber.',
    severity: 'good',
  },
  2: {
    label: 'Partiellement nuageux',
    icon: CloudSun,
    gardenTip: 'Conditions agréables pour jardiner. Pense à arroser si la terre est sèche.',
    severity: 'good',
  },
  3: {
    label: 'Couvert',
    icon: Cloud,
    gardenTip: "Temps idéal pour transplanter des plants — moins de stress hydrique pour les racines.",
    severity: 'moderate',
  },
  // Fog
  45: {
    label: 'Brouillard',
    icon: CloudFog,
    gardenTip: "Le brouillard favorise les maladies fongiques. Surveille les champignons sur tes plantes.",
    severity: 'moderate',
  },
  48: {
    label: 'Brouillard givrant',
    icon: CloudFog,
    gardenTip: 'Attention aux gelées blanches. Protège tes plants fragiles avec un voile de forçage.',
    severity: 'bad',
  },
  // Drizzle
  51: {
    label: 'Bruine légère',
    icon: CloudDrizzle,
    gardenTip: "Bruine légère — pas besoin d'arroser aujourd'hui.",
    severity: 'good',
  },
  53: {
    label: 'Bruine modérée',
    icon: CloudDrizzle,
    gardenTip: "La bruine suffit à hydrater tes plantes. Profites-en pour pailler.",
    severity: 'good',
  },
  55: {
    label: 'Bruine dense',
    icon: CloudDrizzle,
    gardenTip: "Bonne humidité naturelle. Évite de travailler la terre détrempée.",
    severity: 'moderate',
  },
  // Rain
  61: {
    label: 'Pluie légère',
    icon: CloudRain,
    gardenTip: "Pas besoin d'arroser aujourd'hui, la pluie s'en charge !",
    severity: 'good',
  },
  63: {
    label: 'Pluie modérée',
    icon: CloudRain,
    gardenTip: "Pluie modérée — surveille le drainage de tes pots pour éviter l'asphyxie des racines.",
    severity: 'moderate',
  },
  65: {
    label: 'Pluie forte',
    icon: CloudRain,
    gardenTip: 'Pluie forte prévue. Vérifie que tes massifs sont bien drainés et rentre les pots fragiles.',
    severity: 'bad',
  },
  // Snow
  71: {
    label: 'Neige légère',
    icon: Snowflake,
    gardenTip: 'Neige légère — protège tes plantes sensibles avec un voile hivernal ou de la paille.',
    severity: 'bad',
  },
  73: {
    label: 'Neige modérée',
    icon: Snowflake,
    gardenTip: 'La neige protège les bulbes du gel profond. Mais rentre tes plantes en pot.',
    severity: 'bad',
  },
  75: {
    label: 'Neige forte',
    icon: Snowflake,
    gardenTip: 'Neige forte — reste au chaud et planifie ton jardin de printemps !',
    severity: 'bad',
  },
  77: {
    label: 'Grains de neige',
    icon: Snowflake,
    gardenTip: 'Températures négatives proches. Couvre tes cultures sensibles.',
    severity: 'bad',
  },
  // Rain showers
  80: {
    label: 'Averses légères',
    icon: CloudRain,
    gardenTip: "Averses passagères — pas besoin d'arroser. Profite des éclaircies pour jardiner.",
    severity: 'moderate',
  },
  81: {
    label: 'Averses modérées',
    icon: CloudRain,
    gardenTip: "Journée en dents de scie. Garde un œil sur la météo avant de jardiner.",
    severity: 'moderate',
  },
  82: {
    label: 'Averses violentes',
    icon: CloudRain,
    gardenTip: 'Averses violentes prévues. Rentre tes outils et protège tes plants fragiles.',
    severity: 'bad',
  },
  // Thunderstorm
  95: {
    label: 'Orage',
    icon: CloudLightning,
    gardenTip: 'Rentre tes outils et protège tes plants fragiles, orage prévu.',
    severity: 'bad',
  },
  96: {
    label: 'Orage avec grêle',
    icon: CloudLightning,
    gardenTip: 'Orage avec grêle prévu — couvre tes plants sensibles avec un filet anti-grêle.',
    severity: 'bad',
  },
  99: {
    label: 'Orage violent avec grêle',
    icon: CloudLightning,
    gardenTip: 'Risque de grêle forte. Protège immédiatement tes cultures et range tout le matériel.',
    severity: 'bad',
  },
}

const defaultWeatherInfo: WeatherInfo = {
  label: 'Conditions inconnues',
  icon: Cloudy,
  gardenTip: 'Consulte la météo locale avant de jardiner.',
  severity: 'moderate',
}

export function getWeatherInfo(code: number): WeatherInfo {
  return weatherCodes[code] ?? defaultWeatherInfo
}

export { weatherCodes }
