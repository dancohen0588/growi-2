import { z } from 'zod'

export const plantSchema = z.object({
  name:                  z.string().min(2, 'Nom requis (2 caractères min.)').max(50),
  scientificName:        z.string().max(80).optional(),
  emoji:                 z.string().min(1, 'Choisis un emoji').max(4),
  // URL renvoyée par /api/v1/uploads ; vide = pas de photo.
  photoUrl:              z.string().max(2000).optional(),
  category:              z.enum(['interieur', 'potager', 'fleurs', 'arbres', 'aromatiques']),
  location:              z.enum(['interieur', 'exterieur', 'serre', 'balcon']),
  zone:                  z.string().max(50).optional(),
  datePlanted:           z.string().optional(),
  wateringFrequencyDays: z.number().int().min(1, 'Min. 1 jour').max(365),
  sunExposure:           z.enum(['full', 'partial', 'shade']),
  soilType:              z.string().max(100).optional(),
  wateringDifficulty:    z.enum(['easy', 'medium', 'demanding']),
  healthStatus:          z.enum(['healthy', 'warning', 'critical']),
  healthNote:            z.string().max(200).optional(),
  notes:                 z.string().max(500).optional(),
})

export type PlantFormValues = z.infer<typeof plantSchema>
