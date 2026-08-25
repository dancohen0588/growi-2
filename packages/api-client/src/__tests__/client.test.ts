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
      jsonResponse({
        data: {
          date: '2026-08-15',
          gardens: [{ id: 'g1', name: 'Potager', actions: [], alerts: [] }],
          weather: null,
        },
      }),
    )

    const planning = await makeClient().planning.today()

    expect(callArgs().url).toBe('https://growi.test/api/v1/planning/today')
    expect(planning.date).toBe('2026-08-15')
    expect(planning.gardens[0]?.name).toBe('Potager')
  })

  it('ajoute une plante identifiée', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: 'p1' } }, 201))

    await makeClient().plants.addIdentified({
      commonName: 'Basilic',
      encyclopediaSlug: 'basilic',
    })

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/plants')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      commonName: 'Basilic',
      encyclopediaSlug: 'basilic',
    })
  })

  it('liste toutes les plantes, tous jardins confondus', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'p1' }, { id: 'p2' }] }))

    const plants = await makeClient().plants.list()

    expect(callArgs().url).toBe('https://growi.test/api/v1/plants')
    expect(plants).toHaveLength(2)
  })

  it('expose les indicateurs de l\'accueil', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { plants: 7, tasksToday: 3 } }))

    const summary = await makeClient().summary.get()

    expect(callArgs().url).toBe('https://growi.test/api/v1/summary')
    expect(summary.plants).toBe(7)
  })

  it('met à jour les préférences d\'alertes partiellement', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { frostAlert: false } }))

    await makeClient().me.updateAlerts({ frostAlert: false })

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/me/alerts')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ frostAlert: false })
  })

  it('coche une tâche du planning', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await makeClient().planning.markDone({
      gardenId: 'g1',
      actionType: 'arrosage',
      plantId: 'p1',
    })

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/planning/actions/done')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      gardenId: 'g1',
      actionType: 'arrosage',
      plantId: 'p1',
    })
  })

  it('expose les quatre routes d\'authentification', async () => {
    const tokens = {
      accessToken: 'jwt',
      refreshToken: 'opaque',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u1', email: 'dan@growi.fr', firstName: 'Dan' },
    }

    // Une réponse fraîche par appel : le corps d'une Response ne se lit qu'une fois.
    fetchMock.mockImplementation(async () => jsonResponse({ data: tokens }))
    const client = makeClient()

    await client.auth.register({
      firstName: 'Dan',
      email: 'dan@growi.fr',
      password: 'motdepasse',
    })
    expect(callArgs(0).url).toBe('https://growi.test/api/v1/auth/register')

    const session = await client.auth.login({
      email: 'dan@growi.fr',
      password: 'motdepasse',
      deviceInfo: 'iPhone',
    })
    expect(callArgs(1).url).toBe('https://growi.test/api/v1/auth/login')
    expect(session.accessToken).toBe('jwt')

    await client.auth.refresh('mon-jeton')
    expect(callArgs(2).url).toBe('https://growi.test/api/v1/auth/refresh')
    expect(JSON.parse(callArgs(2).init.body as string)).toEqual({ refreshToken: 'mon-jeton' })

    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    await expect(client.auth.logout('mon-jeton')).resolves.toBeUndefined()
    expect(callArgs(3).url).toBe('https://growi.test/api/v1/auth/logout')
  })

  it('envoie la photo à identifier dans le corps', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { identified: false, reason: 'flou' } }))

    await makeClient().identify.fromPhoto('data:image/jpeg;base64,AAAA')

    expect(JSON.parse(callArgs().init.body as string)).toEqual({
      imageBase64: 'data:image/jpeg;base64,AAAA',
    })
  })
})

// ─── Diagnostic ────────────────────────────────────────────────────────────

