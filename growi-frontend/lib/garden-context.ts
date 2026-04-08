// growi-frontend/lib/garden-context.ts
// Pure analysis logic — no API calls here.
import type {
  ClimateZone,
  GardenSeason,
  FrostRisk,
  WateringIndex,
  PlantWeatherAlert,
  GardenContext,
  WeatherData,
  ForecastDay,
  WeatherCurrent,
} from '@/types/weather'
import type { Plant } from '@/lib/mock-plants'

// ─── Climate zone labels ──────────────────────────────────────────────────────

export const climateZoneLabels: Record<ClimateZone, string> = {
  oceanic: 'Climat océanique',
  mediterranean: 'Climat méditerranéen',
  continental: 'Climat continental',
  mountain: 'Climat de montagne',
  nordic: 'Climat nordique',
  atlantic: 'Climat atlantique',
}

// ─── Garden season labels ─────────────────────────────────────────────────────

export const gardenSeasonLabels: Record<GardenSeason, string> = {
  early_spring: 'Début de printemps',
  spring: 'Printemps',
  early_summer: 'Début d\'été',
  summer: 'Été',
  late_summer: 'Fin d\'été',
  autumn: 'Automne',
  winter: 'Hiver',
}

// ─── 1. Detect climate zone ───────────────────────────────────────────────────

export function detectClimateZone(lat: number, lon: number, elevation: number): ClimateZone {
  if (elevation > 600) return 'mountain'
  if (lat > 56) return 'nordic'
  if (lat < 44 && lon > -2 && lon < 16) return 'mediterranean'
  if (lon < -3 && lat > 43 && lat < 51) return 'atlantic'
  if (lon >= -3 && lon <= 4 && lat >= 44 && lat < 57) {
    return lon >= 2 ? 'continental' : 'oceanic'
  }
  if (lon > 4 && lat >= 44 && lat < 57) return 'continental'
  return 'continental'
}

// ─── 2. Detect garden season ──────────────────────────────────────────────────

export function detectGardenSeason(
  date: Date,
  climateZone: ClimateZone,
  forecast: ForecastDay[],
): GardenSeason {
  const month = date.getMonth() + 1 // 1-12

  // Average max temp over forecast
  const avgMax =
    forecast.length > 0
      ? forecast.reduce((sum, d) => sum + d.tempMax, 0) / forecast.length
      : 15

  // Base season from month
  let base: GardenSeason
  if (month <= 2 || month === 12) base = 'winter'
  else if (month === 3) base = 'early_spring'
  else if (month === 4 || month === 5) base = 'spring'
  else if (month === 6) base = 'early_summer'
  else if (month === 7 || month === 8) base = 'summer'
  else if (month === 9) base = 'late_summer'
  else base = 'autumn' // 10-11

  // Adjust for cold zones
  if ((climateZone === 'nordic' || climateZone === 'mountain') && base === 'spring') {
    return 'early_spring'
  }
  if ((climateZone === 'nordic' || climateZone === 'mountain') && base === 'early_summer') {
    return 'spring'
  }

  // Adjust based on actual temperatures
  if (base === 'spring' && avgMax < 12) return 'early_spring'
  if (base === 'early_summer' && avgMax < 16) return 'spring'
  if (base === 'summer' && avgMax > 30) return 'summer' // confirmed hot
  if (base === 'autumn' && avgMax > 22) return 'late_summer'

  return base
}

// ─── 3. Frost risk ────────────────────────────────────────────────────────────

export function assessFrostRisk(forecast: ForecastDay[]): FrostRisk {
  const minTemp = Math.min(...forecast.map((d) => d.tempMin))
  const affectedNights = forecast.filter((d) => d.tempMin <= 4).length

  if (minTemp > 4) {
    return { level: 'none', label: 'Aucun risque de gel cette semaine', affectedNights: 0, minTemp }
  }
  if (minTemp > 0) {
    return {
      level: 'low',
      label: `Risque de gel faible (${affectedNights} nuit${affectedNights > 1 ? 's' : ''} à risque)`,
      affectedNights,
      minTemp,
    }
  }
  if (minTemp > -3) {
    return {
      level: 'moderate',
      label: `Risque de gel modéré (${affectedNights} nuit${affectedNights > 1 ? 's' : ''} à risque)`,
      affectedNights,
      minTemp,
    }
  }
  return {
    level: 'high',
    label: `Risque de gel élevé (${affectedNights} nuit${affectedNights > 1 ? 's' : ''} à risque)`,
    affectedNights,
    minTemp,
  }
}

// ─── 4. Watering index ────────────────────────────────────────────────────────

