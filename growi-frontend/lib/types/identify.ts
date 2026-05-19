export type IdentifyConfidence = 'high' | 'medium' | 'low'
export type IdentifyDifficulty = 'easy' | 'medium' | 'demanding'

export interface IdentifyCareGuide {
  watering: string
  light: string
  soil: string
  temperature: string
  difficulty: IdentifyDifficulty
}

export interface IdentifySuccess {
  identified: true
  confidence: IdentifyConfidence
  commonName: string
  scientificName: string
  family: string
  emoji: string
  shortDescription: string
  careGuide: IdentifyCareGuide
  funFact: string
  warnings: string[]
  tags: string[]
}

export interface IdentifyFailure {
  identified: false
  reason: string
}

export type IdentifyResult = IdentifySuccess | IdentifyFailure

export type IdentifyApiResponse = IdentifyResult & {
  encyclopediaSlug: string | null
  encyclopediaName: string | null
}
