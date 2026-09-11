import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException }))

const { captureApiException, normalizeRoute, shouldReport } = await import(
  '@/lib/observability/report'
)

beforeEach(() => {
  captureException.mockReset()
})

describe('shouldReport', () => {
  it.each(['UNAUTHENTICATED', 'NOT_FOUND', 'FORBIDDEN', 'INVALID_INPUT', 'RATE_LIMITED', 'QUOTA_EXCEEDED', 'CONFLICT'] as const)(
    '%s est une réponse, pas un bug',
    (code) => {
      expect(shouldReport(new ServiceError(code, 'message'))).toBe(false)
    },
  )

  it.each(['INTERNAL', 'UNAVAILABLE'] as const)('%s mérite une issue', (code) => {
    expect(shouldReport(new ServiceError(code, 'message'))).toBe(true)
  })

  it('remonte toute exception qui ne vient pas de nos services', () => {
    expect(shouldReport(new TypeError("Cannot read properties of undefined"))).toBe(true)
  })
})

describe('normalizeRoute', () => {
  it("remplace l'identifiant par le nom du segment", () => {
    const request = new Request('https://growi-garden.fr/api/v1/plants/clx123/logs')
    expect(normalizeRoute([request, { params: { id: 'clx123' } }])).toBe('/api/v1/plants/[id]/logs')
  })

  it('rend le chemin tel quel pour une route sans paramètre', () => {
    const request = new Request('https://growi-garden.fr/api/v1/gardens')
    expect(normalizeRoute([request])).toBe('/api/v1/gardens')
  })

  it('traite plusieurs paramètres', () => {
    const request = new Request('https://growi-garden.fr/api/v1/plants/p1/diagnoses/d1/apply')
    expect(normalizeRoute([request, { params: { id: 'p1', diagnosisId: 'd1' } }])).toBe(
      '/api/v1/plants/[id]/diagnoses/[diagnosisId]/apply',
    )
  })

  it("ne casse pas quand l'argument n'est pas une requête", () => {
    expect(normalizeRoute([])).toBeUndefined()
    expect(normalizeRoute([{ url: 'pas-une-url' }])).toBeUndefined()
  })
})

describe('captureApiException', () => {
  it('remonte une erreur interne avec son code et sa route', () => {
    captureApiException(new ServiceError('INTERNAL', 'boum'), '/api/v1/plants/[id]')

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][1]).toEqual({
      tags: { route: '/api/v1/plants/[id]', service_code: 'INTERNAL' },
    })
  })

  it('ne remonte rien pour un 404', () => {
    captureApiException(new ServiceError('NOT_FOUND', 'Plante introuvable'), '/api/v1/plants/[id]')
    expect(captureException).not.toHaveBeenCalled()
  })

  it("n'échoue pas si Sentry lève", () => {
    captureException.mockImplementation(() => {
      throw new Error('SDK indisponible')
    })

    expect(() => captureApiException(new Error('boum'), '/api/v1/gardens')).not.toThrow()
  })
})
