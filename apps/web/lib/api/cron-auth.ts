/**
 * Garde des tâches planifiées (`app/api/cron/*`).
 *
 * Vercel Cron signe ses appels avec `CRON_SECRET` dans l'en-tête
 * `Authorization`. Ces routes sont publiques par construction : sans le secret,
 * n'importe qui déclencherait des envois de notifications ou des appels payants
 * au modèle.
 *
 * Rend la réponse de refus, ou `null` si l'appel est autorisé.
 */
export function rejectUnauthorizedCron(request: Request, label = '[cron]'): Response | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error(`${label} CRON_SECRET absent : la tâche est refusée.`)
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

  return null
}
