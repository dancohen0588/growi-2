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
 * Déclenchée par Vercel Cron (voir `vercel.json`). Vercel signe ses appels
 * avec `CRON_SECRET` dans l'en-tête `Authorization` ; sans ce secret la route
 * refuse de s'exécuter — elle est publique par construction, et envoyer des
 * notifications à tout le monde ne doit pas être à la portée du premier venu.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('[cron] CRON_SECRET absent : la tournée est refusée.')
    return Response.json(
      { error: { code: 'UNAVAILABLE', message: 'Tâche planifiée non configurée.' } },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    // Volontairement muet sur la raison : inutile d'indiquer ce qui manque.
    return Response.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Non autorisé.' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    )
  }

  try {
    const result = await sendDailyReminders()
    console.log('[cron] rappels envoyés :', JSON.stringify(result))

    return Response.json({ data: result }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    // Une tournée qui échoue ne doit pas rester silencieuse dans les journaux.
    console.error('[cron] la tournée a échoué :', error)
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Une erreur interne est survenue.' } },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    )
  }
}
