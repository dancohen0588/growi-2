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

// ─── Connexion par un fournisseur d'identité ───────────────────────────────

/** Fournisseurs acceptés par `/api/v1/auth/apple` et `/api/v1/auth/google`. */
export const SOCIAL_PROVIDERS = ['apple', 'google'] as const
export const socialProviderSchema = z.enum(SOCIAL_PROVIDERS)
export type SocialProvider = z.infer<typeof socialProviderSchema>

export const socialLoginSchema = z.object({
  /** Jeton d'identité OIDC signé par le fournisseur. */
  identityToken: z.string().min(1, "Jeton d'identité requis"),
  /**
   * Valeur à usage unique transmise au fournisseur, qu'il réinscrit dans le
   * jeton : la retrouver prouve que ce jeton répond bien à *notre* demande et
   * n'est pas rejoué.
   */
  nonce: z.string().min(1).max(200).optional(),
  /**
   * Apple ne communique le nom qu'à la toute première autorisation, et jamais
   * dans le jeton. Ne pas le retenir ce jour-là, c'est le perdre pour de bon.
   */
  firstName: nullish(z.string().max(100)),
  lastName: nullish(z.string().max(100)),
  deviceInfo: deviceInfoSchema,
})

export type SocialLoginInput = z.infer<typeof socialLoginSchema>

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
