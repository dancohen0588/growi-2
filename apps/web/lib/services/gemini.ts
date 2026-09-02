/**
 * Socle commun des appels Gemini (identification, diagnostic, chat).
 *
 * Ce module ne connaît aucun métier : il valide une image, appelle le modèle
 * avec repli, et rend du texte brut. Le prompt, le schéma de sortie et
 * l'interprétation du résultat appartiennent à chaque service appelant.
 */

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type GenerationConfig,
  type Part,
} from '@google/generative-ai'

import { ServiceError } from '@/lib/services/errors'

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// Modèles essayés dans l'ordre — quotas séparés, donc un 429/503 sur l'un peut
// tout de même passer sur le suivant. 2.5-flash = meilleure qualité,
// 2.5-flash-lite = moins souvent saturé.
//
// `gemini-2.0-flash` figurait ici en troisième : l'API répond désormais 404,
// le repli était donc inopérant depuis sa mise hors service.
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

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

/**
 * Décode une charge base64 en `ArrayBuffer` **autonome**, prêt pour le dépôt.
 *
 * `Buffer.from(…).buffer` ne convient pas : Node alloue les petits tampons
 * dans un pool partagé de 8 Ko, et l'`ArrayBuffer` sous-jacent est alors ce
 * pool entier — avec, autour de notre image, les octets d'autres traitements
 * en cours. On recopie donc la seule tranche qui nous appartient.
 */
export function toArrayBuffer(base64: string): ArrayBuffer {
  const bytes = Buffer.from(base64, 'base64')
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** @throws ServiceError('UNAVAILABLE') si `GEMINI_API_KEY` n'est pas configurée. */
export function requireGeminiKey(message: string): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ServiceError('UNAVAILABLE', message)
  return key
}

/**
 * Réglages d'appel, communs à tous les usages.
 *
 * `thinkingBudget: 0` coupe la réflexion des modèles 2.5. Ces jetons de
 * pensée s'imputent sur `maxOutputTokens` : sur un contexte un peu riche ils
 * dévoraient le budget (1 556 sur 2 000 mesurés), et la réponse revenait
 * tronquée au milieu du JSON. On ne demande pas au modèle de raisonner
 * longuement mais de rendre une structure à température nulle — la couper
 * supprime la troncature, et divise par trois les jetons facturés.
 *
 * Le cast est nécessaire tant qu'on est sur `@google/generative-ai` : ses
 * typages sont antérieurs à `thinkingConfig`, que l'API accepte pourtant.
 */
function generationConfig(maxOutputTokens: number): GenerationConfig {
  return {
    temperature: 0,
    maxOutputTokens,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingBudget: 0 },
  } as GenerationConfig & { thinkingConfig: { thinkingBudget: number } }
}

/**
 * Réglages de la conversation.
 *
 * On ne demande plus une structure mais une réponse écrite : la température
 * remonte, et `responseMimeType` disparaît — le forcer à `application/json`
 * rendrait du JSON là où le fil attend du texte. `thinkingBudget: 0` reste,
 * pour la même raison qu'ailleurs.
 */
export const CHAT_TEMPERATURE = 0.4

function chatGenerationConfig(maxOutputTokens: number): GenerationConfig {
  return {
    temperature: CHAT_TEMPERATURE,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 0 },
  } as GenerationConfig & { thinkingConfig: { thinkingBudget: number } }
}

/** Statut HTTP porté par une erreur du SDK, quand il y en a un. */
function httpStatusOf(err: unknown): number | null {
  return typeof err === 'object' && err && 'status' in err
    ? ((err as { status?: number }).status ?? null)
    : null
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
  /**
   * Un 400 porte presque toujours sur l'image : fichier tronqué, encodage
   * exotique, contenu illisible. Le dire évite de renvoyer l'utilisateur vers
   * un « réessayez » qui redonnera exactement le même résultat.
   */
  badImage: "Cette photo n'a pas pu être lue. Essaie une autre image, en JPEG ou PNG.",
  failed: "Erreur d'analyse, veuillez réessayer.",
} as const

