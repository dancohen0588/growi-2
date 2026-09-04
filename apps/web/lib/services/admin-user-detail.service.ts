/**
 * Lecture de la fiche d'un compte, onglet par onglet.
 *
 * Chaque onglet a sa fonction : la page n'en appelle qu'une, celle de l'onglet
 * demandé. Charger les six d'un coup ferait six agrégats à chaque ouverture
 * pour n'en montrer qu'un — et la fiche d'un compte fourni deviendrait lente
 * alors qu'on ne voulait qu'un email.
 *
 * Comme le reste de la couche, ce service **ne lit jamais la session** :
 * l'`userId` reçu est celui de la **cible**, jamais celui de l'appelant.
 */

import type { AlertConfig } from '@growi/shared'
import { DEFAULT_ALERT_CONFIG } from '@growi/shared'

import { displayNameOf } from '@/lib/admin/serializers'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

/** Fenêtre du calendrier d'activité, en jours. */
export const ACTIVITY_WINDOW_DAYS = 90

// ─── Profil ────────────────────────────────────────────────────────────────

export type AdminUserDetail = {
  id: string
  email: string
  displayName: string
  firstName: string | null
  lastName: string | null
  name: string | null
  role: string
  plan: string
  timezone: string
  onboarded: boolean
  address: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  gardenType: string | null
  alertConfig: AlertConfig
  createdAt: Date
  updatedAt: Date
  lastSeenAt: Date | null
  disabledAt: Date | null
  emailVerified: Date | null
  /** Le compte a-t-il un mot de passe ? Jamais sa valeur, évidemment. */
  hasPassword: boolean
  /** `apple`, `google`… — les fournisseurs rattachés. */
  providers: string[]
  counts: { gardens: number; plants: number; diagnoses: number; conversations: number }
}

/**
 * La fiche d'un compte.
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 */
export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
      plan: true,
      timezone: true,
      onboarded: true,
      address: true,
      locationCity: true,
      latitude: true,
      longitude: true,
      gardenType: true,
      alertConfig: true,
      createdAt: true,
      updatedAt: true,
      lastSeenAt: true,
      disabledAt: true,
      emailVerified: true,
      // On ne sélectionne **pas** `password` : seul son caractère renseigné
      // nous intéresse, et il est plus sûr de ne jamais le charger en mémoire.
      accounts: { select: { provider: true } },
      _count: {
        select: {
          gardens: true,
          plantInstances: true,
          diagnoses: true,
          conversations: true,
        },
      },
    },
  })

  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  // Une requête à part, qui ne ramène qu'un booléen calculé par Postgres.
  const withPassword = await prisma.user.count({
    where: { id: userId, password: { not: null } },
  })

  return {
    id: user.id,
    email: user.email,
    displayName: displayNameOf(user),
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    role: user.role,
    plan: user.plan,
    timezone: user.timezone,
    onboarded: user.onboarded,
    address: user.address,
    city: user.locationCity,
    latitude: user.latitude,
    longitude: user.longitude,
    gardenType: user.gardenType,
    alertConfig: { ...DEFAULT_ALERT_CONFIG, ...((user.alertConfig as AlertConfig | null) ?? {}) },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSeenAt: user.lastSeenAt,
    disabledAt: user.disabledAt,
    emailVerified: user.emailVerified,
    hasPassword: withPassword > 0,
    providers: user.accounts.map((account) => account.provider),
    counts: {
      gardens: user._count.gardens,
      plants: user._count.plantInstances,
      diagnoses: user._count.diagnoses,
      conversations: user._count.conversations,
    },
  }
}

// ─── Jardins ───────────────────────────────────────────────────────────────

export async function getUserGardens(userId: string) {
  const gardens = await prisma.garden.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      surfaceM2: true,
      orientation: true,
      soilType: true,
      climateZone: true,
      createdAt: true,
      // `canvasData` est une chaîne JSON qui peut peser : on ne veut savoir
      // que si un plan existe, pas le charger pour l'afficher en tableau.
      _count: { select: { zones: true, plantInstances: true } },
      zones: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  })

  return gardens
}

// ─── Plantes ───────────────────────────────────────────────────────────────

export async function getUserPlants(userId: string) {
  const plants = await prisma.plantInstance.findMany({
    where: { userId },
    orderBy: { dateAdded: 'desc' },
    select: {
      id: true,
      customName: true,
      emoji: true,
      location: true,
      healthStatus: true,
      healthNote: true,
      alertsEnabled: true,
      dateAdded: true,
      lastWateredAt: true,
      lastFertilizedAt: true,
      lastPrunedAt: true,
      lastRepottedAt: true,
      lastTreatedAt: true,
      catalogPlant: { select: { commonName: true, scientificName: true } },
      garden: { select: { id: true, name: true } },
      zone: { select: { name: true } },
      _count: { select: { careLogs: true, diagnoses: true } },
    },
  })

  // Les tâches ouvertes en une seule requête groupée : une par plante en
  // ferait autant que de plantes.
  const openTasks = await prisma.plantTask.groupBy({
    by: ['plantInstanceId'],
    where: { userId, doneAt: null },
    _count: { _all: true },
  })
  const openByPlant = new Map(openTasks.map((row) => [row.plantInstanceId, row._count._all]))

  return plants.map((plant) => ({
    ...plant,
    displayName: plant.customName ?? plant.catalogPlant?.commonName ?? 'Plante sans nom',
    openTasks: openByPlant.get(plant.id) ?? 0,
  }))
}

// ─── Diagnostics et conversations ──────────────────────────────────────────

export async function getUserDiagnoses(userId: string, limit = 50) {
  return prisma.diagnosis.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      confidence: true,
      summary: true,
      statusApplied: true,
      tasksPlannedAt: true,
      model: true,
      createdAt: true,
      plantInstance: {
        select: { id: true, customName: true, catalogPlant: { select: { commonName: true } } },
      },
    },
  })
}

export async function getUserConversations(userId: string, limit = 50) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      lastMessageAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  })
}

// ─── Activité ──────────────────────────────────────────────────────────────

export type ActivityDay = { day: string; surfaces: string[] }

export async function getUserActivity(userId: string, days = ACTIVITY_WINDOW_DAYS) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [rows, sessions, pushTokens] = await Promise.all([
    prisma.userActivity.findMany({
      where: { userId, day: { gte: since } },
      orderBy: { day: 'desc' },
      select: { day: true, surface: true },
    }),
    // Les sessions mobiles encore ouvertes. Ni `tokenHash`, ni rien qui
    // permette de rejouer quoi que ce soit.
    prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, deviceInfo: true, createdAt: true, expiresAt: true },
    }),
    prisma.pushToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      // `token` est volontairement absent : il permettrait d'écrire à
      // l'appareil de quelqu'un depuis n'importe où.
      select: { id: true, platform: true, createdAt: true, updatedAt: true },
    }),
  ])

  const byDay = new Map<string, string[]>()
  for (const row of rows) {
    const surfaces = byDay.get(row.day) ?? []
    surfaces.push(row.surface)
    byDay.set(row.day, surfaces)
  }

  const activity: ActivityDay[] = [...byDay.entries()].map(([day, surfaces]) => ({
    day,
    surfaces: surfaces.sort(),
  }))

  return { activity, sessions, pushTokens }
}