export function computeWateringIndex(
  current: WeatherCurrent,
  forecast: ForecastDay[],
): WateringIndex {
  const next3 = forecast.slice(0, 3)
  const totalRain = next3.reduce((sum, d) => sum + d.precipitationSum, 0)
  const avgMax = next3.length > 0
    ? next3.reduce((sum, d) => sum + d.tempMax, 0) / next3.length
    : current.temperature
  const humidity = current.humidity

  // Score out of 10: higher = more urgent watering needed
  let score = 5

  // Adjust for rain
  if (totalRain > 20) score -= 3
  else if (totalRain > 10) score -= 2
  else if (totalRain > 3) score -= 1
  else if (totalRain === 0) score += 2

  // Adjust for heat
  if (avgMax > 30) score += 3
  else if (avgMax > 24) score += 2
  else if (avgMax > 18) score += 1
  else if (avgMax < 12) score -= 1

  // Adjust for humidity
  if (humidity > 80) score -= 1
  else if (humidity < 40) score += 1

  score = Math.max(0, Math.min(10, score))

  let label: string
  let reasoning: string

  if (score <= 2) {
    label = 'Pas besoin d\'arroser'
    reasoning = totalRain > 10
      ? `${totalRain.toFixed(0)} mm de pluie prévus sur 3 jours`
      : 'Températures fraîches et humidité suffisante'
  } else if (score <= 4) {
    label = 'Arrosage léger possible'
    reasoning = 'Surveille la terre — arrose si elle est sèche en surface'
  } else if (score <= 6) {
    label = 'Arrosage modéré recommandé'
    reasoning = `${totalRain < 3 ? 'Peu de pluie' : ''} et températures de ${avgMax.toFixed(0)}°C prévues`
  } else if (score <= 8) {
    label = 'Arrosage recommandé ce soir'
    reasoning = `${totalRain === 0 ? 'Aucune pluie' : 'Pluie insuffisante'} prévue, températures atteignant ${avgMax.toFixed(0)}°C`
  } else {
    label = 'Arrosage urgent !'
    reasoning = `Aucune pluie prévue et chaleur importante (${avgMax.toFixed(0)}°C) — arrose en profondeur`
  }

  return { score, label, reasoning }
}

// ─── 5. Plant weather alerts ──────────────────────────────────────────────────

function isFrostSensitive(plant: Plant): boolean {
  return (
    plant.category === 'potager' ||
    plant.category === 'aromatiques' ||
    plant.location === 'balcon' ||
    plant.wateringFrequencyDays <= 3
  )
}

function isDroughtSensitive(plant: Plant): boolean {
  return (
    plant.wateringDifficulty === 'demanding' ||
    plant.wateringDifficulty === 'medium' ||
    plant.wateringFrequencyDays <= 3
  )
}

function isOverwateringSensitive(plant: Plant): boolean {
  // Succulents, cacti, lavender: low water needs
  return (
    plant.wateringFrequencyDays >= 10 ||
    plant.wateringDifficulty === 'easy' && plant.sunExposure === 'full'
  )
}

