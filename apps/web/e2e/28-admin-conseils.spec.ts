import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Admin « Conseils » : relecture, édition, publication, dépublication,
// suppression d'un article du blog.
//
// Le brouillon est écrit **directement en base**, comme 21-admin-messages
// écrit ses messages : la génération tourne côté serveur Next, que Playwright
// ne sait pas doubler, et l'appeler pour de vrai dépendrait de Gemini. Elle
// est couverte par les tests unitaires du service (Gemini doublé).

const ADMIN_EMAIL = 'test-e2e-conseils-admin@growi-garden.fr'
const SLUG = 'test-e2e-conseil-pailler-ses-massifs'
const SECOND_SLUG = 'test-e2e-conseil-second-brouillon'
const TITLE = 'Pailler ses massifs avant les premières gelées'
const EDITED_TITLE = 'Pailler ses massifs avant l’hiver, sans étouffer le sol'

const paragraph =
  'Tu poses ton paillage sur un sol encore tiède, ta terre garde sa chaleur et tes vivaces passent le gel sans dommage.'
const section = (title: string) => [`## ${title}`, '', ...Array.from({ length: 12 }, () => paragraph), ''].join('\n')
const SOURCE = [
  'Avant l’hiver, ton massif a besoin d’une couverture. Voici laquelle choisir, et quand la poser.',
  '',
  section('Choisir son paillage'),
  '<Callout tone="conseil" title="Le bon moment">Paille après une pluie, sur un sol humide.</Callout>',
  '',
  section('Poser la bonne épaisseur'),
  section('Retirer le paillage au printemps'),
].join('\n')

const NOTE = 'Épaisseur de 5 à 10 cm de paillage'

async function cleanup() {
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: 'test-e2e-conseil-' } } })
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: ADMIN_EMAIL } } })
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function draft(slug: string, title: string) {
  return {
    slug,
    title,
    excerpt: 'Paille, feuilles ou broyat : lequel poser, quelle épaisseur, et quand, pour protéger tes vivaces du gel.',
    source: SOURCE,
    tags: ['entretien', 'saison'],
    status: 'DRAFT',
    origin: 'admin',
    coverStatus: 'NONE',
    reviewerNotes: [NOTE],
    topicRationale: 'Les premières gelées arrivent dans trois semaines.',
  }
}

let postId = ''

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)
  await prisma.user.create({ data: { email: ADMIN_EMAIL, firstName: 'Conseils', password, role: 'ADMIN' } })

  // Deux brouillons : le plafond est atteint quoi que contienne la base par
  // ailleurs, ce qui rend l'état du bouton « Générer » déterministe.
  postId = (await prisma.blogPost.create({ data: draft(SLUG, TITLE) })).id
  await prisma.blogPost.create({ data: draft(SECOND_SLUG, 'Un second brouillon de test pour le plafond') })
})

test.afterAll(cleanup)

// Les cas s'enchaînent : chacun part de l'état laissé par le précédent.
test.describe.configure({ mode: 'serial' })

