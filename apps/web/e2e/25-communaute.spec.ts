import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

/**
 * Communauté — parité web et pages publiques.
 *
 * Trois choses que les tests unitaires ne peuvent pas dire, parce qu'ils
 * doublent Prisma :
 *
 * - le **SQL brut** du fil et de la bourse (`earth_box`) s'exécute sans erreur
 *   contre la vraie base — une requête fautive ferait répondre 500 ;
 * - les pages publiques répondent **sans session**, ce qui est toute la raison
 *   d'être de `(public)/u` et `(public)/p` ;
 * - rien de privé ne fuit dans le HTML servi, ni email ni coordonnée.
 *
 * Comme les autres specs, ce fichier travaille sur la **vraie** base : il crée
 * ses comptes et les supprime dans `afterAll`. Les assertions visent la ligne,
 * jamais le tableau entier — une donnée voisine ne doit pas les casser.
 */

const AUTHOR_EMAIL = 'test-e2e-communaute-auteur@growi-garden.fr'
const VIEWER_EMAIL = 'test-e2e-communaute-voisin@growi-garden.fr'
const EMAILS = [AUTHOR_EMAIL, VIEWER_EMAIL]

const AUTHOR_HANDLE = 'e2e_auteur_communaute'
const VIEWER_HANDLE = 'e2e_voisin_communaute'

/** Tours et Fondettes : ~6 km, donc hors du rayon de 5 km et dans celui de 20. */
const TOURS = { lat: 47.3941, lng: 0.6848 }
const FONDETTES = { lat: 47.4441, lng: 0.6848 }

let postId = ''
let listingId = ''

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  const author = await prisma.user.create({
    data: {
      email: AUTHOR_EMAIL,
      firstName: 'Auteur',
      lastName: 'Communauté',
      password,
      onboarded: true,
      latitude: TOURS.lat,
      longitude: TOURS.lng,
      locationCity: 'Tours',
      handle: AUTHOR_HANDLE,
      bio: 'Potager de cent mètres carrés.',
      communityEnabled: true,
      communityEnabledAt: new Date(),
      // La position floutée est posée à la main : le service la calcule à
      // l'activation, que ce seed court-circuite.
      fuzzyLat: TOURS.lat,
      fuzzyLng: TOURS.lng,
      postCount: 1,
    },
  })

  await prisma.user.create({
    data: {
      email: VIEWER_EMAIL,
      firstName: 'Voisin',
      password,
      onboarded: true,
      latitude: FONDETTES.lat,
      longitude: FONDETTES.lng,
      locationCity: 'Fondettes',
      handle: VIEWER_HANDLE,
      communityEnabled: true,
      communityEnabledAt: new Date(),
      fuzzyLat: FONDETTES.lat,
      fuzzyLng: FONDETTES.lng,
    },
  })

  const post = await prisma.post.create({
    data: {
      userId: author.id,
      body: 'Première récolte de cœurs de bœuf e2e',
      photos: ['https://exemple.test/e2e.jpg'],
      lat: TOURS.lat,
      lng: TOURS.lng,
    },
  })
  postId = post.id

  const listing = await prisma.listing.create({
    data: {
      userId: author.id,
      kind: 'give',
      category: 'seeds',
      title: 'Graines de tomate e2e',
      quantity: '~30 graines',
      lat: TOURS.lat,
      lng: TOURS.lng,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
    },
  })
  listingId = listing.id
})

test.afterAll(cleanup)

