import { test, expect, type Page } from '@playwright/test'
import type { Prisma } from '@prisma/client'
import {
  loginAs,
  seedTestUser,
  seedTestPlant,
  cleanupTestData,
  prisma,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

// Le fil de discussion, de la fiche plante jusqu'au calendrier.
//
// Seul l'appel au modèle est simulé — il serait facturé, lent, et sa réponse
// varierait d'une exécution à l'autre. Tout le reste est réel : l'ouverture du
// fil, sa persistance, la confirmation d'une proposition, et la tâche qui en
// naît dans le planning. C'est cette chaîne-là qui casse en silence.

let plantId: string
let userId: string

const ANSWER =
  'Ton basilic supporte mal le froid. **Rentre-le** avant les premières gelées.\n- Une pièce lumineuse\n- Loin d’un radiateur'

/**
 * Simule la réponse de l'agent.
 *
 * Les deux messages sont écrits en base comme le ferait le service : sans
 * eux, la confirmation d'une proposition n'aurait rien à relire — c'est la
 * copie serveur qui est exécutée, jamais ce que le client renvoie.
 *
 * Le corps SSE est délivré d'un bloc par Playwright : ce test vérifie le
 * rendu final, pas l'arrivée au fil de l'eau, que couvrent les tests de
 * `@growi/api-client`.
 */
async function mockAssistantReply(page: Page, withProposal = true) {
  await page.route('**/api/v1/conversations/*/messages', async (route) => {
    const conversationId = new URL(route.request().url()).pathname.split('/').at(-2)!

    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        userId,
        role: 'user',
        content: JSON.parse(route.request().postData() ?? '{}').content ?? '',
      },
    })

    const proposals = withProposal
      ? [
          {
            id: 'prop-e2e-1',
            kind: 'plan_task',
            title: 'Planifier : Rentrer le basilic — aujourd’hui',
            payload: {
              actionType: 'autre',
              shortLabel: 'Rentrer le basilic',
              label: 'Rentre le basilic dans une pièce lumineuse avant les gelées.',
              dueInDays: 0,
              priority: 'urgent',
            },
            acceptedAt: null,
            result: null,
          },
        ]
      : []

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        userId,
        role: 'assistant',
        content: ANSWER,
        model: 'gemini-2.5-flash',
        ...(proposals.length > 0
          ? { proposals: proposals as unknown as Prisma.InputJsonValue }
          : {}),
      },
    })

    const serialize = (message: typeof userMessage, withProposals = false) => ({
      id: message.id,
      conversationId,
      role: message.role,
      content: message.content,
      photoUrl: null,
      proposals: withProposals && proposals.length > 0 ? proposals : null,
      createdAt: message.createdAt.toISOString(),
    })

    const events = [
      `event: meta\ndata: ${JSON.stringify({ conversationId, userMessage: serialize(userMessage) })}\n\n`,
      `event: text\ndata: ${JSON.stringify({ delta: ANSWER })}\n\n`,
      ...(proposals.length > 0
        ? [`event: proposals\ndata: ${JSON.stringify({ proposals })}\n\n`]
        : []),
      `event: done\ndata: ${JSON.stringify({
        assistantMessage: serialize(assistantMessage, true),
        quota: { limit: 20, used: 1, remaining: 19, resetsAt: '2099-01-01T00:00:00.000Z' },
      })}\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: events,
    })
  })
}

test.beforeAll(async () => {
  const data = await seedTestUser()
  const plant = await seedTestPlant(data.gardenId!, data.userId)
  plantId = plant.id
  userId = data.userId
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe.serial('Agent conversationnel', () => {
  test('E2E-CHAT-01 — Question → réponse → proposition confirmée → tâche au calendrier', async ({
    page,
  }) => {
    await mockAssistantReply(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)

    await page.getByRole('button', { name: /Poser une question/i }).click()

    const panel = page.getByTestId('chat-panel')
    await expect(panel).toBeVisible()
    // L'ancrage est dans l'URL : le lien est partageable, et « précédent »
    // referme le panneau.
    await expect(page).toHaveURL(/chat=plant/)

    // Le fil vide propose des amorces plutôt qu'une page blanche.
    await expect(panel.getByRole('button', { name: /Quels sont ses besoins en hiver/i })).toBeVisible()

    await panel.getByLabel('Ta question').fill('Je peux la laisser dehors cet hiver ?')
    await panel.getByLabel('Envoyer').click()

    // La question de l'utilisateur, puis la réponse — gras et puces compris.
    await expect(panel.getByText('Je peux la laisser dehors cet hiver ?')).toBeVisible()
    await expect(panel.getByText('Rentre-le')).toBeVisible()
    await expect(panel.getByText('Une pièce lumineuse')).toBeVisible()

    // La proposition ne fait rien tant qu'elle n'est pas confirmée.
    const proposal = panel.getByTestId('chat-proposal')
    await expect(proposal).toBeVisible()
    await expect(proposal.getByText(/Planifier : Rentrer le basilic/)).toBeVisible()
    expect(await prisma.plantTask.count({ where: { plantInstanceId: plantId } })).toBe(0)

    await proposal.getByRole('button', { name: /Confirmer/i }).click()
    await expect(panel.getByTestId('chat-proposal-accepted')).toBeVisible()

    // La tâche existe vraiment, et porte sa provenance.
    const task = await prisma.plantTask.findFirstOrThrow({
      where: { plantInstanceId: plantId },
    })
    expect(task.source).toBe('CHAT')
    expect(task.shortLabel).toBe('Rentrer le basilic')

    // Et le calendrier la montre.
    await page.goto('/dashboard/calendrier')
    await expect(page.getByText('Rentrer le basilic').first()).toBeVisible()
  })

  test('E2E-CHAT-02 — Rouvrir le même point d’entrée retrouve le fil', async ({ page }) => {
    await mockAssistantReply(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)

    await page.getByRole('button', { name: /Poser une question/i }).click()

    const panel = page.getByTestId('chat-panel')
    await expect(panel).toBeVisible()

    // Une conversation par ancrage : les messages du premier test sont là,
    // et aucun second fil n'a été ouvert.
    await expect(panel.getByText('Je peux la laisser dehors cet hiver ?')).toBeVisible()
    expect(
      await prisma.conversation.count({ where: { userId, anchorKey: `plant:${plantId}` } }),
    ).toBe(1)
  })

  test('E2E-CHAT-03 — Quota atteint : la saisie se ferme', async ({ page }) => {
    // Vingt messages du jour, comptés par le serveur dans le fuseau de
    // l'utilisateur. Aucun mock ici : c'est le vrai refus qu'on veut voir.
    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { userId, anchorKey: `plant:${plantId}` },
    })
    await prisma.message.createMany({
      data: Array.from({ length: 20 }, () => ({
        conversationId: conversation.id,
        userId,
        role: 'user',
        content: 'Message de remplissage',
      })),
    })

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}?chat=plant&plantId=${plantId}`)

    const panel = page.getByTestId('chat-panel')
    await expect(panel).toBeVisible()

    // Le plafond est connu dès l'ouverture : la saisie ne s'affiche même pas.
    await expect(panel.getByTestId('chat-quota')).toBeVisible()
    await expect(panel.getByLabel('Ta question')).toHaveCount(0)
  })
})
