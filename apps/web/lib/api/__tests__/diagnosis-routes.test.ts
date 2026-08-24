import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'

// Les quatre routes du diagnostic : ce qu'elles laissent passer jusqu'au
// service, et surtout ce qu'elles arrêtent avant lui.

const { requireUserId } = vi.hoisted(() => ({ requireUserId: vi.fn() }))
const diagnosisService = vi.hoisted(() => ({
  diagnosePlant: vi.fn(),
  applyDiagnosisStatus: vi.fn(),
  listDiagnoses: vi.fn(),
  getDiagnosis: vi.fn(),
}))

vi.mock('@/lib/api/auth-context', () => ({ requireUserId, getUserId: vi.fn() }))
vi.mock('@/lib/services/diagnosis.service', () => diagnosisService)

const { POST: diagnose } = await import('@/app/api/v1/plants/[id]/diagnose/route')
const { GET: listDiagnoses } = await import('@/app/api/v1/plants/[id]/diagnoses/route')
const { GET: getDiagnosis } = await import(
  '@/app/api/v1/plants/[id]/diagnoses/[diagnosisId]/route'
)
const { POST: applyStatus } = await import(
  '@/app/api/v1/plants/[id]/diagnoses/[diagnosisId]/apply/route'
)

const USER_ID = 'user_1'
const PLANT = { params: { id: 'plant_1' } }
const DIAGNOSIS = { params: { id: 'plant_1', diagnosisId: 'diag_1' } }
const IMAGE = 'data:image/jpeg;base64,QUJD'

const RESULT = {
  diagnosed: true,
  status: 'WARNING',
  confidence: 'medium',
  summary: 'Un stress hydrique probable.',
  observations: [],
  probableCauses: [],
  recommendations: [],
  followUp: null,
  diagnosisId: 'diag_1',
  photoUrl: 'https://stockage.test/diag.jpg',
  currentHealthStatus: 'HEALTHY',
}

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue(USER_ID)
})

describe('POST /api/v1/plants/[id]/diagnose', () => {
  it('transmet la photo et l’identifiant de la plante au service', async () => {
    diagnosisService.diagnosePlant.mockResolvedValue(RESULT)

    const res = await diagnose(jsonRequest({ imageBase64: IMAGE }), PLANT)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(diagnosisService.diagnosePlant).toHaveBeenCalledWith(USER_ID, 'plant_1', {
      imageBase64: IMAGE,
    })
    expect(body.data).toMatchObject({ diagnosed: true, diagnosisId: 'diag_1' })
  })

  it('accepte la réutilisation de la photo de la fiche', async () => {
    diagnosisService.diagnosePlant.mockResolvedValue(RESULT)

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)

    expect(res.status).toBe(200)
    expect(diagnosisService.diagnosePlant).toHaveBeenCalledWith(USER_ID, 'plant_1', {
      useExistingPhoto: true,
    })
  })

  it('répond 200 quand l’analyse échoue — un échec est un résultat', async () => {
    diagnosisService.diagnosePlant.mockResolvedValue({
      diagnosed: false,
      reason: 'Reprends la photo en plein jour.',
      diagnosisId: null,
      photoUrl: null,
      currentHealthStatus: 'HEALTHY',
    })

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.diagnosed).toBe(false)
    expect(body.error).toBeUndefined()
  })

  it('refuse un corps qui donne les deux sources de photo', async () => {
    const res = await diagnose(jsonRequest({ imageBase64: IMAGE, useExistingPhoto: true }), PLANT)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_INPUT')
    expect(diagnosisService.diagnosePlant).not.toHaveBeenCalled()
  })

  it('refuse un corps vide', async () => {
    const res = await diagnose(jsonRequest({}), PLANT)

    expect(res.status).toBe(400)
    expect(diagnosisService.diagnosePlant).not.toHaveBeenCalled()
  })

  it('répond 401 sur une requête anonyme, sans appeler le service', async () => {
    requireUserId.mockRejectedValue(new ServiceError('UNAUTHENTICATED', 'Authentification requise'))

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHENTICATED')
    expect(diagnosisService.diagnosePlant).not.toHaveBeenCalled()
  })

  it('traduit une plante introuvable en 404', async () => {
    diagnosisService.diagnosePlant.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Plante introuvable'),
    )

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)

    expect(res.status).toBe(404)
  })

  it('traduit une clé API absente en 503', async () => {
    diagnosisService.diagnosePlant.mockRejectedValue(
      new ServiceError('UNAVAILABLE', 'Service de diagnostic indisponible.'),
    )

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)

    expect(res.status).toBe(503)
  })

  it('ne laisse aucun intermédiaire mettre la réponse en cache', async () => {
    diagnosisService.diagnosePlant.mockResolvedValue(RESULT)

    const res = await diagnose(jsonRequest({ useExistingPhoto: true }), PLANT)

    expect(res.headers.get('cache-control')).toBe('no-store, private')
  })
})