test.describe('Communauté — tableau de bord', () => {
  test('E2E-COMM-01 — Le fil local s’affiche et montre le voisin', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      // Les photos du seed pointent sur un domaine volontairement injoignable :
      // leur échec de chargement est un artefact du test, pas de la page. Le
      // reste — erreur React, hydratation, appel raté — doit rester attrapé.
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        errors.push(msg.text())
      }
    })

    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/dashboard/communaute')
    // Le contrôle qui compte : le SQL brut d'`earth_box` donnerait 500.
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Communauté' })).toBeVisible()
    await expect(page.getByText('Première récolte de cœurs de bœuf e2e')).toBeVisible()
    // La distance est mise en forme, jamais une coordonnée.
    await expect(page.getByText(/à ~?\d+ km|à moins d’1 km/).first()).toBeVisible()

    expect(errors).toEqual([])
  })

  test('E2E-COMM-02 — Le fil des abonnements est vide, et le dit', async ({ page }) => {
    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/communaute?onglet=following')

    await expect(page.getByText('Tu ne suis encore personne')).toBeVisible()
  })

  test('E2E-COMM-03 — Un rayon absurde ne casse pas le fil', async ({ page }) => {
    // Les lectures sont tolérantes : un paramètre d'URL fantaisiste vaut
    // « pas de filtre », jamais un écran rouge.
    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/dashboard/communaute?rayon=999&onglet=nimporte')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Communauté' })).toBeVisible()
  })

  test('E2E-COMM-04 — La bourse s’affiche et filtre', async ({ page }) => {
    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/dashboard/communaute/bourse')
    expect(response?.status()).toBe(200)
    await expect(page.getByText('Graines de tomate e2e')).toBeVisible()

    // « Je cherche » ne doit pas montrer une annonce de don.
    await page.goto('/dashboard/communaute/bourse?type=seek')
    await expect(page.getByText('Graines de tomate e2e')).toHaveCount(0)
  })

  test('E2E-COMM-05 — L’annonce se lit, avec son bandeau de prudence', async ({ page }) => {
    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)

    const response = await page.goto(`/dashboard/communaute/bourse/${listingId}`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Graines de tomate e2e' })).toBeVisible()
    await expect(page.getByText(/lieu public/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Je suis intéressé' })).toBeVisible()
  })

  test('E2E-COMM-06 — La navigation mène à la communauté', async ({ page }) => {
    await loginAs(page, VIEWER_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard')

    await expect(
      page.getByRole('navigation', { name: 'Navigation tableau de bord' }).getByRole('link', {
        name: 'Communauté',
      }),
    ).toBeVisible()
  })
})

test.describe('Communauté — pages publiques', () => {
  test('E2E-COMM-10 — Un profil public se lit sans compte', async ({ page }) => {
    // Toute la raison d'être de `(public)/u` : un lien partagé mène quelque
    // part, même pour qui n'a pas encore l'app.
    const response = await page.goto(`/u/${AUTHOR_HANDLE}`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: AUTHOR_HANDLE })).toBeVisible()
    await expect(page.getByText('Potager de cent mètres carrés.')).toBeVisible()
    // Anonyme : pas de bouton d'action, une invitation à se connecter.
    await expect(page.getByRole('link', { name: 'Se connecter pour suivre' })).toBeVisible()
  })

  test('E2E-COMM-11 — Une publication se lit sans compte', async ({ page }) => {
    const response = await page.goto(`/p/${postId}`)
    expect(response?.status()).toBe(200)

    await expect(page.getByText('Première récolte de cœurs de bœuf e2e')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Créer mon jardin' })).toBeVisible()
  })

  test('E2E-COMM-12 — Rien de privé ne fuit dans le HTML public', async ({ page }) => {
    // Le test de non-fuite existe en unitaire sur `toCommunityUser` ; celui-ci
    // vérifie la page entière, sérialisation React comprise.
    for (const path of [`/u/${AUTHOR_HANDLE}`, `/p/${postId}`]) {
      await page.goto(path)
      const html = await page.content()

      expect(html).not.toContain(AUTHOR_EMAIL)
      expect(html).not.toContain('Communauté</')
      // La position exacte ne doit apparaître nulle part.
      expect(html).not.toContain(String(TOURS.lat))
      expect(html).not.toContain(String(TOURS.lng))
    }
  })

  test('E2E-COMM-13 — Une annonce partagée mène à un aperçu, pas à la bourse', async ({
    page,
  }) => {
    const response = await page.goto(`/a/${listingId}`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Graines de tomate e2e' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Créer mon jardin pour répondre/ })).toBeVisible()
    // L'aperçu est minimal : ni quantité, ni distance, ni moyen d'agir.
    await expect(page.getByText('~30 graines')).toHaveCount(0)
  })

  test('E2E-COMM-14 — Un profil inconnu répond 404', async ({ page }) => {
    const response = await page.goto('/u/e2e_ce_pseudo_nexiste_pas')
    expect(response?.status()).toBe(404)
  })

  test('E2E-COMM-15 — Le profil d’un compte sorti de la communauté répond 404', async ({
    page,
  }) => {
    await prisma.user.update({
      where: { email: VIEWER_EMAIL },
      data: { communityEnabled: false },
    })

    try {
      const response = await page.goto(`/u/${VIEWER_HANDLE}`)
      expect(response?.status()).toBe(404)
    } finally {
      await prisma.user.update({
        where: { email: VIEWER_EMAIL },
        data: { communityEnabled: true },
      })
    }
  })

  test('E2E-COMM-16 — Le sitemap liste les profils actifs', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)

    const xml = await page.content()
    expect(xml).toContain(`/u/${AUTHOR_HANDLE}`)
  })
})
