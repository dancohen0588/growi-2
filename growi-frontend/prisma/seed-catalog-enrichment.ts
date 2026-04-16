import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface EnrichmentData {
  scientificNameContains: string
  label: string
  data: Record<string, unknown>
}

const enrichments: EnrichmentData[] = [
  {
    scientificNameContains: 'Solanum lycopersicum',
    label: 'Tomate',
    data: {
      sowingMonthsIndoor: '[2,3]',
      sowingMonthsOutdoor: '[5]',
      transplantMonths: '[5,6]',
      harvestMonthsStart: 7,
      harvestMonthsEnd: 10,
      harvestDaysFromSowing: 120,
      floweringMonths: '[5,6,7,8]',
      frostSensitivity: 'HIGH',
      heatStressThresholdC: 35,
      wateringAdjHeat: 1.5,
      wateringAdjRain: 0.3,
      sunHoursNeeded: 6,
      fertilizerMonths: '[4,5,6,7]',
      fertilizationType: 'NPK',
      pruningMonths: '[5,6,7,8]',
      pruningType: 'FORMATIVE',
      treatmentSeasons: '["SPRING"]',
      mulchRecommended: true,
      winterProtectionType: 'NONE',
      careTipWatering: "Arrose régulièrement sans mouiller les feuilles — 2 à 3 fois par semaine en plein été.",
      careTipLight: "Minimum 6h de soleil direct par jour pour une belle fructification.",
      careTipSoil: "Sol riche, bien drainé, enrichi en compost. pH idéal : 6-6.8.",
      careTipPruning: "Supprime les gourmands (tiges entre tige principale et feuille) pour concentrer l'énergie sur les fruits.",
      careTipDiseases: "Traitement préventif au cuivre contre le mildiou dès les premières pluies de juin.",
      careTipWinter: "Plante annuelle — retire les pieds après la dernière récolte.",
      funFact: "La tomate est techniquement un fruit, mais culinairement considérée comme légume depuis un arrêt de la Cour Suprême américaine de 1893.",
    },
  },
  {
    scientificNameContains: 'Rosa',
    label: 'Rosier',
    data: {
      pruningMonths: '[2,3,9]',
      pruningType: 'HARD',
      floweringMonths: '[5,6,7,8,9]',
      frostSensitivity: 'LIGHT',
      fertilizerMonths: '[3,4,5,6]',
      fertilizationType: 'ORGANIC',
      treatmentSeasons: '["SPRING","AUTUMN"]',
      mulchRecommended: true,
      winterProtectionType: 'MULCH',
      sunHoursNeeded: 5,
      wateringAdjHeat: 1.3,
      careTipWatering: "Arrose au pied sans mouiller le feuillage pour éviter les maladies fongiques.",
      careTipLight: "Plein soleil idéal — au moins 5h par jour.",
      careTipSoil: "Sol argileux-calcaire, riche et bien drainé.",
      careTipPruning: "Taille courte en février-mars : coupe à 3-5 yeux au-dessus du sol pour stimuler les nouvelles pousses.",
      careTipDiseases: "Traitement préventif contre black-spot au printemps avec bouillie bordelaise ou soufre.",
      careTipWinter: "Butte le pied avec du paillis ou de la terre pour protéger le point de greffe.",
      funFact: "Il existe plus de 30 000 variétés de roses cultivées dans le monde.",
    },
  },
  {
    scientificNameContains: 'Lavandula',
    label: 'Lavande',
    data: {
      pruningMonths: '[3,8,9]',
      pruningType: 'LIGHT',
      floweringMonths: '[6,7,8]',
      frostSensitivity: 'NONE',
      fertilizerMonths: '[3]',
      fertilizationType: 'NONE',
      sunHoursNeeded: 6,
      wateringAdjHeat: 1.0,
      wateringAdjRain: 0.2,
      mulchRecommended: false,
      winterProtectionType: 'NONE',
      careTipWatering: "Très résistante à la sécheresse. Arrose uniquement si la terre est très sèche en été.",
      careTipLight: "Plein soleil indispensable — 6h minimum.",
      careTipSoil: "Sol pauvre, caillouteux, très bien drainé. Déteste les sols lourds et humides.",
      careTipPruning: "Taille après la floraison (août-septembre) en coupant les tiges florales et en arrondissant la touffe.",
      careTipWinter: "Très rustique — pas de protection nécessaire.",
      funFact: "La lavande repousse naturellement les moustiques et les pucerons — idéale en bordure de potager.",
    },
  },
  {
    scientificNameContains: 'Ocimum basilicum',
    label: 'Basilic',
    data: {
      sowingMonthsIndoor: '[2,3,4]',
      sowingMonthsOutdoor: '[5,6]',
      harvestMonthsStart: 6,
      harvestMonthsEnd: 10,
      floweringMonths: '[7,8,9]',
      frostSensitivity: 'HIGH',
      heatStressThresholdC: 38,
      fertilizerMonths: '[5,6,7,8]',
      fertilizationType: 'ORGANIC',
      sunHoursNeeded: 6,
      wateringAdjHeat: 1.5,
      mulchRecommended: true,
      winterProtectionType: 'INDOOR',
      pruningMonths: '[6,7,8,9]',
      pruningType: 'DEADHEADING',
      careTipWatering: "Arrose régulièrement, le matin de préférence. Le basilic aime l'humidité mais pas les pieds dans l'eau.",
      careTipLight: "Plein soleil ou mi-ombre — au moins 6h de lumière.",
      careTipSoil: "Sol riche, léger et bien drainé.",
      careTipPruning: "Pince les fleurs dès qu'elles apparaissent pour prolonger la production de feuilles.",
      careTipWinter: "Plante annuelle gélive. Rentre-le à l'intérieur dès que les nuits descendent sous 10°C.",
      funFact: "Le basilic est considéré comme une plante royale — son nom vient du grec 'basilikon' qui signifie 'royal'.",
    },
  },
  {
    scientificNameContains: 'Pelargonium',
    label: 'Géranium',
    data: {
      floweringMonths: '[5,6,7,8,9,10]',
      frostSensitivity: 'HIGH',
      fertilizerMonths: '[4,5,6,7,8,9]',
      fertilizationType: 'NPK',
      pruningMonths: '[3,4]',
      pruningType: 'DEADHEADING',
      sunHoursNeeded: 5,
      wateringAdjHeat: 1.3,
      repottingFreqMonths: 12,
      repottingSeasons: '["SPRING"]',
      winterProtectionType: 'INDOOR',
      careTipWatering: "Arrose quand le terreau est sec en surface. Évite l'excès d'eau qui fait pourrir les racines.",
      careTipLight: "Plein soleil — c'est la clé d'une floraison généreuse.",
      careTipSoil: "Terreau géranium ou universel enrichi de perlite pour le drainage.",
      careTipPruning: "Retire les fleurs fanées régulièrement pour stimuler la floraison.",
      careTipWinter: "Rentre les pots à l'abri du gel (5-10°C) et réduis fortement l'arrosage.",
      funFact: "Le géranium de balcon (Pelargonium) n'est pas un vrai géranium — les botanistes les ont séparés au XVIIIe siècle.",
    },
  },
  {
    scientificNameContains: 'Monstera deliciosa',
    label: 'Monstera',
    data: {
      frostSensitivity: 'HIGH',
      fertilizerMonths: '[4,5,6,7,8,9]',
      fertilizationType: 'NPK',
      repottingFreqMonths: 24,
      repottingSeasons: '["SPRING"]',
      winterProtectionType: 'INDOOR',
      sunHoursNeeded: 3,
      wateringAdjHeat: 1.2,
      careTipWatering: "Arrose quand les 3 premiers cm de terreau sont secs. En hiver, espace les arrosages.",
      careTipLight: "Lumière vive indirecte. Évite le soleil direct qui brûle les feuilles.",
      careTipSoil: "Terreau riche et bien drainé avec perlite. Le Monstera aime l'humidité mais pas les pieds dans l'eau.",
      careTipPruning: "Taille les feuilles jaunies ou abîmées à la base. Tuteure les tiges aériennes.",
      careTipDiseases: "Surveille les cochenilles et araignées rouges. Nettoie les feuilles régulièrement.",
      careTipWinter: "Réduis l'arrosage et éloigne des courants d'air froid. Minimum 15°C.",
      funFact: "Les trous dans les feuilles du Monstera ne sont pas un défaut — ils permettent à la pluie d'atteindre les racines dans la forêt tropicale.",
    },
  },
  {
    scientificNameContains: 'Epipremnum aureum',
    label: 'Pothos',
    data: {
      frostSensitivity: 'HIGH',
      fertilizerMonths: '[4,5,6,7,8]',
      fertilizationType: 'NPK',
      repottingFreqMonths: 24,
      repottingSeasons: '["SPRING"]',
      winterProtectionType: 'INDOOR',
      sunHoursNeeded: 2,
      careTipWatering: "Arrose quand le terreau est sec. Le pothos tolère un oubli mais déteste le sur-arrosage.",
      careTipLight: "Lumière indirecte à mi-ombre. S'adapte à presque toutes les conditions.",
      careTipSoil: "Terreau universel classique, bien drainé.",
      careTipPruning: "Taille les tiges trop longues pour encourager la ramification — les boutures reprennent facilement dans l'eau.",
      careTipWinter: "Éloigne des courants d'air froid. Minimum 10°C.",
      funFact: "Le Pothos est surnommé 'Devil's ivy' car il est quasi impossible à tuer — même dans l'obscurité.",
    },
  },
  {
    scientificNameContains: 'Ficus',
    label: 'Ficus',
    data: {
      frostSensitivity: 'HIGH',
      fertilizerMonths: '[4,5,6,7,8,9]',
      fertilizationType: 'NPK',
      repottingFreqMonths: 24,
      repottingSeasons: '["SPRING"]',
      winterProtectionType: 'INDOOR',
      sunHoursNeeded: 4,
      wateringAdjHeat: 1.2,
      pruningMonths: '[3,4]',
      pruningType: 'FORMATIVE',
      careTipWatering: "Arrose quand le terreau sèche en surface. Évite les excès : le Ficus déteste les pieds dans l'eau.",
      careTipLight: "Lumière vive indirecte. Évite de le déplacer — il perd ses feuilles au moindre changement.",
      careTipSoil: "Terreau plantes vertes classique avec bon drainage.",
      careTipPruning: "Taille de formation au printemps pour garder un port compact.",
      careTipDiseases: "Surveille cochenilles et araignées rouges, surtout en hiver quand l'air est sec.",
      careTipWinter: "Éloigne des radiateurs et des courants d'air. Brumise le feuillage si l'air est sec.",
      funFact: "Le Ficus benjamina peut vivre plus de 100 ans et atteindre 30 mètres dans son habitat naturel.",
    },
  },
  {
    scientificNameContains: 'Cucurbita pepo',
    label: 'Courgette',
    data: {
      sowingMonthsIndoor: '[3,4]',
      sowingMonthsOutdoor: '[5]',
      harvestMonthsStart: 6,
      harvestMonthsEnd: 10,
      harvestDaysFromSowing: 60,
      floweringMonths: '[6,7,8,9]',
      frostSensitivity: 'HIGH',
      heatStressThresholdC: 38,
      fertilizerMonths: '[5,6,7,8]',
      fertilizationType: 'ORGANIC',
      sunHoursNeeded: 6,
      wateringAdjHeat: 1.5,
      mulchRecommended: true,
      treatmentSeasons: '["SUMMER"]',
      winterProtectionType: 'NONE',
      careTipWatering: "Arrose abondamment au pied, surtout pendant la fructification. Paille le sol pour garder l'humidité.",
      careTipLight: "Plein soleil indispensable — 6h minimum.",
      careTipSoil: "Sol très riche en compost, profond et bien drainé.",
      careTipPruning: "Pas de taille nécessaire. Retire les feuilles oïdiées pour limiter la propagation.",
      careTipDiseases: "Traitement préventif contre l'oïdium avec du soufre ou du lait dilué.",
      careTipWinter: "Plante annuelle — arrache les pieds en fin de saison.",
      funFact: "Un seul pied de courgette peut produire jusqu'à 10 kg de fruits en une saison.",
    },
  },
  {
    scientificNameContains: 'Lactuca sativa',
    label: 'Laitue',
    data: {
      sowingMonthsIndoor: '[2,3]',
      sowingMonthsOutdoor: '[3,4,5,6,7,8,9]',
      harvestMonthsStart: 4,
      harvestMonthsEnd: 11,
      harvestDaysFromSowing: 50,
      frostSensitivity: 'LIGHT',
      heatStressThresholdC: 30,
      fertilizerMonths: '[4,5,6]',
      fertilizationType: 'ORGANIC',
      sunHoursNeeded: 4,
      wateringAdjHeat: 1.5,
      wateringAdjRain: 0.3,
      mulchRecommended: true,
      winterProtectionType: 'FLEECE',
      careTipWatering: "Arrose souvent et légèrement pour garder le sol frais. La laitue monte vite en graines si elle manque d'eau.",
      careTipLight: "Mi-ombre en été (les laitues montent en graines au soleil brûlant), plein soleil au printemps.",
      careTipSoil: "Sol frais, riche en humus, bien drainé.",
      careTipWinter: "Les variétés d'hiver supportent de légères gelées sous voile de forçage.",
      funFact: "Les Romains mangeaient de la laitue en fin de repas car ils croyaient qu'elle aidait à dormir — ce n'est pas tout à fait faux, elle contient du lactucarium aux propriétés sédatives.",
    },
  },
]

async function main() {
  console.log('🌱 Enrichissement du catalogue Growi...\n')

  for (const entry of enrichments) {
    const result = await prisma.plantCatalog.updateMany({
      where: {
        scientificName: { contains: entry.scientificNameContains },
      },
      data: entry.data as any,
    })

    if (result.count > 0) {
      console.log(`✅ ${entry.label} enrichie (${result.count} entrée${result.count > 1 ? 's' : ''})`)
    } else {
      console.log(`⚠️  ${entry.label} non trouvée dans le catalogue (scientificName contient "${entry.scientificNameContains}")`)
    }
  }

  console.log('\n🎉 Enrichissement terminé.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