describe('POST …/diagnoses/[diagnosisId]/apply', () => {
  it('applique le statut et renvoie celui de la plante', async () => {
    diagnosisService.applyDiagnosisStatus.mockResolvedValue({ healthStatus: 'WARNING' })

    const res = await applyStatus(jsonRequest({ apply: true }), DIAGNOSIS)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(diagnosisService.applyDiagnosisStatus).toHaveBeenCalledWith(
      USER_ID,
      'plant_1',
      'diag_1',
    )
    expect(body.data).toEqual({ healthStatus: 'WARNING' })
  })

  it('exige un accord explicite dans le corps', async () => {
    for (const body of [{}, { apply: false }]) {
      const res = await applyStatus(jsonRequest(body), DIAGNOSIS)

      expect(res.status).toBe(400)
    }
    expect(diagnosisService.applyDiagnosisStatus).not.toHaveBeenCalled()
  })

  it('répond 401 sur une requête anonyme', async () => {
    requireUserId.mockRejectedValue(new ServiceError('UNAUTHENTICATED', 'Authentification requise'))

    const res = await applyStatus(jsonRequest({ apply: true }), DIAGNOSIS)

    expect(res.status).toBe(401)
    expect(diagnosisService.applyDiagnosisStatus).not.toHaveBeenCalled()
  })

  it('traduit un diagnostic d’un autre compte en 404', async () => {
    diagnosisService.applyDiagnosisStatus.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Diagnostic introuvable'),
    )

    const res = await applyStatus(jsonRequest({ apply: true }), DIAGNOSIS)

    expect(res.status).toBe(404)
  })
})

describe('GET …/diagnoses', () => {
  it('renvoie l’historique dans une enveloppe { data }', async () => {
    diagnosisService.listDiagnoses.mockResolvedValue([
      { id: 'diag_1', createdAt: '2026-08-24T09:00:00.000Z', status: 'WARNING' },
    ])

    const res = await listDiagnoses(new Request('http://localhost'), PLANT)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(diagnosisService.listDiagnoses).toHaveBeenCalledWith(USER_ID, 'plant_1')
    expect(body.data).toHaveLength(1)
  })

  it('répond 401 sur une requête anonyme', async () => {
    requireUserId.mockRejectedValue(new ServiceError('UNAUTHENTICATED', 'Authentification requise'))

    const res = await listDiagnoses(new Request('http://localhost'), PLANT)

    expect(res.status).toBe(401)
    expect(diagnosisService.listDiagnoses).not.toHaveBeenCalled()
  })

  it('traduit la plante d’un autre compte en 404', async () => {
    diagnosisService.listDiagnoses.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Plante introuvable'),
    )

    const res = await listDiagnoses(new Request('http://localhost'), PLANT)

    expect(res.status).toBe(404)
  })
})

describe('GET …/diagnoses/[diagnosisId]', () => {
  it('renvoie le diagnostic complet', async () => {
    diagnosisService.getDiagnosis.mockResolvedValue({ id: 'diag_1', result: { diagnosed: true } })

    const res = await getDiagnosis(new Request('http://localhost'), DIAGNOSIS)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(diagnosisService.getDiagnosis).toHaveBeenCalledWith(USER_ID, 'plant_1', 'diag_1')
    expect(body.data.result.diagnosed).toBe(true)
  })

  it('traduit un diagnostic introuvable en 404', async () => {
    diagnosisService.getDiagnosis.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Diagnostic introuvable'),
    )

    const res = await getDiagnosis(new Request('http://localhost'), DIAGNOSIS)

    expect(res.status).toBe(404)
  })
})