describe('diagnostic', () => {
  const result = {
    diagnosed: true,
    status: 'WARNING',
    confidence: 'medium',
    summary: 'Un stress hydrique probable.',
    observations: ['Feuilles basses jaunies'],
    probableCauses: [],
    recommendations: [],
    followUp: null,
    diagnosisId: 'diag_1',
    photoUrl: 'https://growi.test/diag.jpg',
    currentHealthStatus: 'HEALTHY',
  }

  it('poste une photo neuve sur la route de la plante', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: result }))

    const response = await makeClient().diagnosis.diagnose('p1', {
      imageBase64: 'data:image/jpeg;base64,AAAA',
    })

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/plants/p1/diagnose')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ imageBase64: 'data:image/jpeg;base64,AAAA' })
    expect(response.diagnosisId).toBe('diag_1')
  })

  it('sait demander la réutilisation de la photo de la fiche', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: result }))

    await makeClient().diagnosis.diagnose('p1', { useExistingPhoto: true })

    expect(JSON.parse(callArgs().init.body as string)).toEqual({ useExistingPhoto: true })
  })

  it('résout normalement quand le modèle n’a pas su juger', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: {
          diagnosed: false,
          reason: 'Reprends la photo en plein jour.',
          diagnosisId: null,
          photoUrl: null,
          currentHealthStatus: 'HEALTHY',
        },
      }),
    )

    const response = await makeClient().diagnosis.diagnose('p1', { useExistingPhoto: true })

    // Une analyse impossible est un résultat, pas une panne : elle ne doit pas
    // remonter en ApiError, sinon l'écran affiche une erreur au lieu du motif.
    expect(response.diagnosed).toBe(false)
    expect(response).toMatchObject({ reason: 'Reprends la photo en plein jour.' })
  })

  it('matérialise l’accord de l’utilisateur dans le corps', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { healthStatus: 'WARNING' } }))

    const applied = await makeClient().diagnosis.applyStatus('p1', 'diag_1')

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/plants/p1/diagnoses/diag_1/apply')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ apply: true })
    expect(applied.healthStatus).toBe('WARNING')
  })

  it('planifie les recommandations sans corps', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { tasksCreated: 3, tasksPlannedAt: '2026-08-25T09:00:00.000Z' } }),
    )

    const planned = await makeClient().diagnosis.planActions('p1', 'diag_1')

    const { url, init } = callArgs()
    expect(url).toBe('https://growi.test/api/v1/plants/p1/diagnoses/diag_1/plan')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(planned.tasksCreated).toBe(3)
  })

  it('transmet le taskId quand on coche une tâche planifiée', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await makeClient().planning.markDone({
      gardenId: 'g1',
      actionType: 'traitement',
      plantId: 'p1',
      taskId: 't1',
    })

    expect(JSON.parse(callArgs().init.body as string)).toEqual({
      gardenId: 'g1',
      actionType: 'traitement',
      plantId: 'p1',
      taskId: 't1',
    })
  })

  it('liste l’historique d’une plante', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }))

    await makeClient().diagnosis.list('p1')

    expect(callArgs().url).toBe('https://growi.test/api/v1/plants/p1/diagnoses')
    expect(callArgs().init.method).toBe('GET')
  })

  it('lit un diagnostic précis', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: 'diag_1' } }))

    await makeClient().diagnosis.get('p1', 'diag_1')

    expect(callArgs().url).toBe('https://growi.test/api/v1/plants/p1/diagnoses/diag_1')
  })

  it('encode les identifiants dans l’URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: {} }))

    await makeClient().diagnosis.get('p/1', 'diag 1')

    expect(callArgs().url).toBe('https://growi.test/api/v1/plants/p%2F1/diagnoses/diag%201')
  })

  it('remonte une ApiError 404 sur une plante inconnue', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Plante introuvable' } }, 404),
    )

    const error = await makeClient()
      .diagnosis.diagnose('inexistante', { useExistingPhoto: true })
      .catch((err) => err)

    expect(isApiError(error)).toBe(true)
    expect((error as ApiError).isNotFound).toBe(true)
  })
})

// ─── Blog ──────────────────────────────────────────────────────────────────

describe('blog', () => {
  const summary = {
    slug: 'preparer-son-potager-en-septembre',
    title: 'Préparer son potager en septembre',
    excerpt: 'La check-list du mois.',
    coverImage: 'https://growi.test/blog/preparer-son-potager-en-septembre/cover.png',
    coverImageAlt: null,
    publishedAt: '2026-08-19T00:00:00.000Z',
    readingTime: 6,
    tags: ['potager', 'saison'],
    author: 'Dan',
  }

  it('liste les articles sans paramètre', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { posts: [summary], pagination: { page: 1, pages: 1, total: 1, next: null } },
      }),
    )

    const { posts, pagination } = await makeClient().blog.list()

    expect(posts[0].slug).toBe(summary.slug)
    expect(pagination.next).toBeNull()
    expect(callArgs().url).toBe('https://growi.test/api/v1/blog')
  })

  it('passe pagination et filtre en query string', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { posts: [], pagination: { page: 2, pages: 3, total: 30, next: 3 } },
      }),
    )

    await makeClient().blog.list({ page: 2, limit: 5, tag: 'potager' })

    expect(callArgs().url).toBe('https://growi.test/api/v1/blog?page=2&limit=5&tag=potager')
  })

  it('récupère un article, slug échappé', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { ...summary, html: '<p>Bonjour</p>', updatedAt: summary.publishedAt } }),
    )

    const post = await makeClient().blog.get('été/2026')

    expect(post.html).toBe('<p>Bonjour</p>')
    expect(callArgs().url).toBe('https://growi.test/api/v1/blog/%C3%A9t%C3%A9%2F2026')
  })

  it('aboutit sans jeton — le blog est public', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { posts: [], pagination: { page: 1, pages: 1, total: 0, next: null } },
      }),
    )

    await makeClient().blog.list()

    expect(callArgs().headers.authorization).toBeUndefined()
  })

  it('remonte une ApiError 404 sur un article inconnu', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Article introuvable' } }, 404),
    )

    const error = await makeClient().blog.get('inexistant').catch(err => err)

    expect(isApiError(error)).toBe(true)
    expect((error as ApiError).isNotFound).toBe(true)
    expect((error as ApiError).code).toBe('NOT_FOUND')
  })
})
