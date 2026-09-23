import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'

import { loginAs, prisma } from './fixtures'

/**
 * Suppression du compte depuis le web — spec 13, §7 et §9.
 *
 * Le compte supprimé laisse des traces chez un **voisin** : il le suivait, en
 * était suivi, avait aimé et commenté sa publication, ouvert un fil sur son
 * annonce. Les compteurs dénormalisés du voisin sont recalculés en SQL brut,
 * que les tests unitaires ne voient pas : seul ce parcours, contre Postgres,
 * l'atteste. Ne pas le supprimer en pensant qu'il double le test du service.
 */

const PREFIX = 'e2e-suppression-'
const TARGET_EMAIL = `${PREFIX}cible@growi-garden.fr`
const NEIGHBOUR_EMAIL = `${PREFIX}voisin@growi-garden.fr`
const PASSWORD = 'Suppr-E2E-2026!'
const TOURS = { lat: 47.39, lng: 0.69 }

let neighbourId = ''
let postId = ''
let listingId = ''

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(PASSWORD, 10)

  const neighbour = await prisma.user.create({
    data: {
      email: NEIGHBOUR_EMAIL,
      firstName: 'Voisin',
      password,
      onboarded: true,
      analyticsConsent: false,
      communityEnabled: true,
      handle: 'e2e_voisin_suppr',
    },
  })
  neighbourId = neighbour.id

  const target = await prisma.user.create({
    data: {
      email: TARGET_EMAIL,
      firstName: 'Cible',
      password,
      onboarded: true,
      analyticsConsent: false,
      communityEnabled: true,
      handle: 'e2e_cible_suppr',
    },
  })

  // Les compteurs sont posés à la main, tels que les services les auraient
  // laissés : c'est leur recalcul qu'on vérifie.
  await prisma.follow.createMany({
    data: [
      { followerId: target.id, followingId: neighbour.id },
      { followerId: neighbour.id, followingId: target.id },
    ],
  })
  await prisma.user.update({
    where: { id: neighbour.id },
    data: { followerCount: 1, followingCount: 1 },
  })

  const post = await prisma.post.create({
    data: {
      userId: neighbour.id,
      body: 'Publication du voisin e2e',
      photos: [],
      lat: TOURS.lat,
      lng: TOURS.lng,
      likeCount: 1,
      commentCount: 1,
    },
  })
  postId = post.id
  await prisma.postLike.create({ data: { postId, userId: target.id } })
  await prisma.comment.create({ data: { postId, userId: target.id, body: 'Joli !' } })

  const listing = await prisma.listing.create({
    data: {
      userId: neighbour.id,
      kind: 'give',
      category: 'seeds',
      title: 'Graines du voisin e2e',
      lat: TOURS.lat,
      lng: TOURS.lng,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
      threadCount: 1,
    },
  })
  listingId = listing.id
  await prisma.listingThread.create({
    data: { listingId, ownerId: neighbour.id, requesterId: target.id },
  })

  // Un jardin, pour vérifier que la cascade emporte bien le contenu privé.
  await prisma.garden.create({ data: { userId: target.id, name: 'Jardin à effacer', type: 'OUTDOOR' } })
})

test.afterAll(cleanup)

test.describe('Suppression du compte', () => {
  test('E2E-SUPPR-01 — Un mot de passe faux ne supprime rien', async ({ page }) => {
    test.slow()
    await loginAs(page, TARGET_EMAIL, PASSWORD)
    await page.goto('/dashboard/compte#confidentialite')

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
    const dialog = page.getByRole('dialog', { name: 'Supprimer ton compte ?' })
    const submit = dialog.getByRole('button', { name: 'Supprimer définitivement' })

    // Le mot doit être exact : en minuscules, le bouton reste éteint.
    await dialog.getByLabel(/pour confirmer/).fill('supprimer')
    await dialog.getByLabel('Ton mot de passe').fill('pas-le-bon')
    await expect(submit).toBeDisabled()

    await dialog.getByLabel(/pour confirmer/).fill('SUPPRIMER')
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(dialog.getByRole('alert')).toContainText('Mot de passe incorrect', {
      timeout: 30_000,
    })
    expect(await prisma.user.count({ where: { email: TARGET_EMAIL } })).toBe(1)
  })

  test('E2E-SUPPR-02 — Le compte part, ses traces chez le voisin sont recomptées', async ({
    page,
  }) => {
    test.slow()
    await loginAs(page, TARGET_EMAIL, PASSWORD)
    await page.goto('/dashboard/compte#confidentialite')

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
    const dialog = page.getByRole('dialog', { name: 'Supprimer ton compte ?' })
    await dialog.getByLabel(/pour confirmer/).fill('SUPPRIMER')
    await dialog.getByLabel('Ton mot de passe').fill(PASSWORD)
    await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click()

    // Déconnecté, renvoyé vers l'accueil avec la confirmation.
    await page.waitForURL(/\/\?compte=supprime$/, { timeout: 60_000 })
    await expect(page.getByRole('status')).toContainText('Ton compte a été supprimé.')

    // Plus aucune ligne, ni pour le compte ni pour son contenu privé.
    expect(await prisma.user.count({ where: { email: TARGET_EMAIL } })).toBe(0)
    expect(await prisma.garden.count({ where: { name: 'Jardin à effacer' } })).toBe(0)

    // Les compteurs du voisin reflètent ce qui reste.
    const neighbour = await prisma.user.findUniqueOrThrow({
      where: { id: neighbourId },
      select: { followerCount: true, followingCount: true },
    })
    expect(neighbour).toEqual({ followerCount: 0, followingCount: 0 })

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: { likeCount: true, commentCount: true },
    })
    expect(post).toEqual({ likeCount: 0, commentCount: 0 })

    const listing = await prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      select: { threadCount: true },
    })
    expect(listing.threadCount).toBe(0)

    // Et l'adresse ne rouvre plus rien.
    await page.goto('/login')
    await page.fill('#email', TARGET_EMAIL)
    await page.fill('#password', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/login/)
  })
})
