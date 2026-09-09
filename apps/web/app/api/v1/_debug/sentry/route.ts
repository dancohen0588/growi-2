/**
 * Route de vérification de la chaîne Sentry — **temporaire**.
 *
 * Elle lève une erreur volontaire pour qu'on voie apparaître l'issue dans
 * `growi-web`, avec sa release et son environnement. Elle sera supprimée à la
 * fin de la Friends & Family (passe F du prompt d'observabilité).
 *
 * Deux gardes, et la même réponse pour les deux : **404**. Un 401 dirait qu'il
 * y a quelque chose à cette adresse.
 * - `DEBUG_TOKEN` absent — le cas en production tant qu'on ne l'y pose pas ;
 * - jeton fourni différent.
 */

import { fail, withApiErrorHandling } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const NOT_FOUND = () => fail('NOT_FOUND', 'Ressource introuvable', 404)

export const GET = withApiErrorHandling(async (request: Request) => {
  const expected = process.env.DEBUG_TOKEN
  if (!expected) return NOT_FOUND()

  if (request.headers.get('x-debug-token') !== expected) return NOT_FOUND()

  throw new Error('Erreur volontaire — vérification de la chaîne Sentry (/api/v1/_debug/sentry)')
})