/** Message à afficher d'après le statut du dernier échec. */
function failureReason(lastStatus: number | null): string {
  switch (lastStatus) {
    case 503:
      return GEMINI_FAILURE_MESSAGES.overloaded
    case 429:
      return GEMINI_FAILURE_MESSAGES.quota
    case 400:
      return GEMINI_FAILURE_MESSAGES.badImage
    default:
      return GEMINI_FAILURE_MESSAGES.failed
  }
}

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
      generationConfig: generationConfig(options.maxOutputTokens),
    })

    try {
      const response = await model.generateContent(parts)

      // Une réponse tronquée n'est pas une erreur pour le SDK : elle revient
      // avec un texte incomplet et un `finishReason`. Sans ce contrôle, on
      // rendait du JSON coupé à l'appelant, et le repli ne jouait jamais.
      if (response.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        console.error(
          `[${options.logLabel}] réponse tronquée (model=${modelName}, maxOutputTokens=${options.maxOutputTokens})`,
        )
        continue
      }

      return { ok: true, raw: response.response.text(), model: modelName }
    } catch (err) {
      const status = httpStatusOf(err)
      lastStatus = status
      console.error(`[${options.logLabel}] Gemini error (model=${modelName}, status=${status})`, err)
      // On ne réessaie que sur les erreurs transitoires : surcharge (503) ou quota (429).
      if (status !== 503 && status !== 429) break
    }
  }

  return { ok: false, reason: failureReason(lastStatus) }
}

// ─── Conversation ──────────────────────────────────────────────────────────

export type ChatPart = { text: string } | { inlineData: GeminiImage }

export type ChatTurn = { role: 'user' | 'model'; parts: ChatPart[] }

export type GeminiChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'functionCall'; name: string; args: unknown }
  | { type: 'done'; model: string }
  | { type: 'error'; reason: string }

/**
 * Conversation multi-tours, rendue au fil de l'eau.
 *
 * Deux différences de fond avec `generateJson`, au-delà du streaming :
 *
 * - **Le repli n'est possible que tant qu'aucun mot n'est parti.** Un flux à
 *   moitié envoyé ne se rejoue pas : l'utilisateur a déjà lu ces mots, les
 *   faire remplacer par ceux d'un autre modèle donnerait une réponse qui se
 *   contredit sous ses yeux. Passé le premier `text`, une panne devient un
 *   `error` que l'appelant affiche à la suite du texte reçu.
 * - **Une réponse tronquée reste servie.** `MAX_TOKENS` coupait un JSON en
 *   plein milieu et le rendait illisible ; une phrase coupée, elle, se lit
 *   encore, et l'utilisateur peut relancer.
 *
 * Ne lève jamais : toute défaillance est un événement `error` porteur d'un
 * message affichable.
 */
export async function* streamChat(input: {
  apiKey: string
  systemInstruction: string
  history: ChatTurn[]
  message: ChatPart[]
  tools?: FunctionDeclaration[]
  maxOutputTokens: number
  /** Préfixe des logs, ex. `chat`. */
  logLabel: string
}): AsyncGenerator<GeminiChatEvent> {
  const genAI = new GoogleGenerativeAI(input.apiKey)
  let lastStatus: number | null = null

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: chatGenerationConfig(input.maxOutputTokens),
      systemInstruction: input.systemInstruction,
      ...(input.tools?.length ? { tools: [{ functionDeclarations: input.tools }] } : {}),
    })

    let streamed = false
    try {
      const chat = model.startChat({ history: input.history as Content[] })
      const result = await chat.sendMessageStream(input.message as Part[])

      for await (const chunk of result.stream) {
        // `text()` et `functionCalls()` lèvent quand la réponse est bloquée
        // (sécurité, récitation) : le catch ci-dessous s'en charge.
        const delta = chunk.text()
        if (delta) {
          streamed = true
          yield { type: 'text', delta }
        }
        for (const call of chunk.functionCalls() ?? []) {
          yield { type: 'functionCall', name: call.name, args: call.args }
        }
      }

      yield { type: 'done', model: modelName }
      return
    } catch (err) {
      const status = httpStatusOf(err)
      lastStatus = status
      console.error(
        `[${input.logLabel}] Gemini stream error (model=${modelName}, status=${status}, streamed=${streamed})`,
        err,
      )
      if (streamed) break
      // Comme pour `generateJson` : on ne réessaie que sur surcharge ou quota.
      if (status !== 503 && status !== 429) break
    }
  }

  yield { type: 'error', reason: failureReason(lastStatus) }
}
