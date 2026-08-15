import { z } from 'zod'

import { idSchema, nullish } from './common'

/**
 * Contrats des endpoints `/api/v1/auth/*` — l'authentification par jetons de
 * l'app mobile. Le web continue d'utiliser la session NextAuth par cookies.
 */

/** Description libre de l'appareil, pour que l'utilisateur reconnaisse ses sessions. */
const deviceInfoSchema = z.string().max(200).optional()

export const mobileLoginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  deviceInfo: deviceInfoSchema,
})

export type MobileLoginInput = z.infer<typeof mobileLoginSchema>

export const mobileRegisterSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit comporter au moins 2 caractères'),
  email: z.email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères'),
  deviceInfo: deviceInfoSchema,
})

export type MobileRegisterInput = z.infer<typeof mobileRegisterSchema>

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Jeton de rafraîchissement requis'),
})

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>

/** Identité minimale renvoyée à la connexion ; le profil complet vient de `GET /me`. */
export const authUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  firstName: nullish(z.string()),
})

export type AuthUser = z.infer<typeof authUserSchema>

export const authTokensSchema = z.object({
  /** JWT à placer dans `Authorization: Bearer …`. Courte durée de vie. */
  accessToken: z.string(),
  /** Jeton opaque, à conserver dans le stockage sécurisé de l'appareil. */
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  /** Durée de validité de l'access token, en secondes. */
  expiresIn: z.number().int().positive(),
  user: authUserSchema,
})

export type AuthTokens = z.infer<typeof authTokensSchema>
