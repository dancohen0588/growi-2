import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEST_EMAIL = 'test-e2e@growi-garden.fr'
const TEST_EMAIL_2 = 'test-e2e-2@growi-garden.fr'
const TEST_PASSWORD = 'TestPassword123!'
const TEST_GARDEN_NAME = 'Jardin E2E'

export { TEST_EMAIL, TEST_EMAIL_2, TEST_PASSWORD }

/**
 * Les comptes de test ont déjà répondu à la question du consentement : la
 * boîte, non fermable sans réponse, bloquerait sinon tous les parcours du
 * dashboard. Elle est testée pour elle-même dans `29-rgpd-consentement`.
 * Les comptes persistants, créés avant la question, sont mis à niveau ici.
 */
async function markConsentAnswered(user: { id: string; analyticsConsent: boolean | null }) {
  if (user.analyticsConsent !== null) return
  await prisma.user.update({ where: { id: user.id }, data: { analyticsConsent: false } })
}

export async function seedTestUser() {
  const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
  if (existing) {
    await markConsentAnswered(existing)
    const garden = await prisma.garden.findFirst({
      where: { userId: existing.id },
      select: { id: true },
    })
    return { userId: existing.id, gardenId: garden?.id ?? null }
  }

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: 'E2E Test',
      firstName: 'E2E',
      lastName: 'Test',
      password: hashedPassword,
      latitude: 48.85,
      longitude: 2.35,
      onboarded: true,
      analyticsConsent: false,
    },
  })

  const garden = await prisma.garden.create({
    data: {
      userId: user.id,
      name: TEST_GARDEN_NAME,
      type: 'OUTDOOR',
    },
  })

  return { userId: user.id, gardenId: garden.id }
}

export async function seedTestUser2() {
  const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL_2 } })
  if (existing) {
    await markConsentAnswered(existing)
    const garden = await prisma.garden.findFirst({
      where: { userId: existing.id },
      select: { id: true },
    })
    return { userId: existing.id, gardenId: garden?.id ?? null }
  }

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL_2,
      name: 'E2E Test 2',
      firstName: 'E2E2',
      lastName: 'Test2',
      password: hashedPassword,
      latitude: 43.6,
      longitude: 1.44,
      onboarded: true,
      analyticsConsent: false,
    },
  })

  const garden = await prisma.garden.create({
    data: {
      userId: user.id,
      name: 'Jardin E2E 2',
      type: 'OUTDOOR',
    },
  })

  return { userId: user.id, gardenId: garden.id }
}

export async function seedTestPlant(
  gardenId: string,
  userId: string,
  catalogScientificName?: string,
) {
  let catalogPlantId: string | undefined
  if (catalogScientificName) {
    const cat = await prisma.plantCatalog.findFirst({
      where: { scientificName: { contains: catalogScientificName } },
      select: { id: true, wateringFreqDays: true, sunExposure: true, emoji: true },
    })
    if (cat) catalogPlantId = cat.id
  }

  const instance = await prisma.plantInstance.create({
    data: {
      userId,
      gardenId,
      catalogPlantId: catalogPlantId ?? null,
      location: 'OUTDOOR',
      customName: catalogScientificName ? undefined : 'Plante libre E2E',
      emoji: '🌿',
    },
  })

  return instance
}

export async function cleanupTestData() {
  // Delete users (cascade deletes gardens, plants, logs)
  await prisma.user.deleteMany({
    where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } },
  })
}

export async function clearAdviceCache(gardenId: string) {
  await prisma.gardenAdviceCache.deleteMany({ where: { gardenId } })
}

export { prisma }
