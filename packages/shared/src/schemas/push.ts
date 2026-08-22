import { z } from 'zod'

/**
 * Contrat des routes `/api/v1/me/push-tokens` — enregistrement des appareils
 * pour les notifications.
 *
 * Un jeton Expo identifie un appareil, pas une personne : le même compte peut
 * en avoir plusieurs, et un même appareil peut changer de jeton après une
 * réinstallation.
 */

export const PUSH_PLATFORMS = ['ios', 'android'] as const
export const pushPlatformSchema = z.enum(PUSH_PLATFORMS)
export type PushPlatform = z.infer<typeof pushPlatformSchema>

/**
 * Format d'un jeton Expo : `ExponentPushToken[…]` ou `ExpoPushToken[…]`.
 * Le vérifier évite d'appeler l'API Expo avec des valeurs qu'elle refusera.
 */
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\s\]]+\]$/

export const registerPushTokenSchema = z.object({
  token: z
    .string()
    .max(200)
    .regex(EXPO_PUSH_TOKEN_PATTERN, 'Jeton de notification invalide'),
  platform: pushPlatformSchema,
})

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>

export const unregisterPushTokenSchema = z.object({
  token: z.string().max(200),
})

export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>
