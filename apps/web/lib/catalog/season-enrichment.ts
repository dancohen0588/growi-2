/**
 * Compléter le calendrier d'entretien du catalogue — dormance, floraison,
 * repiquage, protection d'hiver, paillage, taille, fertilisation, traitement.
 *
 * Le moteur de conseils sait raisonner sur ces champs, mais le pipeline
 * d'import (`docs/plant_scraper`) ne les remplit pas : seules les plantes de
 * `seed-catalog-enrichment.ts` les portent. Sans eux, l'arrosage restait la
 * seule chose que le moteur avait à dire.
 *
 * Ce module est pur : le prompt, la validation de la réponse, et la fusion
 * avec la fiche. **On ne remplace jamais une valeur déjà renseignée** — une
 * fiche corrigée à la main l'emporte sur toute proposition. Le script
 * `scripts/catalog-enrich-seasons.ts` orchestre les appels.
 */

import { z } from 'zod'

export const SEASON_FIELDS = [
  'dormancyMonths',
  'floweringMonths',
  'transplantMonths',
  'pruningMonths',
  'fertilizerMonths',
  'treatmentSeasons',
  'winterProtectionType',
  'mulchRecommended',
  'careTipWinter',
] as const

export type SeasonField = (typeof SEASON_FIELDS)[number]

/** Ce qu'il faut savoir d'une fiche pour en proposer le calendrier. */
export interface CatalogSeasonInput {
  commonName: string
  scientificName: string
  family: string | null
  category: string
  indoor: boolean
  outdoor: boolean
  edible: boolean
  dormancyMonths: string | null
  floweringMonths: string | null
  transplantMonths: string | null
  pruningMonths: string | null
  fertilizerMonths: string | null
  treatmentSeasons: string | null
  winterProtectionType: string | null
  mulchRecommended: boolean
  careTipWinter: string | null
}

const months = z
  .array(z.number().int().min(1).max(12))
  .max(12)
  .nullable()
  .transform((list) => (list && list.length > 0 ? [...new Set(list)].sort((a, b) => a - b) : null))

