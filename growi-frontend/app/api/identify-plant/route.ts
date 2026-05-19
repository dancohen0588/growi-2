import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import type {
  IdentifyApiResponse,
  IdentifyResult,
} from '@/lib/types/identify'

export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
// Try models in order — separate quota pools, so a 429/503 on one may still
// succeed on the next. 2.5-flash = best quality, 2.5-flash-lite = less
// frequently overloaded, 2.0-flash = legacy fallback.
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

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Service d\'identification indisponible (clé API manquante).' },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { imageBase64?: unknown }
    | null

  const imageBase64 = body?.imageBase64
  if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
    return NextResponse.json(
      { error: 'Image invalide. Fournir un data URL base64 valide.' },
      { status: 400 },
    )
  }

  const parsed = parseDataUrl(imageBase64)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Format d\'image non reconnu.' },
      { status: 400 },
    )
  }

  if (estimateBase64Bytes(parsed.data) > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: 'Image trop volumineuse (maximum 4 Mo).' },
      { status: 400 },
    )
  }

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
        {
          inlineData: {
            data: parsed.data,
            mimeType: parsed.mimeType,
          },
        },
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
      // Only retry on transient overload errors (503) or rate limits (429).
      if (status !== 503 && status !== 429) break
    }
  }

  if (raw === null) {
    const reason =
      lastStatus === 503
        ? 'Service Gemini momentanément surchargé. Veuillez réessayer dans quelques instants.'
        : lastStatus === 429
          ? 'Quota Gemini dépassé pour le moment. Veuillez réessayer plus tard.'
          : 'Erreur d\'analyse, veuillez réessayer.'
    const fallback: IdentifyApiResponse = {
      identified: false,
      reason,
      encyclopediaSlug: null,
      encyclopediaName: null,
    }
    return NextResponse.json(fallback)
  }

  let result: IdentifyResult
  try {
    result = JSON.parse(stripFence(raw)) as IdentifyResult
  } catch {
    const fallback: IdentifyApiResponse = {
      identified: false,
      reason: 'Erreur d\'analyse, veuillez réessayer.',
      encyclopediaSlug: null,
      encyclopediaName: null,
    }
    return NextResponse.json(fallback)
  }


  let encyclopediaSlug: string | null = null
  let encyclopediaName: string | null = null

  if (result.identified) {
    try {
      const match = await prisma.plantCatalog.findFirst({
        where: {
          OR: [
            { commonName: { contains: result.commonName, mode: 'insensitive' } },
            {
              scientificName: {
                contains: result.scientificName,
                mode: 'insensitive',
              },
            },
            { aliases: { contains: result.commonName, mode: 'insensitive' } },
          ],
        },
        select: { slug: true, commonName: true, emoji: true },
      })
      if (match?.slug) {
        encyclopediaSlug = match.slug
        encyclopediaName = match.commonName
      }
    } catch (err) {
      console.error('[identify-plant] catalog lookup failed', err)
    }
  }

  const payload: IdentifyApiResponse = {
    ...result,
    encyclopediaSlug,
    encyclopediaName,
  }
  return NextResponse.json(payload)
}
