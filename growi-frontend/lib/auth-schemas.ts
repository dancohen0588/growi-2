// growi-frontend/lib/auth-schemas.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (6 caractères min.)'),
})

export const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Prénom requis (2 caractères min.)'),
    email: z.string().email('Email invalide'),
    password: z
      .string()
      .min(8, 'Mot de passe trop court (8 caractères min.)')
      .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
