/**
 * Route de vérification de la chaîne Sentry — **temporaire**.
 *
 * Elle lève une erreur volontaire pour qu'on voie apparaître l'issue dans
 * `growi-web`, avec sa release et son environnement. Elle sera supprimée à la
 * fin de la Friends & Family (passe F du prompt d'observabilité).
 *
 * Le dossier ne s'appelle pas `_debug` : dans l'App Router, un dossier
 * préfixé d'un souligné est *privé* et sort du routage. La route existait,
 * compilait, et répondait 404 quoi qu'on fasse.
 *
 * Deux gardes, et la même réponse pour les deux : **404**. Un 401 dirait qu'il
 * y a quelque chose à cette adresse.
 * - `DEBUG_TOKEN` absent — le cas en production tant qu'on ne l'y pose pas ;
 * - jeton fourni différent.
 */

import * as Sentry from '@sentry/nextjs'

import { fail, ok, withApiErrorHandling } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const NOT_FOUND = () => fail('NOT_FOUND', 'Ressource introuvable', 404)

export const GET = withApiErrorHandling(async (request: Request) => {
  const expected = process.env.DEBUG_TOKEN
  if (!expected) return NOT_FOUND()

  if (request.headers.get('x-debug-token') !== expected) return NOT_FOUND()

  /*
   * `?check=1` — ce que le **serveur** voit de Sentry.
   *
   * Une erreur qui ne remonte pas a deux causes possibles et indiscernables
   * de l'extérieur : le SDK n'est pas initialisé (`instrumentation.ts` non
   * exécuté, DSN absent), ou il l'est et l'événement se perd en route. Cette
   * réponse tranche, sans rien révéler : des booléens, l'environnement et la
   * release — jamais le DSN lui-même.
   */
  if (new URL(request.url).searchParams.get('check')) {
    const options = Sentry.getClient()?.getOptions()
    return ok({
      initialized: Boolean(options),
      dsnConfigured: Boolean(options?.dsn),
      enabled: options?.enabled ?? null,
      environment: options?.environment ?? null,
      release: options?.release ?? null,
    })
  }

  throw new Error('Erreur volontaire — vérification de la chaîne Sentry (/api/v1/debug/sentry)')
})
