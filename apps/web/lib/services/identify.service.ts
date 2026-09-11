/**
 * Service identification de plante par photo (Gemini).
 *
 * Toute la logique d'appel au modèle et de rapprochement avec l'encyclopédie
 * vit ici ; la route API se contente de l'authentification et du transport.
 * La mécanique Gemini elle-même (repli entre modèles, validation de l'image)
 * est partagée avec le diagnostic dans `lib/services/gemini.ts`.
 */

import { trackServer } from '@/lib/analytics/server'
import {
  estimateBase64Bytes,
  generateJson,
  parseImagePayload,
  requireGeminiKey,
  stripFence,
} from '@/lib/services/gemini'
import { findCatalogMatch } from '@/lib/services/plant.service'
import type { IdentifyApiResponse, IdentifyResult } from '@/lib/types/identify'

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
export async function identifyPlant(
  imageBase64: unknown,
  userId?: string | null,
): Promise<IdentifyApiResponse> {
  const apiKey = requireGeminiKey("Service d'identification indisponible (clé API manquante).")
  const image = parseImagePayload(imageBase64)
  const imageBytes = estimateBase64Bytes(image.data)

  // La latence mesurée est celle de **l'appel au modèle**, pas de la requête :
  // la recherche au catalogue et la sérialisation qui suivent ne disent rien
  // du coût de l'IA, et brouilleraient la comparaison entre modèles.
  const startedAt = Date.now()
  const response = await generateJson(
    [{ text: SYSTEM_PROMPT }, { inlineData: image }],
    { apiKey, maxOutputTokens: 1500, logLabel: 'identify-plant' },
  )
  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    if (userId) trackServer(userId, 'identify_failed', { reason: response.cause, model: null })
    return {
      identified: false,
      reason: response.reason,
      encyclopediaSlug: null,
      encyclopediaName: null,
    }
  }

  let result: IdentifyResult
  try {
    result = JSON.parse(stripFence(response.raw)) as IdentifyResult
  } catch {
    if (userId) {
      trackServer(userId, 'identify_failed', { reason: 'parse', model: response.model })
    }
    return {
      identified: false,
      reason: "Erreur d'analyse, veuillez réessayer.",
      encyclopediaSlug: null,
      encyclopediaName: null,
    }
  }

  if (userId) {
    trackServer(userId, 'identify_completed', {
      model: response.model,
      latency_ms: latencyMs,
      input_tokens: response.usage?.inputTokens ?? null,
      output_tokens: response.usage?.outputTokens ?? null,
      image_bytes: imageBytes,
      // Le service ne rend qu'une espèce : zéro quand il n'a rien reconnu.
      candidates_count: result.identified ? 1 : 0,
      top_confidence: result.identified ? result.confidence : null,
      // Les identifications authentifiées sont freinées par un débit horaire,
      // pas par un plafond de compte : il n'y a pas de reste à annoncer.
      quota_remaining: null,
    })
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
