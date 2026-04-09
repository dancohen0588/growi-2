// growi-frontend/lib/schemas/profil-schema.ts
import { z } from 'zod'

export const profilSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court (2 caractères min.)'),
  lastName: z.string().min(2, 'Nom trop court (2 caractères min.)'),
  email: z.string().email('Email invalide — vérifie le format : prenom@domaine.fr'),
  address: z.string().optional(),
  gardenType: z
    .enum(['potager', 'ornement', 'mixte', 'interieur', 'balcon'])
    .optional(),
})

export type ProfilInput = z.infer<typeof profilSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z
      .string()
      .min(8, 'Mot de passe trop court (8 caractères min.)')
      .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
