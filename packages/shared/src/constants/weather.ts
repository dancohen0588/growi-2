/**
 * Codes météo WMO tels que les renvoie Open-Meteo, traduits pour le jardinier.
 *
 * Le libellé, le conseil et la gravité sont communs au web et au mobile ; seule
 * l'icône diffère, `lucide-react` d'un côté et `lucide-react-native` de l'autre.
 * On partage donc le **nom** de l'icône, que chaque plateforme relie à son
 * propre composant.
 */

export const WEATHER_ICONS = [
  'sun',
  'cloud-sun',
  'cloud',
  'cloudy',
  'cloud-fog',
  'cloud-drizzle',
  'cloud-rain',
  'snowflake',
  'cloud-lightning',
] as const

export type WeatherIconName = (typeof WEATHER_ICONS)[number]

export type WeatherSeverity = 'good' | 'moderate' | 'bad'

export interface WeatherCodeInfo {
  label: string
  icon: WeatherIconName
  /** Ce que le temps du jour implique au jardin. */
  gardenTip: string
  severity: WeatherSeverity
}

export const WEATHER_CODES: Record<number, WeatherCodeInfo> = {
  0: {
    label: 'Ciel dégagé',
    icon: 'sun',
    gardenTip: "Idéal pour arroser tôt le matin ou en soirée pour éviter l'évaporation.",
    severity: 'good',
  },
  1: {
    label: 'Principalement dégagé',
    icon: 'cloud-sun',
    gardenTip: 'Bonne journée pour travailler au jardin. Profites-en pour tailler ou désherber.',
    severity: 'good',
  },
  2: {
    label: 'Partiellement nuageux',
    icon: 'cloud-sun',
    gardenTip: 'Conditions agréables pour jardiner. Pense à arroser si la terre est sèche.',
    severity: 'good',
  },
  3: {
    label: 'Couvert',
    icon: 'cloud',
    gardenTip:
      'Temps idéal pour transplanter des plants — moins de stress hydrique pour les racines.',
    severity: 'moderate',
  },
  45: {
    label: 'Brouillard',
    icon: 'cloud-fog',
    gardenTip:
      'Le brouillard favorise les maladies fongiques. Surveille les champignons sur tes plantes.',
    severity: 'moderate',
  },
  48: {
    label: 'Brouillard givrant',
    icon: 'cloud-fog',
    gardenTip: 'Attention aux gelées blanches. Protège tes plants fragiles avec un voile de forçage.',
    severity: 'bad',
  },
  51: {
    label: 'Bruine légère',
    icon: 'cloud-drizzle',
    gardenTip: "Bruine légère — pas besoin d'arroser aujourd'hui.",
    severity: 'good',
  },
  53: {
    label: 'Bruine modérée',
    icon: 'cloud-drizzle',
    gardenTip: 'La bruine suffit à hydrater tes plantes. Profites-en pour pailler.',
    severity: 'good',
  },
  55: {
    label: 'Bruine dense',
    icon: 'cloud-drizzle',
    gardenTip: 'Bonne humidité naturelle. Évite de travailler la terre détrempée.',
    severity: 'moderate',
  },
  61: {
    label: 'Pluie légère',
    icon: 'cloud-rain',
    gardenTip: "Pas besoin d'arroser aujourd'hui, la pluie s'en charge !",
    severity: 'good',
  },
  63: {
    label: 'Pluie modérée',
    icon: 'cloud-rain',
    gardenTip:
      "Pluie modérée — surveille le drainage de tes pots pour éviter l'asphyxie des racines.",
    severity: 'moderate',
  },
  65: {
    label: 'Pluie forte',
    icon: 'cloud-rain',
    gardenTip:
      'Pluie forte prévue. Vérifie que tes massifs sont bien drainés et rentre les pots fragiles.',
    severity: 'bad',
  },
  71: {
    label: 'Neige légère',
    icon: 'snowflake',
    gardenTip: 'Neige légère — protège tes plantes sensibles avec un voile hivernal ou de la paille.',
    severity: 'bad',
  },
  73: {
    label: 'Neige modérée',
    icon: 'snowflake',
    gardenTip: 'La neige protège les bulbes du gel profond. Mais rentre tes plantes en pot.',
    severity: 'bad',
  },
  75: {
    label: 'Neige forte',
    icon: 'snowflake',
    gardenTip: 'Neige forte — reste au chaud et planifie ton jardin de printemps !',
    severity: 'bad',
  },
  77: {
    label: 'Grains de neige',
    icon: 'snowflake',
    gardenTip: 'Températures négatives proches. Couvre tes cultures sensibles.',
    severity: 'bad',
  },
  80: {
    label: 'Averses légères',
    icon: 'cloud-rain',
    gardenTip: "Averses passagères — pas besoin d'arroser. Profite des éclaircies pour jardiner.",
    severity: 'moderate',
  },
  81: {
    label: 'Averses modérées',
    icon: 'cloud-rain',
    gardenTip: 'Journée en dents de scie. Garde un œil sur la météo avant de jardiner.',
    severity: 'moderate',
  },
  82: {
    label: 'Averses violentes',
    icon: 'cloud-rain',
    gardenTip: 'Averses violentes prévues. Rentre tes outils et protège tes plants fragiles.',
    severity: 'bad',
  },
  95: {
    label: 'Orage',
    icon: 'cloud-lightning',
    gardenTip: 'Rentre tes outils et protège tes plants fragiles, orage prévu.',
    severity: 'bad',
  },
  96: {
    label: 'Orage avec grêle',
    icon: 'cloud-lightning',
    gardenTip: 'Orage avec grêle prévu — couvre tes plants sensibles avec un filet anti-grêle.',
    severity: 'bad',
  },
  99: {
    label: 'Orage violent avec grêle',
    icon: 'cloud-lightning',
    gardenTip: 'Risque de grêle forte. Protège immédiatement tes cultures et range tout le matériel.',
    severity: 'bad',
  },
}

const UNKNOWN_WEATHER: WeatherCodeInfo = {
  label: 'Conditions inconnues',
  icon: 'cloudy',
  gardenTip: 'Consulte la météo locale avant de jardiner.',
  severity: 'moderate',
}

/** Un code inconnu ne doit jamais casser l'affichage : on retombe sur un libellé neutre. */
export function getWeatherCodeInfo(code: number): WeatherCodeInfo {
  return WEATHER_CODES[code] ?? UNKNOWN_WEATHER
}
