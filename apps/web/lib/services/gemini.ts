/**
 * Socle commun des appels Gemini (identification, diagnostic).
 *
 * Ce module ne connaît aucun métier : il valide une image, appelle le modèle
 * avec repli, et rend du texte brut. Le prompt, le schéma de sortie et
 * l'interprétation du résultat appartiennent à chaque service appelant.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

import { ServiceError } from '@/lib/services/errors'

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// Modèles essayés dans l'ordre — quotas séparés, donc un 429/503 sur l'un peut
// tout de même passer sur le suivant. 2.5-flash = meilleure qualité,
// 2.5-flash-lite = moins souvent saturé, 2.0-flash = repli historique.
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const

/** Retire la clôture markdown qu'un modèle ajoute parfois malgré la consigne. */
export function stripFence(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
  }
  return trimmed
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

export function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export type GeminiImage = { mimeType: string; data: string }

/**
 * Valide un data URL d'image et renvoie ses composants.
 * @throws ServiceError('INVALID_INPUT')
 */
export function parseImagePayload(imageBase64: unknown): GeminiImage {
  if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
    throw new ServiceError('INVALID_INPUT', 'Image invalide. Fournir un data URL base64 valide.')
  }

  const parsed = parseDataUrl(imageBase64)
  if (!parsed) {
    throw new ServiceError('INVALID_INPUT', "Format d'image non reconnu.")
  }

  if (estimateBase64Bytes(parsed.data) > MAX_IMAGE_BYTES) {
    throw new ServiceError('INVALID_INPUT', 'Image trop volumineuse (maximum 4 Mo).')
  }

  return parsed
}

/** @throws ServiceError('UNAVAILABLE') si `GEMINI_API_KEY` n'est pas configurée. */
export function requireGeminiKey(message: string): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ServiceError('UNAVAILABLE', message)
  return key
}

export type GeminiSuccess = { ok: true; raw: string; model: string }
export type GeminiFailure = { ok: false; reason: string }

/**
 * Message d'échec destiné à l'utilisateur, par cause.
 *
 * Il est délibérément le même pour l'identification et le diagnostic : un
 * quota dépassé se raconte de la même façon quel que soit l'écran.
 */
export const GEMINI_FAILURE_MESSAGES = {
  overloaded:
    'Service Gemini momentanément surchargé. Veuillez réessayer dans quelques instants.',
  quota: 'Quota Gemini dépassé pour le moment. Veuillez réessayer plus tard.',
  failed: "Erreur d'analyse, veuillez réessayer.",
} as const

/**
 * Appelle Gemini avec repli sur les modèles suivants en cas d'erreur
 * transitoire, et rend le texte brut de la première réponse obtenue.
 *
 * Ne lève jamais pour une défaillance du modèle : un échec est une donnée que
 * l'appelant transforme en réponse « pas de résultat » à l'utilisateur, pas une
 * exception à remonter en 500.
 */
export async function generateJson(
  parts: Array<{ text: string } | { inlineData: GeminiImage }>,
  options: {
    apiKey: string
    maxOutputTokens: number
    /** Préfixe des logs, ex. `identify-plant`. */
    logLabel: string
  },
): Promise<GeminiSuccess | GeminiFailure> {
  const genAI = new GoogleGenerativeAI(options.apiKey)
  let lastStatus: number | null = null

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: options.maxOutputTokens,
        responseMimeType: 'application/json',
      },
    })

    try {
      const response = await model.generateContent(parts)
      return { ok: true, raw: response.response.text(), model: modelName }
    } catch (err) {
      const status =
        typeof err === 'object' && err && 'status' in err
          ? ((err as { status?: number }).status ?? null)
          : null
      lastStatus = status
      console.error(`[${options.logLabel}] Gemini error (model=${modelName}, status=${status})`, err)
      // On ne réessaie que sur les erreurs transitoires : surcharge (503) ou quota (429).
      if (status !== 503 && status !== 429) break
    }
  }

  return {
    ok: false,
    reason:
      lastStatus === 503
        ? GEMINI_FAILURE_MESSAGES.overloaded
        : lastStatus === 429
          ? GEMINI_FAILURE_MESSAGES.quota
          : GEMINI_FAILURE_MESSAGES.failed,
  }
}