test.describe('Admin — Conseils', () => {
  test('E2E-ADMIN-60 — La liste montre le brouillon, le badge et le plafond', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/conseils')

    await expect(page.getByRole('heading', { name: 'Conseils', level: 1 })).toBeVisible()

    // Le badge compte les brouillons : au moins nos deux.
    const navLink = page.getByRole('navigation', { name: 'Navigation administration' }).getByRole('link', { name: /Conseils/ })
    await expect(navLink.getByLabel(/en attente/)).toBeVisible()

    const row = page.locator('tbody tr').filter({ hasText: TITLE })
    await expect(row).toHaveCount(1)
    await expect(row.getByText('Aucune')).toBeVisible()

    // Deux brouillons ou plus : on ne génère pas, et on dit pourquoi.
    await expect(page.getByRole('button', { name: 'Générer un article' })).toBeDisabled()
    await expect(page.getByText(/attendent déjà une relecture/)).toBeVisible()

    await page.screenshot({ path: 'test-results/admin-conseils-liste.png', fullPage: true })
  })

  test('E2E-ADMIN-61 — La fiche montre les notes et l’aperçu ; « IA » est refusé', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/conseils/${postId}`)

    const notes = page.getByRole('region', { name: 'À vérifier avant publication' })
    await expect(notes.getByText(NOTE)).toBeVisible()
    await expect(notes.getByText(/Pourquoi ce thème/)).toBeVisible()

    // L'aperçu rend les vrais composants : le Callout devient un encadré.
    const preview = page.getByRole('complementary', { name: 'Aperçu' })
    await expect(preview.getByText('Le bon moment')).toBeVisible()

    // Une édition qui trahit le procédé de rédaction est refusée, sans écrire.
    const body = page.getByLabel('Corps de l’article (MDX)')
    await body.fill(`${SOURCE}\n\nCe texte a été écrit par une IA.`)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Termes interdits/ })).toBeVisible()

    const unchanged = await prisma.blogPost.findUniqueOrThrow({ where: { id: postId } })
    expect(unchanged.source).not.toContain('IA')

    await page.screenshot({ path: 'test-results/admin-conseils-fiche.png', fullPage: true })
  })

  test('E2E-ADMIN-65 — Liste et fiche restent utilisables sur un téléphone', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.setViewportSize({ width: 390, height: 844 })

    // Aucun défilement horizontal de la page : le tableau défile dans son
    // conteneur, la fiche passe sur une colonne.
    for (const path of ['/admin/conseils', `/admin/conseils/${postId}`]) {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })

  test('E2E-ADMIN-62 — Une édition valide est enregistrée et journalisée', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/conseils/${postId}`)

    await page.getByLabel('Titre').fill(EDITED_TITLE)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Enregistré/ })).toBeVisible()

    const saved = await prisma.blogPost.findUniqueOrThrow({ where: { id: postId } })
    expect(saved.title).toBe(EDITED_TITLE)
    // Le slug ne suit pas le titre.
    expect(saved.slug).toBe(SLUG)

    const entry = await prisma.adminAuditLog.findFirst({ where: { action: 'blog.update', targetId: postId } })
    expect(entry?.details).toEqual({ champs: ['title'] })
  })

  test('E2E-ADMIN-63 — Publier le met en ligne, sur le site et dans l’API', async ({ page, request }) => {
    // La page publique de l'article est compilée à froid au premier passage.
    test.setTimeout(60_000)
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/conseils/${postId}`)

    await page.getByRole('button', { name: 'Publier' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Publier' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Article publié/ })).toBeVisible()

    const published = await prisma.blogPost.findUniqueOrThrow({ where: { id: postId } })
    expect(published.status).toBe('PUBLISHED')
    expect(published.publishedAt).not.toBeNull()

    await page.goto(`/blog/${SLUG}`)
    await expect(page.getByRole('heading', { level: 1, name: EDITED_TITLE })).toBeVisible()
    expect((await request.get(`/api/v1/blog/${SLUG}`)).status()).toBe(200)
  })

  test('E2E-ADMIN-66 — Dépublier le fait disparaître : 404 sur le site et dans l’API', async ({ page, request }) => {
    test.setTimeout(60_000)
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/conseils/${postId}`)

    await page.getByRole('button', { name: 'Dépublier' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Dépublier' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Article dépublié/ })).toBeVisible()

    expect((await page.goto(`/blog/${SLUG}`))?.status()).toBe(404)
    expect((await request.get(`/api/v1/blog/${SLUG}`)).status()).toBe(404)
  })

  test('E2E-ADMIN-64 — Un article dépublié se supprime, et le journal en garde la trace', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/conseils/${postId}`)

    await page.getByRole('button', { name: 'Supprimer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer' }).click()
    await page.waitForURL('**/admin/conseils')

    expect(await prisma.blogPost.findUnique({ where: { id: postId } })).toBeNull()

    const actions = await prisma.adminAuditLog.findMany({
      where: { targetId: postId },
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    })
    expect(actions.map(a => a.action)).toEqual(['blog.update', 'blog.publish', 'blog.unpublish', 'blog.delete'])
  })
})
