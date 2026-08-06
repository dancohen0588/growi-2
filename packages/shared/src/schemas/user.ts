import { z } from 'zod'

import {
  alertFrequencySchema,
  notificationChannelSchema,
  profileGardenTypeSchema,
} from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'

// ─── Configuration des alertes (User.alertConfig, colonne Json) ────────────

export const alertConfigSchema = z.object({
  frostAlert: z.boolean(),
  frostThreshold: z.number().int().min(-5).max(5),
  heatAlert: z.boolean(),
  rainAlert: z.boolean(),
  windAlert: z.boolean(),
  wateringReminder: z.boolean(),
  wateringFrequencyDays: z.number().int().min(1).max(30),
  repottingReminder: z.boolean(),
  pruningReminder: z.boolean(),
  seedingAlerts: z.boolean(),
  harvestAlerts: z.boolean(),
  channel: notificationChannelSchema,
  frequency: alertFrequencySchema,
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
})

export type AlertConfig = z.infer<typeof alertConfigSchema>

/** Mise à jour partielle des préférences d'alertes (`PATCH /me/alerts`). */
export const updateAlertConfigSchema = alertConfigSchema.partial()
export type UpdateAlertConfigInput = z.infer<typeof updateAlertConfigSchema>

/** Valeurs appliquées tant que l'utilisateur n'a rien personnalisé. */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  frostAlert: true,
  frostThreshold: 2,
  heatAlert: true,
  rainAlert: false,
  windAlert: false,
  wateringReminder: true,
  wateringFrequencyDays: 2,
  repottingReminder: true,
  pruningReminder: false,
  seedingAlerts: true,
  harvestAlerts: true,
  channel: 'push',
  frequency: 'immediate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

// ─── Utilisateur ───────────────────────────────────────────────────────────

/**
 * Utilisateur tel qu'exposé par l'API — le champ `password` du modèle Prisma
 * n'y figure jamais.
 */
export const publicUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: nullish(z.string()),
  image: nullish(z.string()),
  firstName: nullish(z.string()),
  lastName: nullish(z.string()),
  address: nullish(z.string()),
  gardenType: nullish(z.string()),
  avatarColor: nullish(z.string()),
  alertConfig: nullish(alertConfigSchema),
  plan: z.string(),
  timezone: z.string(),
  locationCity: nullish(z.string()),
  latitude: nullish(z.number()),
  longitude: nullish(z.number()),
  onboarded: z.boolean(),
  emailVerified: nullish(isoDateTimeSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PublicUser = z.infer<typeof publicUserSchema>

/** Profil tel que consommé par l'écran Paramètres (web) et l'onglet Profil (mobile). */
export const userProfileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  avatarColor: z.string().optional(),
  gardenType: profileGardenTypeSchema.optional(),
  timezone: z.string().optional(),
  latitude: nullish(z.number()),
  longitude: nullish(z.number()),
  alertConfig: alertConfigSchema,
})

export type UserProfile = z.infer<typeof userProfileSchema>

/** Corps accepté par `PATCH /api/user/profile` (et à terme `PATCH /api/v1/me`). */
export const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.email().optional(),
  address: nullish(z.string()),
  gardenType: nullish(profileGardenTypeSchema),
  avatarColor: nullish(z.string()),
  latitude: nullish(z.number()),
  longitude: nullish(z.number()),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ─── Formulaires (web et mobile) ───────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    firstName: z.string().min(2, 'Le prénom doit comporter au moins 2 caractères'),
    email: z.email('Email invalide'),
    password: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const profilSchema = z.object({
  firstName: z.string().min(2, 'Prénom trop court (2 caractères min.)'),
  lastName: z.string().min(2, 'Nom trop court (2 caractères min.)'),
  email: z.email('Email invalide — vérifie le format : prenom@domaine.fr'),
  address: z.string().optional(),
  gardenType: profileGardenTypeSchema.optional(),
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