const seasons = z
  .array(z.enum(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']))
  .max(4)
  .nullable()
  .transform((list) => (list && list.length > 0 ? [...new Set(list)] : null))

export const seasonProposalSchema = z.object({
  dormancyMonths: months,
  floweringMonths: months,
  transplantMonths: months,
  pruningMonths: months,
  fertilizerMonths: months,
  treatmentSeasons: seasons,
  winterProtectionType: z.enum(['NONE', 'MULCH', 'FLEECE', 'INDOOR']).nullable(),
  mulchRecommended: z.boolean().nullable(),
  careTipWinter: z.string().trim().min(10).max(280).nullable(),
})

export type SeasonProposal = z.output<typeof seasonProposalSchema>

/** Les champs encore vides de la fiche — les seuls qu'on demandera. */
export function missingSeasonFields(plant: CatalogSeasonInput): SeasonField[] {
  return SEASON_FIELDS.filter((field) => {
    // Un booléen n'est jamais vide : `false` est la valeur par défaut, pas une
    // réponse. On ne le propose qu'à la hausse, voir `mergeSeasonProposal`.
    if (field === 'mulchRecommended') return plant.mulchRecommended === false
    return plant[field] == null || plant[field] === ''
  })
}

export function buildSeasonPrompt(plant: CatalogSeasonInput): string {
  const place = [plant.indoor && 'intérieur', plant.outdoor && 'extérieur'].filter(Boolean).join(' et ')

  return `Tu es jardinier professionnel en France métropolitaine (climat tempéré, référence : région parisienne).
Pour la plante ci-dessous, donne son calendrier d'entretien **tel qu'un jardinier amateur le suivrait en France**.

Plante : ${plant.commonName} (${plant.scientificName})${plant.family ? `, famille ${plant.family}` : ''}
Catégorie : ${plant.category} — cultivée en ${place || 'extérieur'}${plant.edible ? ', comestible' : ''}

Réponds en JSON strict, exactement avec ces clés. Mois de 1 (janvier) à 12 (décembre).
Mets null quand le geste ne concerne pas cette plante ou quand tu n'es pas sûr : une case vide vaut mieux qu'une erreur.

{
  "dormancyMonths": [mois de repos végétatif, où la plante pousse à peine et boit peu] | null,
  "floweringMonths": [mois de floraison] | null,
  "transplantMonths": [mois où l'on installe au jardin les plants élevés au chaud — seulement pour ce qu'on sème à l'abri puis met en place dehors] | null,
  "pruningMonths": [mois de la taille principale] | null,
  "fertilizerMonths": [mois d'apport d'engrais] | null,
  "treatmentSeasons": ["SPRING" | "SUMMER" | "AUTUMN" | "WINTER" — saisons où un traitement préventif contre ses maladies courantes est utile] | null,
  "winterProtectionType": "NONE" (rustique, rien à faire) | "MULCH" (pailler le pied) | "FLEECE" (voile d'hivernage les nuits de gel) | "INDOOR" (à rentrer l'hiver) | null,
  "mulchRecommended": true si un paillage au pied lui profite, false sinon,
  "careTipWinter": "une ou deux phrases au tutoiement sur son entretien en hiver" | null
}

Règles :
- Une plante d'intérieur ne sort pas : "transplantMonths" null, "winterProtectionType" null.
- Ne propose pas de retirer les fleurs ni de tailler une plante comestible au moment de sa floraison.
- Aucun produit phytosanitaire de synthèse dans "careTipWinter".`
}

/**
 * Valide une réponse du modèle. `null` si elle n'a pas la forme attendue :
 * l'appelant passe à la plante suivante, rien n'est écrit.
 */
export function parseSeasonProposal(raw: string): SeasonProposal | null {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = seasonProposalSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Valeur prête à écrire en base, au format que lisent les règles. */
type SeasonUpdate = Partial<{
  dormancyMonths: string
  floweringMonths: string
  transplantMonths: string
  pruningMonths: string
  fertilizerMonths: string
  treatmentSeasons: string
  winterProtectionType: string
  mulchRecommended: boolean
  careTipWinter: string
}>

/**
 * Ce qu'on écrirait sur la fiche : uniquement les champs vides, uniquement
 * avec une valeur proposée.
 *
 * Deux garde-fous de cohérence, parce que le modèle s'y trompe parfois :
 * une plante sans culture en extérieur ne reçoit ni protection d'hiver ni
 * mois de mise en place au jardin ; `mulchRecommended` ne passe que de faux à
 * vrai, jamais l'inverse.
 */
export function mergeSeasonProposal(plant: CatalogSeasonInput, proposal: SeasonProposal): SeasonUpdate {
  const missing = new Set(missingSeasonFields(plant))
  const update: SeasonUpdate = {}
  const neverOutdoor = !plant.outdoor

  const listFields = [
    'dormancyMonths',
    'floweringMonths',
    'transplantMonths',
    'pruningMonths',
    'fertilizerMonths',
    'treatmentSeasons',
  ] as const

  for (const field of listFields) {
    const value = proposal[field]
    if (!missing.has(field) || !value) continue
    if (field === 'transplantMonths' && neverOutdoor) continue
    update[field] = JSON.stringify(value)
  }

  if (missing.has('winterProtectionType') && proposal.winterProtectionType && !neverOutdoor) {
    update.winterProtectionType = proposal.winterProtectionType
  }
  if (missing.has('mulchRecommended') && proposal.mulchRecommended === true && !neverOutdoor) {
    update.mulchRecommended = true
  }
  if (missing.has('careTipWinter') && proposal.careTipWinter) {
    update.careTipWinter = proposal.careTipWinter
  }

  return update
}
