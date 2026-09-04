import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Messagerie : réception depuis le site public, boîte de réception, fil.

const ADMIN_EMAIL = 'test-e2e-msg-admin@growi-garden.fr'
// Écrit avec des majuscules pour éprouver le rattachement insensible à la casse.
const SENDER_EMAIL = 'Test-E2E-Msg-Expediteur@growi-garden.fr'
const BODY = 'Mon basilic fait grise mine depuis une bonne semaine, que faire ?'

let messageId = ''

async function cleanup() {
  await prisma.contactMessage.deleteMany({
    where: { email: { in: [SENDER_EMAIL, SENDER_EMAIL.toLowerCase()] } },
  })
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: ADMIN_EMAIL } } })
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, SENDER_EMAIL.toLowerCase()] } },
  })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'Msg', password, role: 'ADMIN' },
  })
  // Le compte de l'expéditeur, en minuscules : le rattachement doit le trouver.
  const sender = await prisma.user.create({
    data: { email: SENDER_EMAIL.toLowerCase(), firstName: 'Expéditeur', password },
  })

  // Réception directe en base, comme le ferait le formulaire public. On ne
  // passe pas par la page /contact : ce parcours a ses propres tests, et
  // Resend n'est pas joignable ici.
  const message = await prisma.contactMessage.create({
    data: {
      source: 'contact',
      firstName: 'Sophie',
      lastName: 'Dupont',
      email: SENDER_EMAIL,
      subject: 'technique',
      body: BODY,
      userId: sender.id,
    },
  })
  messageId = message.id
})

test.afterAll(cleanup)

test.describe('Admin — messagerie', () => {
  test('E2E-ADMIN-30 — La boîte liste le message et le compte rattaché', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/messages')

    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()

    // On vise **la ligne de ce message**, pas le tableau entier : la boîte
    // contient ce que d'autres tests ou de vrais messages y ont laissé, et une
    // assertion à l'échelle du tableau se casse au premier voisin.
    const row = page.locator('tbody tr').filter({ hasText: SENDER_EMAIL })
    await expect(row).toHaveCount(1)
    await expect(row.getByText('Sophie Dupont')).toBeVisible()
    // Le message a été créé sans notification : la pastille doit le dire.
    await expect(row.getByText('Non notifié')).toBeVisible()
    // Rattachement insensible à la casse : le lien vers la fiche existe.
    await expect(row.getByRole('link', { name: 'Voir la fiche' })).toBeVisible()

    await page.screenshot({ path: 'test-results/admin-messages.png', fullPage: true })
  })

  test('E2E-ADMIN-31 — Le compteur « nouveaux » apparaît dans la navigation', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/messages')

    const nav = page.getByRole('navigation', { name: 'Navigation administration' })
    await expect(nav.getByLabel(/en attente/)).toBeVisible()
  })

  test('E2E-ADMIN-32 — Les filtres passent par l’URL', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    await page.goto('/admin/messages?statut=answered')
    await expect(page.locator('tbody tr').filter({ hasText: SENDER_EMAIL })).toHaveCount(0)

    await page.goto('/admin/messages?statut=new')
    await expect(page.locator('tbody tr').filter({ hasText: SENDER_EMAIL })).toHaveCount(1)

    // Un statut inconnu vaut « pas de filtre », jamais une erreur.
    await page.goto('/admin/messages?statut=nimportequoi&apres=cassé')
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
  })

  test('E2E-ADMIN-33 — Le fil affiche le message, le compte et la note interne', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/messages/${messageId}`)

    await expect(page.getByRole('heading', { name: 'Problème technique' })).toBeVisible()
    await expect(page.getByText(BODY)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ouvrir la fiche' })).toBeVisible()

    await page.fill('textarea[name="note"]', 'Relancer lundi si pas de nouvelles.')
    await page.getByRole('button', { name: 'Enregistrer la note' }).click()
    await expect(page.getByRole('status')).toContainText('Note enregistrée', { timeout: 15_000 })

    const saved = await prisma.contactMessage.findUniqueOrThrow({ where: { id: messageId } })
    expect(saved.internalNote).toBe('Relancer lundi si pas de nouvelles.')

    await page.screenshot({ path: 'test-results/admin-message-fil.png', fullPage: true })
  })

  test('E2E-ADMIN-34 — Archiver puis rouvrir', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/messages/${messageId}`)

    await page.getByRole('button', { name: 'Archiver' }).click()
    await expect(page.getByRole('status')).toContainText('archivé', { timeout: 15_000 })

    await expect
      .poll(async () => (await prisma.contactMessage.findUniqueOrThrow({ where: { id: messageId } })).status)
      .toBe('archived')

    // Archiver range, ne clôt pas : le message revient d'un clic.
    await page.goto(`/admin/messages/${messageId}`)
    await page.getByRole('button', { name: 'Rouvrir' }).click()
    await expect(page.getByRole('status')).toContainText('rouvert', { timeout: 15_000 })

    await expect
      .poll(async () => (await prisma.contactMessage.findUniqueOrThrow({ where: { id: messageId } })).status)
      .toBe('new')
  })

  test('E2E-ADMIN-35 — Un compte ordinaire n’atteint pas la messagerie', async ({ page }) => {
    await loginAs(page, SENDER_EMAIL.toLowerCase(), TEST_PASSWORD)
    await page.goto('/admin/messages')
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  })
})
