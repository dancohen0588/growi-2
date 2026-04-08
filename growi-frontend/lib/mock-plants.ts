export type PlantLocation = 'interieur' | 'exterieur' | 'serre' | 'balcon'
export type SunExposure = 'full' | 'partial' | 'shade'
export type HealthStatus = 'healthy' | 'warning' | 'critical'
export type WateringDifficulty = 'easy' | 'medium' | 'demanding'

export interface Plant {
  id: string
  name: string
  scientificName?: string
  emoji: string
  category: 'interieur' | 'potager' | 'fleurs' | 'arbres' | 'aromatiques'
  location: PlantLocation
  zone?: string
  dateAdded: string
  datePlanted?: string
  photoUrl?: string
  wateringFrequencyDays: number
  lastWateredDate?: string
  nextWateringDate?: string
  sunExposure: SunExposure
  soilType?: string
  wateringDifficulty: WateringDifficulty
  fertilizerMonths?: number[]
  healthStatus: HealthStatus
  healthNote?: string
  description: string
  careTips: {
    watering: string
    light: string
    soil: string
    pruning?: string
    diseases?: string
    winter?: string
  }
  funFact?: string
}

export const mockPlants: Plant[] = [
  {
    id: '1',
    name: 'Monstera',
    scientificName: 'Monstera deliciosa',
    emoji: '🌿',
    category: 'interieur',
    location: 'interieur',
    zone: 'Salon',
    dateAdded: '2024-03-15',
    datePlanted: '2024-03-15',
    wateringFrequencyDays: 7,
    lastWateredDate: '2025-03-28',
    nextWateringDate: '2025-04-04',
    sunExposure: 'partial',
    soilType: 'Terreau universel bien drainant',
    wateringDifficulty: 'easy',
    fertilizerMonths: [4, 5, 6, 7, 8, 9],
    healthStatus: 'healthy',
    description: "Le Monstera est une plante tropicale iconique, connue pour ses grandes feuilles découpées. Facile à entretenir, il s'adapte bien à la vie en intérieur.",
    careTips: {
      watering: "Arrose quand les 3 premiers centimètres de terre sont secs. En général 1 fois par semaine en été, toutes les 2 semaines en hiver.",
      light: "Lumière indirecte et lumineuse. Évite le soleil direct qui brûle les feuilles.",
      soil: "Terreau universel mélangé à 20% de perlite pour assurer un bon drainage.",
      pruning: "Taille les feuilles abîmées à ras du pétiole. Pas de taille de forme nécessaire.",
      diseases: "Surveille les cochenilles farineuses sous les feuilles. Traite avec de l'huile de neem.",
      winter: "Réduis l'arrosage à 1 fois toutes les 2-3 semaines. Éloigne-le des radiateurs.",
    },
    funFact: "En conditions idéales, le Monstera peut produire des fruits comestibles qui ressemblent à une épis de maïs vert !",
  },
  {
    id: '2',
    name: 'Tomates cerises',
    scientificName: 'Solanum lycopersicum',
    emoji: '🍅',
    category: 'potager',
    location: 'exterieur',
    zone: 'Carré potager Nord',
    dateAdded: '2025-04-01',
    datePlanted: '2025-04-01',
    wateringFrequencyDays: 2,
    lastWateredDate: '2025-04-05',
    nextWateringDate: '2025-04-07',
    sunExposure: 'full',
    soilType: 'Terreau potager enrichi en compost',
    wateringDifficulty: 'medium',
    fertilizerMonths: [5, 6, 7, 8],
    healthStatus: 'warning',
    healthNote: "Quelques feuilles du bas jaunissent — surveille l'arrosage",
    description: "La tomate cerise est la star du potager ! Productive, colorée, et délicieuse, elle se cultive aussi bien en pleine terre qu'en pot ou en sac de culture.",
    careTips: {
      watering: "Arrose régulièrement à la base, sans mouiller le feuillage. En été, 2 fois par jour par fortes chaleurs.",
      light: "Plein soleil indispensable — 6h minimum par jour pour une bonne fructification.",
      soil: "Sol riche en matière organique, bien drainant. Ajoute du compost au moment de la plantation.",
      pruning: "Supprime les gourmands (pousses entre tige et feuille) pour concentrer l'énergie sur les fruits.",
      diseases: "Surveille le mildiou (taches brunes sur feuilles). Aère bien le plant. Traite au cuivre en préventif.",
      winter: "Plante annuelle — à renouveler chaque année.",
    },
    funFact: "La tomate est techniquement un fruit, mais culinairement traitée comme un légume depuis une décision de la Cour Suprême américaine en 1893.",
  },
  {
    id: '3',
    name: 'Lavande',
    scientificName: 'Lavandula angustifolia',
    emoji: '💜',
    category: 'fleurs',
    location: 'exterieur',
    zone: 'Massif Sud',
    dateAdded: '2024-06-10',
    wateringFrequencyDays: 14,
    lastWateredDate: '2025-03-25',
    nextWateringDate: '2025-04-08',
    sunExposure: 'full',
    soilType: 'Sol calcaire, bien drainant, pauvre',
    wateringDifficulty: 'easy',
    fertilizerMonths: [3, 4],
    healthStatus: 'healthy',
    description: "La lavande est une vivace méditerranéenne ultra résistante à la sécheresse. Mellifère et parfumée, elle attire les pollinisateurs et parfume le jardin tout l'été.",
    careTips: {
      watering: "Très sobre en eau — attends que la terre soit bien sèche avant d'arroser. L'excès d'eau est son ennemi n°1.",
      light: "Plein soleil impératif. Ne tolère pas l'ombre.",
      soil: "Sol pauvre, sec et bien drainé. Elle pousse même dans les rocailles. N'enrichis pas le sol.",
      pruning: "Taille après la floraison (août) en coupant les tiges fleuries à 2/3. Taille légère en mars pour stimuler.",
      winter: "Rustique jusqu'à -15°C. Pas de protection nécessaire dans la plupart des régions françaises.",
    },
    funFact: "Une lavande peut vivre plus de 20 ans si elle est bien taillée régulièrement !",
  },
  {
    id: '4',
    name: 'Basilic',
    scientificName: 'Ocimum basilicum',
    emoji: '🌱',
    category: 'aromatiques',
    location: 'balcon',
    zone: 'Balcon cuisine',
    dateAdded: '2025-03-20',
    wateringFrequencyDays: 2,
    lastWateredDate: '2025-04-06',
    nextWateringDate: '2025-04-08',
    sunExposure: 'full',
    soilType: 'Terreau aromatiques + sable',
    wateringDifficulty: 'medium',
    healthStatus: 'healthy',
    description: "Le basilic est l'aromate indispensable de la cuisine méditerranéenne. À garder près de la cuisine pour avoir toujours des feuilles fraîches à portée de main.",
    careTips: {
      watering: "Arrose régulièrement sans détremper. Préfère un arrosage par le bas (soucoupe). Craint les coups de sécheresse.",
      light: "Plein soleil ou mi-ombre légère. Protège du vent froid.",
      soil: "Terreau léger et bien drainé. Mélange avec du sable si le pot n'a pas de trous.",
      pruning: "Pince régulièrement les fleurs pour prolonger la production de feuilles. Cueille en pinçant les sommets.",
      diseases: "Surveille le mildiou du basilic (feuilles qui noircissent). Évite de mouiller le feuillage.",
    },
    funFact: "Placer un pot de basilic près d'une fenêtre éloigne naturellement les moustiques !",
  },
  {
    id: '5',
    name: 'Ficus lyrata',
    scientificName: 'Ficus lyrata',
    emoji: '🌳',
    category: 'interieur',
    location: 'interieur',
    zone: 'Bureau',
    dateAdded: '2023-11-05',
    wateringFrequencyDays: 10,
    lastWateredDate: '2025-03-27',
    nextWateringDate: '2025-04-06',
    sunExposure: 'partial',
    soilType: 'Terreau universel + perlite',
    wateringDifficulty: 'demanding',
    fertilizerMonths: [4, 5, 6, 7, 8],
    healthStatus: 'critical',
    healthNote: "Feuilles qui tombent — probablement un excès d'eau ou un choc thermique",
    description: "Le Ficus lyrata (ou Figuier lyre) est la plante tendance des intérieurs design. Capricieux mais spectaculaire, il récompense les soins avec de magnifiques grandes feuilles.",
    careTips: {
      watering: "Arrose quand les 3-4 cm de surface sont secs. N'arrose jamais si la terre est encore humide en profondeur.",
      light: "Lumière vive et indirecte. Il souffre du soleil direct. Ne le déplace PAS une fois installé.",
      soil: "Terreau universel avec 30% de perlite. Rempote tous les 2 ans au printemps.",
      pruning: "Pas de taille nécessaire. Essuie les grandes feuilles avec un chiffon humide pour favoriser la photosynthèse.",
      diseases: "Les feuilles qui tombent signalent un stress : changement d'emplacement, courant d'air, arrosage inadapté.",
      winter: "Maintiens une température min. de 12°C. Éloigne des fenêtres froides et des radiateurs.",
    },
    funFact: "Le Ficus lyrata peut perdre toutes ses feuilles après un simple déménagement… puis en refaire pousser de nouvelles dans son nouvel emplacement.",
  },
  {
    id: '6',
    name: 'Rosier grimpant',
    scientificName: 'Rosa',
    emoji: '🌹',
    category: 'fleurs',
    location: 'exterieur',
    zone: 'Pergola',
    dateAdded: '2023-04-20',
    wateringFrequencyDays: 5,
    lastWateredDate: '2025-04-03',
    nextWateringDate: '2025-04-08',
    sunExposure: 'full',
    soilType: 'Terre de jardin amendée + fumier',
    wateringDifficulty: 'medium',
    fertilizerMonths: [3, 4, 5, 6],
    healthStatus: 'healthy',
    description: "Le rosier grimpant habille pergolas et murs de son feuillage et de ses fleurs généreuses. Bien entretenu, il peut fleurir de mai à octobre.",
    careTips: {
      watering: "Arrose profondément à la base, 2 à 3 fois par semaine en été. Évite de mouiller fleurs et feuilles.",
      light: "Plein soleil ou mi-ombre légère. Au moins 5h de soleil par jour pour une belle floraison.",
      soil: "Sol riche, profond, bien drainé. Apporte du compost en mars et en juin.",
      pruning: "Taille légère en février — supprime le bois mort et les branches croisées. Rabats légèrement après chaque vague de floraison.",
      diseases: "Surveille la rouille (pustules orangées sous les feuilles) et le black-spot (taches noires). Traite au soufre ou à la bouillie bordelaise.",
      winter: "Paille le pied en novembre. Couvre les greffes avec du paillage si gel fort prévu.",
    },
    funFact: "Certains rosiers grimpants anciens, non traités, peuvent vivre plus de 200 ans !",
  },
]

