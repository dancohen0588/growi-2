import { rejectUnauthorizedCron } from '@/lib/api/cron-auth'
import {
  acquireGenerationLock,
  getBlogCadence,
  getLastGenerationAt,
  isGenerationDue,
  releaseGenerationLock,
  setLastGenerationAt,
} from '@/lib/services/app-settings.service'
import { findPendingCover, generateCover, MIN_COVER_BUDGET_MS } from '@/lib/services/blog-cover.service'
import { countPendingDrafts, generateArticle } from '@/lib/services/blog-generator.service'
import { isServiceError } from '@/lib/services/errors'
import { MAX_PENDING_DRAFTS } from '@growi/shared'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/** Rédaction (~15–25 s) et image (~10–20 s) : le maximum du plan Hobby. */
export const maxDuration = 60

/** Marge sous les 60 s de Vercel, pour répondre et rendre le verrou. */
const ROUTE_BUDGET_MS = 55_000

const LOG = '[cron blog]'

type Outcome =
  | { generated: string }
  | { skipped: 'locked' | 'not_due' | 'drafts_limit' | 'failed'; reason?: string }

/**
 * Génération automatique d'un article « Conseils ».
 *
 * Le cron tourne **chaque lundi à 7 h UTC quoi qu'il arrive** (`vercel.json`) :
 * c'est la cadence enregistrée en base, réglée depuis l'admin, qui décide s'il
 * produit. Changer de rythme ne demande donc pas de déploiement.
 *
 * Déroulé : verrou → cadence due ? → plafond de brouillons → génération →
 * rattrapage d'une couverture restée en attente. Le rattrapage a lieu à chaque
 * passage, même sans génération due : sinon une image ratée attendrait la
 * prochaine génération, soit jusqu'à un mois.
 *
 * Répond toujours 200 hors refus d'authentification : un « rien à faire » est
 * un résultat normal, pas une erreur à faire relancer par Vercel.
 */
export async function GET(request: Request): Promise<Response> {
  const refused = rejectUnauthorizedCron(request, LOG)
  if (refused) return refused

  const startedAt = Date.now()
  const remaining = () => ROUTE_BUDGET_MS - (Date.now() - startedAt)

  if (!(await acquireGenerationLock())) {
    console.info(`${LOG} un passage est déjà en cours`)
    return json({ skipped: 'locked' })
  }

  let outcome: Outcome
  let coverSlug: string | null = null

  try {
    outcome = await generateIfDue(remaining)

    // Rattrapage : l'article le plus ancien dont la couverture manque, hors
    // celui qu'on vient de générer (sa couverture a déjà eu sa chance).
    if (remaining() >= MIN_COVER_BUDGET_MS) {
      const justGenerated = 'generated' in outcome ? outcome.generated : undefined
      const pending = await findPendingCover()
      if (pending && pending.slug !== justGenerated) {
        const cover = await generateCover(pending.id, { budgetMs: remaining() })
        if (cover.ok) coverSlug = pending.slug
      }
    }
  } catch (error) {
    console.error(`${LOG} le passage a échoué :`, error)
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Une erreur interne est survenue.' } },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    )
  } finally {
    await releaseGenerationLock().catch(error => console.error(`${LOG} verrou non rendu :`, error))
  }

  return json({ ...outcome, coverCaughtUp: coverSlug })
}

async function generateIfDue(remaining: () => number): Promise<Outcome> {
  const now = new Date()
  const [cadence, last] = await Promise.all([getBlogCadence(), getLastGenerationAt()])
  if (!isGenerationDue(cadence, last, now)) return { skipped: 'not_due' }

  const drafts = await countPendingDrafts()
  if (drafts >= MAX_PENDING_DRAFTS) {
    // L'automatisation s'arrête quand personne ne relit : on le dit, sans plus.
    console.warn(`${LOG} ${drafts} brouillons en attente de relecture : pas de génération`)
    return { skipped: 'drafts_limit' }
  }

  try {
    const result = await generateArticle({ origin: 'cron', timeBudgetMs: remaining() })
    if (!result.ok) {
      // Pas de mise à jour de la date : le lundi suivant retentera, plutôt
      // que d'attendre toute une période sur un échec.
      return { skipped: 'failed', reason: `${result.stage} : ${result.reason}` }
    }

    await setLastGenerationAt(now)
    return { generated: result.post.slug }
  } catch (error) {
    // Un brouillon créé depuis l'admin entre le comptage et l'écriture.
    if (isServiceError(error) && error.code === 'CONFLICT') return { skipped: 'drafts_limit' }
    throw error
  }
}

function json(data: Record<string, unknown>): Response {
  return Response.json({ data }, { headers: { 'cache-control': 'no-store' } })
}