export function generatePlantAlerts(
  plants: Plant[],
  frostRisk: FrostRisk,
  wateringIndex: WateringIndex,
  forecast: ForecastDay[],
  gardenSeason: GardenSeason,
): PlantWeatherAlert[] {
  const alerts: PlantWeatherAlert[] = []

  // Total rain over 3 days
  const rain3d = forecast.slice(0, 3).reduce((s, d) => s + d.precipitationSum, 0)
  const maxTemp = Math.max(...forecast.map((d) => d.tempMax))

  for (const plant of plants) {
    // Frost alert
    if (frostRisk.level !== 'none' && isFrostSensitive(plant)) {
      const severity =
        frostRisk.level === 'high' ? 'critical'
        : frostRisk.level === 'moderate' ? 'warning'
        : 'info'

      alerts.push({
        plantName: plant.name,
        plantId: plant.id,
        alertType: 'frost',
        severity,
        message: `${plant.emoji} ${plant.name} — ${frostRisk.label.toLowerCase()}. ${
          severity === 'critical'
            ? 'Rentre tes plants immédiatement ou couvre-les avec un voile de forçage.'
            : 'Protège-le si tu peux cette nuit.'
        }`,
      })
    }

    // Drought alert
    if (wateringIndex.score >= 7 && isDroughtSensitive(plant)) {
      alerts.push({
        plantName: plant.name,
        plantId: plant.id,
        alertType: 'drought',
        severity: wateringIndex.score >= 9 ? 'critical' : 'warning',
        message: `${plant.emoji} ${plant.name} — arrosage urgent recommandé. ${wateringIndex.reasoning}.`,
      })
    }

    // Overwatering risk (heavy rain + succulent-type plant)
    if (rain3d > 20 && isOverwateringSensitive(plant) && plant.location === 'exterieur') {
      alerts.push({
        plantName: plant.name,
        plantId: plant.id,
        alertType: 'overwatering',
        severity: 'warning',
        message: `${plant.emoji} ${plant.name} — ${rain3d.toFixed(0)} mm de pluie prévus. Vérifie le drainage et évite d'arroser.`,
      })
    }

    // Heat stress
    if (maxTemp > 34 && plant.location !== 'interieur') {
      alerts.push({
        plantName: plant.name,
        plantId: plant.id,
        alertType: 'heat',
        severity: 'warning',
        message: `${plant.emoji} ${plant.name} — chaleur extrême à ${maxTemp.toFixed(0)}°C prévue. Arrose tôt le matin et mulche le pied.`,
      })
    }

    // Early spring: don't put plants out yet
    if (gardenSeason === 'early_spring' && plant.location === 'interieur') {
      const coldDays = forecast.filter((d) => d.tempMax < 8).length
      if (coldDays >= 2) {
        alerts.push({
          plantName: plant.name,
          plantId: plant.id,
          alertType: 'frost',
          severity: 'info',
          message: `${plant.emoji} ${plant.name} — températures froides prévues. Attends encore avant de sortir tes plants.`,
        })
      }
    }
  }

  // Deduplicate: one alert per plant per alertType
  const seen = new Set<string>()
  return alerts.filter((a) => {
    const key = `${a.plantId}-${a.alertType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── 6. General advice ───────────────────────────────────────────────────────

export function buildGeneralAdvice(
  climateZone: ClimateZone,
  gardenSeason: GardenSeason,
  frostRisk: FrostRisk,
  wateringIndex: WateringIndex,
  forecast: ForecastDay[],
): string[] {
  const advice: string[] = []
  const rainDays = forecast.filter((d) => d.precipitationSum > 5).length

  // Season + climate specific advice
  if (gardenSeason === 'summer' && wateringIndex.score > 6) {
    if (climateZone === 'mediterranean') {
      advice.push("En climat méditerranéen, l'été est critique. Mulche tes pieds de tomates pour conserver l'humidité du sol.")
    } else {
      advice.push("Pas de pluie significative cette semaine — arrose en profondeur le matin avant 9h pour éviter l'évaporation.")
    }
  }

  if (gardenSeason === 'early_spring' && frostRisk.level !== 'none') {
    if (climateZone === 'oceanic') {
      advice.push("En Bretagne et sur le littoral atlantique, les gelées tardives d'avril sont fréquentes. Attends encore avant de sortir tes plants.")
    } else if (climateZone === 'mountain') {
      advice.push("En altitude, les gelées printanières sont possibles jusqu'en mai. Garde tes plants sensibles à l'abri encore quelques semaines.")
    } else {
      advice.push(`Risque de gel encore présent (min. prévue : ${frostRisk.minTemp.toFixed(0)}°C). Ne sors pas tes plants fragiles la nuit.`)
    }
  }

  if (gardenSeason === 'autumn' && climateZone === 'mountain') {
    advice.push("En altitude, l'automne arrive vite. Rentre tes bulbes sensibles avant mi-octobre et paille le pied de tes arbustes.")
  }

  if (rainDays >= 3) {
    advice.push("Semaine pluvieuse — pas besoin d'arroser. Profites-en pour composter, tuteurer ou planifier tes semis.")
  }

  if (gardenSeason === 'spring' && frostRisk.level === 'none' && wateringIndex.score <= 5) {
    advice.push("Conditions idéales cette semaine pour transplanter des plants ou semer en pleine terre.")
  }

  if (gardenSeason === 'late_summer') {
    advice.push("Fin d'été : pense à récupérer tes graines et à préparer tes massifs pour les plantations d'automne (bulbes, vivaces).")
  }

  if (gardenSeason === 'winter') {
    advice.push("Profite de cette période de repos pour planifier tes semis de printemps et commander tes graines.")
  }

  // Ensure at least one piece of advice
  if (advice.length === 0) {
    advice.push("Continue l'entretien régulier de ton jardin — surveille l'arrosage selon les besoins de chaque plante.")
  }

  return advice.slice(0, 4)
}

// ─── 7. Master builder ────────────────────────────────────────────────────────

export function buildGardenContext(
  lat: number,
  lon: number,
  elevation: number,
  weatherData: WeatherData,
  plants: Plant[],
): GardenContext {
  const climateZone = detectClimateZone(lat, lon, elevation)
  const gardenSeason = detectGardenSeason(new Date(), climateZone, weatherData.forecast)
  const frostRisk = assessFrostRisk(weatherData.forecast)
  const wateringIndex = computeWateringIndex(weatherData.current, weatherData.forecast)
  const plantAlerts = generatePlantAlerts(plants, frostRisk, wateringIndex, weatherData.forecast, gardenSeason)
  const generalAdvice = buildGeneralAdvice(climateZone, gardenSeason, frostRisk, wateringIndex, weatherData.forecast)

  return {
    climateZone,
    climateZoneLabel: climateZoneLabels[climateZone],
    gardenSeason,
    gardenSeasonLabel: gardenSeasonLabels[gardenSeason],
    frostRisk,
    wateringIndex,
    plantAlerts,
    elevation,
    generalAdvice,
  }
}