export function getPlantById(id: string): Plant | undefined {
  return mockPlants.find(p => p.id === id)
}

/**
 * Returns all plants for a given user.
 * In the mock, all plants belong to seed-user-1.
 */
export function getUserPlants(userId: string): Plant[] {
  if (userId === 'seed-user-1') return mockPlants
  return []
}

export const healthStatusConfig: Record<HealthStatus, { label: string; color: string; icon: string }> = {
  healthy:  { label: 'En bonne santé', color: 'bg-lime/20 text-forest',  icon: '✅' },
  warning:  { label: 'À surveiller',   color: 'bg-sun/20 text-forest',   icon: '⚠️' },
  critical: { label: 'En danger',      color: 'bg-red-100 text-red-700', icon: '🚨' },
}

export const sunExposureConfig: Record<SunExposure, { label: string; icon: string }> = {
  full:    { label: 'Plein soleil', icon: '☀️' },
  partial: { label: 'Mi-ombre',    icon: '⛅' },
  shade:   { label: 'Ombre',       icon: '🌥️' },
}

export const locationConfig: Record<PlantLocation, { label: string; icon: string }> = {
  interieur: { label: 'Intérieur', icon: '🏠' },
  exterieur: { label: 'Extérieur', icon: '🌳' },
  serre:     { label: 'Serre',     icon: '🏡' },
  balcon:    { label: 'Balcon',    icon: '🌇' },
}

export const difficultyConfig: Record<WateringDifficulty, { label: string; color: string }> = {
  easy:      { label: 'Facile',     color: 'text-lime' },
  medium:    { label: 'Moyen',      color: 'text-sun'  },
  demanding: { label: 'Exigeant',   color: 'text-red-500' },
}

// Watering helpers

export function getDaysUntilWatering(plant: Plant): number {
  const today = new Date()
  const lastWatered = plant.lastWateredDate ? new Date(plant.lastWateredDate) : null
  if (!lastWatered) return 0
  const daysSince = Math.floor((today.getTime() - lastWatered.getTime()) / 86400000)
  return plant.wateringFrequencyDays - daysSince
}

export function getWateringProgress(plant: Plant): number {
  const today = new Date()
  const lastWatered = plant.lastWateredDate ? new Date(plant.lastWateredDate) : null
  if (!lastWatered) return 0
  const daysSince = Math.floor((today.getTime() - lastWatered.getTime()) / 86400000)
  return Math.min((daysSince / plant.wateringFrequencyDays) * 100, 100)
}

export function getWateringBarColor(progress: number): string {
  if (progress < 50) return 'bg-lime'
  if (progress < 80) return 'bg-sun'
  return 'bg-red-400'
}
