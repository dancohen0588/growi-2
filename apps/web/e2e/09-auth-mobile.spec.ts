import { test, expect } from '@playwright/test'
import { prisma } from './fixtures'

// Parcours d'authentification tel que l'app mobile le vivra : inscription,
// appels porteurs de jeton, rotation, détection de rejeu, déconnexion.

const EMAIL = 'test-e2e-mobile@growi.app'
const PASSWORD = 'MotDePasseMobile123!'

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: EMAIL } })
}

test.beforeAll(cleanup)
test.afterAll(cleanup)

// Les tests partagent le compte créé par le premier : ils s'exécutent en série
// (fullyParallel: false dans playwright.config.ts).
let refreshToken = ''

test.describe('Auth mobile (JWT)', () => {
  test('E2E-JWT-01 — Inscription : 201 et couple de jetons exploitable', async ({ request }) => {
    const res = await request.post('/api/v1/auth/register', {
      data: { email: EMAIL, password: PASSWORD, firstName: 'Mobile', deviceInfo: 'iPhone 15' },
    })
    expect(res.status()).toBe(201)

    const { data } = await res.json()
    expect(data.tokenType).toBe('Bearer')
    expect(data.expiresIn).toBe(900)
    expect(data.user.email).toBe(EMAIL)
    expect(data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(data.refreshToken.length).toBeGreaterThan(20)

    refreshToken = data.refreshToken

    // Le refresh token n'est jamais stocké en clair.
    const stored = await prisma.refreshToken.findMany({
      where: { user: { email: EMAIL } },
    })
    expect(stored).toHaveLength(1)
    expect(stored[0].tokenHash).not.toBe(data.refreshToken)
    expect(stored[0].deviceInfo).toBe('iPhone 15')
  })

  test('E2E-JWT-02 — Le Bearer donne accès à l\'API v1', async ({ request }) => {
    const login = await request.post('/api/v1/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    })
    expect(login.status()).toBe(200)
    const { accessToken } = (await login.json()).data
    const headers = { Authorization: `Bearer ${accessToken}` }

    const me = await request.get('/api/v1/me', { headers })
    expect(me.status()).toBe(200)
    expect((await me.json()).data.email).toBe(EMAIL)

    const gardens = await request.get('/api/v1/gardens', { headers })
    expect(gardens.status()).toBe(200)
    expect((await gardens.json()).data).toEqual([])

    // Un jeton créé via l'API permet aussi d'écrire.
    const created = await request.post('/api/v1/gardens', {
      headers,
      data: { name: 'Jardin mobile', type: 'BALCONY' },
    })
    expect(created.status()).toBe(201)
  })

  test('E2E-JWT-03 — Jeton absent ou invalide → 401', async ({ request }) => {
    expect((await request.get('/api/v1/me')).status()).toBe(401)

    const bad = await request.get('/api/v1/me', {
      headers: { Authorization: 'Bearer pas.un.vrai.jwt' },
    })
    expect(bad.status()).toBe(401)
    expect((await bad.json()).error.code).toBe('UNAUTHENTICATED')

    // Un schéma d'authentification inconnu est ignoré → anonyme → 401.
    const basic = await request.get('/api/v1/me', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })
    expect(basic.status()).toBe(401)
  })

  test('E2E-JWT-04 — Rotation : le refresh token change à chaque échange', async ({
    request,
  }) => {
    const res = await request.post('/api/v1/auth/refresh', { data: { refreshToken } })
    expect(res.status()).toBe(200)

    const { data } = await res.json()
    expect(data.refreshToken).not.toBe(refreshToken)

    // Le nouvel access token fonctionne.
    const me = await request.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    })
    expect(me.status()).toBe(200)

    const ancien = refreshToken
    refreshToken = data.refreshToken

    // L'ancien jeton est révoqué : le rejouer échoue…
    const rejeu = await request.post('/api/v1/auth/refresh', {
      data: { refreshToken: ancien },
    })
    expect(rejeu.status()).toBe(401)

    // …et ce rejeu coupe toute la famille, y compris le jeton fraîchement émis.
    const apresRejeu = await request.post('/api/v1/auth/refresh', { data: { refreshToken } })
    expect(apresRejeu.status()).toBe(401)
  })

  test('E2E-JWT-05 — Déconnexion : le jeton ne sert plus', async ({ request }) => {
    const login = await request.post('/api/v1/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    })
    const token = (await login.json()).data.refreshToken

    const out = await request.post('/api/v1/auth/logout', { data: { refreshToken: token } })
    expect(out.status()).toBe(204)

    const apres = await request.post('/api/v1/auth/refresh', { data: { refreshToken: token } })
    expect(apres.status()).toBe(401)

    // Se déconnecter deux fois ne doit pas échouer.
    const encore = await request.post('/api/v1/auth/logout', { data: { refreshToken: token } })
    expect(encore.status()).toBe(204)
  })

  test('E2E-JWT-06 — Mauvais identifiants et corps invalide', async ({ request }) => {
    const faux = await request.post('/api/v1/auth/login', {
      data: { email: EMAIL, password: 'MauvaisMotDePasse' },
    })
    expect(faux.status()).toBe(401)
    expect((await faux.json()).error.message).toBe('Email ou mot de passe incorrect')

    // Compte inexistant : même message, pour ne pas révéler les emails connus.
    const inconnu = await request.post('/api/v1/auth/login', {
      data: { email: 'personne@growi.app', password: PASSWORD },
    })
    expect(inconnu.status()).toBe(401)
    expect((await inconnu.json()).error.message).toBe('Email ou mot de passe incorrect')

    const invalide = await request.post('/api/v1/auth/login', {
      data: { email: 'pas-un-email', password: 'x' },
    })
    expect(invalide.status()).toBe(400)
    expect((await invalide.json()).error.code).toBe('INVALID_INPUT')
  })

  test('E2E-JWT-07 — La session web continue de fonctionner', async ({ request }) => {
    // Les routes v1 acceptent toujours la session NextAuth : sans cookie ni
    // Bearer, on obtient bien 401 et non une erreur interne.
    const res = await request.get('/api/v1/planning/today')
    expect(res.status()).toBe(401)
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED')
  })
})
