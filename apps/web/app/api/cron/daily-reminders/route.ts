import { rejectUnauthorizedCron } from '@/lib/api/cron-auth'
import { runListingUpkeep } from '@/lib/services/community/listing.service'
import { sendOpenReportsAlert } from '@/lib/services/community/moderation.service'
import { purgeReadNotifications } from '@/lib/services/community/notification.service'
import { announceNewArticle } from '@/lib/services/blog-push.service'
import { sendDailyReminders } from '@/lib/services/push.service'

// Jamais de rendu statique : la route s'exécute à chaque appel du planificateur.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/**
 * Parcourir tous les comptes prend du temps. Vercel coupe à 10 s par défaut
 * sur le plan Hobby ; on demande le maximum autorisé.
 */
export const maxDuration = 60

/**
 * Rappels du matin.
 *
 * Déclenchée par Vercel Cron (voir `vercel.json`), derrière `CRON_SECRET`
 * (`lib/api/cron-auth.ts`) : envoyer des notifications à tout le monde ne
 * doit pas être à la portée du premier venu.
 */
export async function GET(request: Request): Promise<Response> {
  const refused = rejectUnauthorizedCron(request)
  if (refused) return refused

  try {
    const result = await sendDailyReminders()
    console.log('[cron] rappels envoyés :', JSON.stringify(result))

    // L'annonce d'un article publié la veille part avec les rappels : à une
    // heure où l'on regarde son téléphone, quelle que soit l'heure de la
    // publication. Son échec n'empêche rien d'autre.
    let article = null as Awaited<ReturnType<typeof announceNewArticle>> | null
    try {
      article = await announceNewArticle()
      if (article.slug) console.log('[cron] article annoncé :', JSON.stringify(article))
    } catch (error) {
      console.error('[cron] annonce d’article impossible :', error)
    }

    // L'entretien de la bourse profite du même passage quotidien : expiration
    // des annonces échues, puis rappel J‑7 à leurs auteurs.
    let upkeep = { expired: 0, reminded: 0 }
    try {
      upkeep = await runListingUpkeep()
      if (upkeep.expired || upkeep.reminded) {
        console.log('[cron] bourse :', JSON.stringify(upkeep))
      }
    } catch (error) {
      console.error('[cron] entretien de la bourse impossible :', error)
    }

    // Alerte de seuil : le badge de l'admin suffit tant qu'on l'ouvre, cet
    // email est là pour le jour où on ne l'ouvre pas.
    let reports = { open: 0, sent: false }
    try {
      reports = await sendOpenReportsAlert()
      if (reports.sent) console.log('[cron] alerte modération envoyée :', reports.open)
    } catch (error) {
      console.error('[cron] alerte de modération impossible :', error)
    }

    // La purge des notifications lues vient en dernier, et son échec n'annule
    // rien : ranger est moins important que prévenir.
    let purged = 0
    try {
      purged = await purgeReadNotifications()
      if (purged > 0) console.log('[cron] notifications purgées :', purged)
    } catch (error) {
      console.error('[cron] purge des notifications impossible :', error)
    }

    return Response.json(
      { data: { ...result, article, listings: upkeep, reports, notificationsPurged: purged } },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    // Une tournée qui échoue ne doit pas rester silencieuse dans les journaux.
    console.error('[cron] la tournée a échoué :', error)
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Une erreur interne est survenue.' } },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    )
  }
}
