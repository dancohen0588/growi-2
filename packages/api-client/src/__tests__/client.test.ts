import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createGrowiApiClient } from '../client'
import { ApiError, isApiError } from '../errors'

// ─── Utilitaires ───────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

function makeClient(overrides: Partial<Parameters<typeof createGrowiApiClient>[0]> = {}) {
  return createGrowiApiClient({
    baseUrl: 'https://growi.test',
    fetch: fetchMock,
    ...overrides,
  })
}

/** Arguments du n-ième appel à fetch. */
function callArgs(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url, init, headers: (init.headers ?? {}) as Record<string, string> }
}

beforeEach(() => {
  fetchMock.mockReset()
})

// ─── Requêtes ──────────────────────────────────────────────────────────────

describe('construction des requêtes', () => {
  it('déballe l\'enveloppe { data } et compose l\'URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'g1', name: 'Potager' }] }))

    const gardens = await makeClient().gardens.list()

    expect(gardens).toEqual([{ id: 'g1', name: 'Potager' }])
    expect(callArgs().url).toBe('https://growi.test/api/v1/gardens')
    expect(callArgs().init.method).toBe('GET')
  })

  it('supprime le slash final de la baseUrl', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: null }))

    await makeClient({ baseUrl: 'https://growi.test/' }).me.get()

    expect(callArgs().url).toBe('https://growi.test/api/v1/me')
  })

  it('sérialise le corps en JSON avec le bon content-type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: 'g1' } }, 201))

    await makeClient().gardens.create({ name: 'Potager', type: 'OUTDOOR' })

    const { init, headers } = callArgs()
    expect(init.method).toBe('POST')
    expect(headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Potager', type: 'OUTDOOR' })
  })

  it('encode les identifiants dans le chemin', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: {} }))

    await makeClient().plants.get('id/avec espace')

    expect(callArgs().url).toBe('https://growi.test/api/v1/plants/id%2Favec%20espace')
  })

  it('renvoie undefined sur un 204 sans corps', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(makeClient().gardens.remove('g1')).resolves.toBeUndefined()
  })
})

// ─── Jetons ────────────────────────────────────────────────────────────────

describe('jeton d\'accès', () => {
  it('ajoute l\'en-tête Authorization quand un jeton est fourni', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await makeClient({ getAccessToken: () => 'jeton-abc' }).gardens.list()

    expect(callArgs().headers.authorization).toBe('Bearer jeton-abc')
  })

  it('accepte un getter asynchrone', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await makeClient({ getAccessToken: async () => 'jeton-async' }).gardens.list()

    expect(callArgs().headers.authorization).toBe('Bearer jeton-async')
  })

  it('n\'ajoute pas d\'en-tête quand il n\'y a pas de jeton', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await makeClient({ getAccessToken: () => null }).gardens.list()

    expect(callArgs().headers.authorization).toBeUndefined()
  })
})

// ─── Rafraîchissement sur 401 ──────────────────────────────────────────────

describe('rafraîchissement du jeton', () => {
  it('rejoue la requête une fois avec le nouveau jeton', async () => {
    let token = 'périmé'
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'Jeton expiré' } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'g1' }] }))

    const onUnauthorized = vi.fn(async () => {
      token = 'frais'
      return true
    })

    const gardens = await makeClient({
      getAccessToken: () => token,
      onUnauthorized,
    }).gardens.list()

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callArgs(0).headers.authorization).toBe('Bearer périmé')
    expect(callArgs(1).headers.authorization).toBe('Bearer frais')
    expect(gardens).toEqual([{ id: 'g1' }])
  })

  it('laisse remonter le 401 quand le rafraîchissement échoue', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'Jeton expiré' } }, 401),
    )
    const onUnauthorized = vi.fn(async () => false)

    await expect(makeClient({ onUnauthorized }).gardens.list()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ne rejoue qu\'une seule fois, même si le second appel renvoie 401', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'Jeton expiré' } }, 401),
    )
    const onUnauthorized = vi.fn(async () => true)

    await expect(makeClient({ onUnauthorized }).gardens.list()).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('remonte le 401 tel quel sans callback', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'Jeton expiré' } }, 401),
    )

    await expect(makeClient().gardens.list()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ─── Erreurs ───────────────────────────────────────────────────────────────

describe('erreurs', () => {
  it('traduit { error: { code, message } } en ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Jardin introuvable' } }, 404),
    )

    const err = await makeClient()
      .gardens.get('inconnu')
      .catch((e: unknown) => e)

    expect(isApiError(err)).toBe(true)
    expect(err).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Jardin introuvable',
    })
    expect((err as ApiError).isNotFound).toBe(true)
  })

  it('classe une panne réseau en NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = (await makeClient()
      .gardens.list()
      .catch((e: unknown) => e)) as ApiError

    expect(err.isNetworkError).toBe(true)
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.status).toBe(0)
  })

  it('distingue une annulation d\'une panne réseau', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    fetchMock.mockRejectedValue(abortError)

    const err = (await makeClient()
      .gardens.list()
      .catch((e: unknown) => e)) as ApiError

    expect(err.code).toBe('ABORTED')
  })

  it('signale une réponse de succès mal formée', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ jardins: [] }))

    const err = (await makeClient()
      .gardens.list()
      .catch((e: unknown) => e)) as ApiError

    expect(err.code).toBe('INVALID_RESPONSE')
  })

  it('reste exploitable quand le serveur répond en HTML', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    )

    const err = (await makeClient()
      .gardens.list()
      .catch((e: unknown) => e)) as ApiError

    expect(err.status).toBe(502)
    expect(err.isServerError).toBe(true)
    expect(err.message).toBe('Bad Gateway')
  })
})

// ─── Surface typée ─────────────────────────────────────────────────────────

describe('endpoints', () => {
  it('poste un log d\'entretien sur la bonne route', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { type: 'watering', log: {} } }, 201))

    await makeClient().plants.addLog('p1', { type: 'watering', note: 'copieux' })

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/plants/p1/logs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ type: 'watering', note: 'copieux' })
  })

  it('expose le planning du jour', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { date: '2026-08-15', actions: [], alerts: [] } }),
    )

    const planning = await makeClient().planning.today()

    expect(callArgs().url).toBe('https://growi.test/api/v1/planning/today')
    expect(planning.date).toBe('2026-08-15')
  })

  it('envoie la photo à identifier dans le corps', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { identified: false, reason: 'flou' } }))

    await makeClient().identify.fromPhoto('data:image/jpeg;base64,AAAA')

    expect(JSON.parse(callArgs().init.body as string)).toEqual({
      imageBase64: 'data:image/jpeg;base64,AAAA',
    })
  })
})
