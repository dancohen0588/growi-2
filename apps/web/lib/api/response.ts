/**
 * Réponses normalisées de l'API v1.
 *
 * Succès : `{ data: ... }` — erreur : `{ error: { code, message } }`.
 * Le client mobile (`@growi/api-client`, étape 2.3) s'appuie sur ce contrat.
 */

import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

import { SERVICE_ERROR_STATUS, ServiceError, isServiceError } from '@/lib/services/errors'

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init)
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Valide le corps JSON d'une requête.
 * @throws ServiceError('INVALID_INPUT') si le corps est absent ou non conforme.
 */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => undefined)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ServiceError('INVALID_INPUT', formatZodError(parsed.error))
  }
  return parsed.data
}

/** Premier message d'erreur Zod, préfixé de son chemin quand il y en a un. */
export function formatZodError(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Données invalides'
  const path = issue.path.join('.')
  return path ? `${path} : ${issue.message}` : issue.message
}

/**
 * Next.js signale certains états par des exceptions porteuses d'un `digest`
 * (`DYNAMIC_SERVER_USAGE` quand une route lit les en-têtes, `NEXT_REDIRECT`,
 * `NEXT_NOT_FOUND`). Ce sont des mécanismes de contrôle du framework, pas des
 * erreurs applicatives : les intercepter casserait le rendu.
 */
function isNextControlFlowError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('digest' in err)) return false
  const digest = (err as { digest?: unknown }).digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_') || digest === 'DYNAMIC_SERVER_USAGE')
  )
}

/**
 * Enveloppe un handler de route : traduit les `ServiceError` en réponses HTTP
 * et transforme toute autre exception en 500 sans fuiter de détail interne.
 */
export function withApiErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (err) {
      if (isNextControlFlowError(err)) throw err
      if (isServiceError(err)) {
        return fail(err.code, err.message, SERVICE_ERROR_STATUS[err.code])
      }
      if (err instanceof ZodError) {
        return fail('INVALID_INPUT', formatZodError(err), 400)
      }
      console.error('[api/v1] erreur non gérée :', err)
      return fail('INTERNAL', 'Une erreur interne est survenue.', 500)
    }
  }
}
