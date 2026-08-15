/**
 * Service identification de plante par photo (Gemini).
 *
 * Toute la logique d'appel au modèle et de rapprochement avec l'encyclopédie
 * vit ici ; la route API se contente de l'authentification et du transport.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

import { findCatalogMatch } from '@/lib/services/plant.service'
import { ServiceError } from '@/lib/services/errors'
import type { IdentifyApiResponse, IdentifyResult } from '@/lib/types/identify'

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// Modèles essayés dans l'ordre — quotas séparés, donc un 429/503 sur l'un peut
// tout de même passer sur le suivant. 2.5-flash = meilleure qualité,
// 2.5-flash-lite = moins souvent saturé, 2.0-flash = repli historique.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const

const SYSTEM_PROMPT = `Tu es un expert botaniste de l'application Growi. Analyse la photo fournie et identifie la plante.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans \`\`\`json, sans commentaires.

Schéma JSON attendu :
{
  "identified": true,
  "confidence": "high" | "medium" | "low",
  "commonName": "Nom commun en français",
  "scientificName": "Genre espèce",
  "family": "Famille botanique",
  "emoji": "Un emoji représentatif",
  "shortDescription": "Description courte en 1-2 phrases, ton accessible et chaleureux",
  "careGuide": {
    "watering": "Conseil arrosage concis",
    "light": "Besoin en lumière",
    "soil": "Type de substrat idéal",
    "temperature": "Plage de températures tolérées",
    "difficulty": "easy" | "medium" | "demanding"
  },
  "funFact": "Une anecdote originale ou un fait surprenant sur cette plante",
  "warnings": ["Liste de points d'attention (toxicité, allergènes, invasive...)"],
  "tags": ["tag1", "tag2", "tag3"]
}

Si tu ne peux pas identifier la plante (image floue, non-plante, ambiguïté forte), réponds :
{
  "identified": false,
  "reason": "Explication courte en français de pourquoi l'identification échoue"
}

Règles :
- commonName TOUJOURS en français
- scientificName en latin (Genre espèce)
- shortDescription en français, 1-2 phrases max, ton bienveillant
- funFact original et mémorisable, pas générique
- Si plusieurs plantes visibles, identifier la plante principale au premier plan
- Ne pas inventer une espèce si tu n'es pas sûr — préférer confidence "low" avec best guess`

function stripFence(raw: string): string {
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

/**
 * Valide un data URL d'image et renvoie ses composants.
 * @throws ServiceError('INVALID_INPUT')
 */
export function parseImagePayload(imageBase64: unknown): { mimeType: string; data: string } {
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
 * Identifie une plante à partir d'une image, et la rapproche d'une fiche de
 * l'encyclopédie quand c'est possible.
 *
 * Ne lève pas en cas d'échec du modèle : renvoie une réponse `identified:
 * false` porteuse d'un message explicatif, comme le fait déjà l'écran
 * d'identification.
 *
 * @throws ServiceError('UNAVAILABLE') si la clé API n'est pas configurée,
 * ServiceError('INVALID_INPUT') si l'image est inexploitable.
 */
export async function identifyPlant(imageBase64: unknown): Promise<IdentifyApiResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new ServiceError(
      'UNAVAILABLE',
      "Service d'identification indisponible (clé API manquante).",
    )
  }

  const image = parseImagePayload(imageBase64)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  let raw: string | null = null
  let lastStatus: number | null = null

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    })

    try {
      const response = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { inlineData: { data: image.data, mimeType: image.mimeType } },
      ])
      raw = response.response.text()
      break
    } catch (err) {
      const status =
        typeof err === 'object' && err && 'status' in err
          ? ((err as { status?: number }).status ?? null)
          : null
      lastStatus = status
      console.error(
        `[identify-plant] Gemini error (model=${modelName}, status=${status})`,
        err,
      )
      // On ne réessaie que sur les erreurs transitoires : surcharge (503) ou quota (429).
      if (status !== 503 && status !== 429) break
    }
  }

  if (raw === null) {
    const reason =
      lastStatus === 503
        ? 'Service Gemini momentanément surchargé. Veuillez réessayer dans quelques instants.'
        : lastStatus === 429
          ? 'Quota Gemini dépassé pour le moment. Veuillez réessayer plus tard.'
          : "Erreur d'analyse, veuillez réessayer."
    return { identified: false, reason, encyclopediaSlug: null, encyclopediaName: null }
  }

  let result: IdentifyResult
  try {
    result = JSON.parse(stripFence(raw)) as IdentifyResult
  } catch {
    return {
      identified: false,
      reason: "Erreur d'analyse, veuillez réessayer.",
      encyclopediaSlug: null,
      encyclopediaName: null,
    }
  }

  let encyclopediaSlug: string | null = null
  let encyclopediaName: string | null = null

  if (result.identified) {
    try {
      const match = await findCatalogMatch(result.commonName, result.scientificName)
      if (match?.slug) {
        encyclopediaSlug = match.slug
        encyclopediaName = match.commonName
      }
    } catch (err) {
      console.error('[identify-plant] catalog lookup failed', err)
    }
  }

  return { ...result, encyclopediaSlug, encyclopediaName }
}
