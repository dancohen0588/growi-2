/**
 * Service « Secrets de jardinier » — le secret de la semaine, ses suites
 * (« c'est prêt », « Ça a marché ? »), les refus, et le grimoire.
 *
 * Les secrets ne passent **pas** par le moteur de règles ni par son cache de
 * six heures : comme les tâches de diagnostic, ils sont ajoutés par
 * `advice.service.assemble`, après lecture du cache. « Je tente » doit faire
 * disparaître la carte aussitôt, pas six heures plus tard.
 *
 * Rien ici ne doit casser le planning : `secretActionsForGarden` rattrape ses
 * erreurs et rend une liste vide. Un secret est un agrément.
 *
 * Spec : `Documentation/spec/16-analyse-moteur-reco-secrets.md` §5 et §8.
 */

import {
  SECRET_RULE_IDS,
  secretConditionsSchema,
  secretPlancheSchema,
  type GardenSecret,
  type Grimoire,
  type GrimoireEntry,
  type SecretEvidence,
  type SecretFeedbackInput,
  type SecretPlanche,
  type SecretStage,
  type SecretVerdict,
  type TrySecretInput,
} from '@growi/shared'

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { fetchWeatherForecast } from '@/lib/recommendation/weather-adapter'
import type { GardenAction } from '@/lib/recommendation/types'
import {
  isoWeekBounds,
  isoWeekKey,
  selectWeeklySecret,
  type SecretPlant,
  type SecretWeather,
} from '@/lib/secrets/select'
import { ServiceError } from '@/lib/services/errors'
import { planSecretTask } from '@/lib/services/task.service'
import { safeTimeZone, zonedDayIso } from '@/lib/zoned-day'

const DAY_MS = 86_400_000

/** Le « Ça a marché ? » vient une semaine après l'usage. */
const FEEDBACK_AFTER_DAYS = 7
/** Au-delà, on ne relance plus : la question n'a plus de sens. */
const FEEDBACK_UNTIL_DAYS = 30
/** Une préparation oubliée plus longtemps ne réclame plus d'attention. */
const READY_UNTIL_DAYS = 30
/** Profondeur du journal relu pour le cooldown et le grimoire. */
const TRIAL_LOOKBACK_DAYS = 730
/**
 * Profondeur relue pour les suites d'un essai : la plus longue préparation
 * permise à l'admin (60 jours), puis la fenêtre de « c'est prêt », la semaine
 * d'attente et la fenêtre du « Ça a marché ? ».
 */
const SUITES_LOOKBACK_DAYS = 60 + READY_UNTIL_DAYS + FEEDBACK_AFTER_DAYS + FEEDBACK_UNTIL_DAYS + 2
/** Un jardin sans secret possible cette semaine n'est pas recalculé avant une heure. */
const NO_PICK_TTL_MS = 60 * 60 * 1000

// ─── Bibliothèque ──────────────────────────────────────────────────────────

export interface TipRecord {
  slug: string
  title: string
  teaser: string
  story: string | null
  recipe: string
  ingredients: string[]
  evidence: SecretEvidence
  cautions: string | null
  prepDays: number
  effortMinutes: number | null
  cooldownDays: number
  conditions: ReturnType<typeof secretConditionsSchema.parse>
  planche: SecretPlanche | null
}

/**
 * Les secrets publiés, gardés une minute en mémoire : ils changent rarement,
 * et le planning est lu à chaque ouverture de l'app. Une édition dans l'admin
 * appelle `forgetPublishedTips`, sur l'instance qui l'a faite ; les autres
 * suivent dans la minute.
 */
let cache: { at: number; tips: TipRecord[] } | null = null
const CACHE_MS = 60_000

export function forgetPublishedTips(): void {
  cache = null
}

function toRecord(row: {
  slug: string
  title: string
  teaser: string
  story: string | null
  recipe: string
  ingredients: string[]
  evidence: string
  cautions: string | null
  prepDays: number
  effortMinutes: number | null
  cooldownDays: number
  conditions: unknown
  planche?: unknown
}): TipRecord | null {
  const conditions = secretConditionsSchema.safeParse(row.conditions ?? {})
  if (!conditions.success) {
    // Une condition mal écrite à l'admin ne doit pas proposer le secret à tout
    // le monde : on l'écarte, et on le dit.
    console.error('[secrets.service] conditions invalides :', row.slug, conditions.error.message)
    return null
  }
  // Une planche qui cite un dessin retiré du registre est écartée : le secret
  // s'affiche alors en texte, plutôt qu'avec une case vide.
  const planche = row.planche == null ? null : secretPlancheSchema.safeParse(row.planche)
  if (planche && !planche.success) {
    console.error('[secrets.service] planche invalide :', row.slug, planche.error.message)
  }
  return {
    slug: row.slug,
    title: row.title,
    teaser: row.teaser,
    story: row.story,
    recipe: row.recipe,
    ingredients: row.ingredients,
    evidence: row.evidence as SecretEvidence,
    cautions: row.cautions,
    prepDays: row.prepDays,
    effortMinutes: row.effortMinutes,
    cooldownDays: row.cooldownDays,
    conditions: conditions.data,
    planche: planche?.success ? planche.data : null,
  }
}

export async function listPublishedTips(): Promise<TipRecord[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.tips
  const rows = await prisma.gardenTip.findMany({ where: { status: 'PUBLISHED' } })
  const tips = rows.flatMap((row) => toRecord(row) ?? [])
  cache = { at: Date.now(), tips }
  return tips
}

async function findPublishedTip(slug: string): Promise<TipRecord | null> {
  return (await listPublishedTips()).find((tip) => tip.slug === slug) ?? null
}

/**
 * Un secret quel que soit son statut. **Seulement** pour ce que l'utilisateur
 * a déjà entre les mains — les suites d'un essai, le nom d'un geste : un
 * brouillon ne doit jamais sortir par là.
 */
async function findTip(slug: string): Promise<TipRecord | null> {
  const published = await findPublishedTip(slug)
  if (published) return published
  const row = await prisma.gardenTip.findUnique({ where: { slug } })
  return row ? toRecord(row) : null
}

/** Le titre d'un secret, pour nommer le geste au journal. */
export async function secretTitle(slug: string): Promise<string | undefined> {
  return (await findTip(slug))?.title
}

function toSecret(tip: TipRecord, stage: SecretStage, trialCareLogId?: string): GardenSecret {
  return {
    slug: tip.slug,
    stage,
    title: tip.title,
    teaser: tip.teaser,
    evidence: tip.evidence,
    story: tip.story,
    recipe: tip.recipe,
    ingredients: tip.ingredients,
    cautions: tip.cautions,
    prepDays: tip.prepDays,
    effortMinutes: tip.effortMinutes,
    planche: tip.planche,
    ...(trialCareLogId ? { trialCareLogId } : {}),
  }
}

// ─── Le secret de la semaine ───────────────────────────────────────────────

type PlantRow = {
  id: string
  customName: string | null
  emoji: string | null
  photoUrl: string | null
  location: string
  healthStatus: string
  catalogPlant: {
    commonName: string
    emoji: string | null
    imageUrl: string | null
    category: string
    family: string | null
    scientificName: string
    edible: boolean
    toxic: boolean
  } | null
}

function toSecretPlant(plant: PlantRow): SecretPlant {
  return {
    id: plant.id,
    location: plant.location,
    healthStatus: plant.healthStatus,
    catalog: plant.catalogPlant
      ? {
          category: plant.catalogPlant.category,
          family: plant.catalogPlant.family,
          scientificName: plant.catalogPlant.scientificName,
          edible: plant.catalogPlant.edible,
          toxic: plant.catalogPlant.toxic,
        }
      : null,
  }
}

function plantFields(plant: PlantRow) {
  return {
    plantId: plant.id,
    plantName: plant.customName ?? plant.catalogPlant?.commonName ?? 'Plante',
    plantEmoji: plant.emoji ?? plant.catalogPlant?.emoji ?? '',
    plantPhotoUrl: plant.photoUrl ?? plant.catalogPlant?.imageUrl ?? null,
  }
}

async function weatherForPick(userId: string): Promise<SecretWeather | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    })
    if (user?.latitude == null || user.longitude == null) return null
    const forecast = await fetchWeatherForecast(user.latitude, user.longitude)
    const today = forecast.daily[0]
    if (!today) return null
    return { tempMax: today.tempMax, tempMin: today.tempMin, recentPrecip: forecast.recentPrecipSum }
  } catch {
    // Sans météo, les secrets « du moment » ne sont pas tirés — rien de plus.
    return null
  }
}

/**
 * Le secret de la semaine du jardin : relu s'il a déjà été tiré, tiré et figé
 * sinon. Deux appels simultanés tirent la même chose (tirage déterministe) et
 * l'index unique `(gardenId, week)` n'en garde qu'un.
 */
async function weeklyPick(
  userId: string,
  gardenId: string,
  today: string,
  plants: PlantRow[],
  lunarEnabled: boolean,
): Promise<{ slug: string; plantInstanceId: string } | null> {
  const week = isoWeekKey(today)
  const existing = await prisma.gardenTipPick.findUnique({
    where: { gardenId_week: { gardenId, week } },
    select: { slug: true, plantInstanceId: true },
  })
  if (existing) return existing
  if (plants.length === 0) return null

  // Un tirage vide n'est pas écrit (une plante ajoutée demain doit pouvoir en
  // recevoir un) : sans mémoire, il serait refait à chaque ouverture du planning.
  const memoKey = `${gardenId}:${week}`
  const memo = noPickUntil.get(memoKey)
  if (memo && memo > Date.now()) return null

  const tips = await listPublishedTips()
  if (tips.length === 0) return null

  const since = new Date(Date.now() - TRIAL_LOOKBACK_DAYS * DAY_MS)
  const [userTips, trials, previous, weather] = await Promise.all([
    prisma.userTip.findMany({ where: { userId }, select: { slug: true, revealedAt: true, dismissedAt: true } }),
    prisma.careLog.findMany({
      where: {
        plantInstance: { userId },
        tipSlug: { not: null },
        ruleId: SECRET_RULE_IDS.discover,
        occurredAt: { gte: since },
      },
      select: { tipSlug: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
    }),
    prisma.gardenTipPick.findFirst({
      where: { gardenId },
      orderBy: { week: 'desc' },
      select: { slug: true },
    }),
    // La météo n'est lue qu'une fois par semaine et par jardin : au tirage.
    tips.some((tip) => tip.conditions.weather) ? weatherForPick(userId) : Promise.resolve(null),
  ])

  const lastTriedAt = new Map<string, Date>()
  for (const trial of trials) {
    if (trial.tipSlug && !lastTriedAt.has(trial.tipSlug)) lastTriedAt.set(trial.tipSlug, trial.occurredAt)
  }
  const previousTip = previous ? tips.find((tip) => tip.slug === previous.slug) : undefined

  const pick = selectWeeklySecret({
    gardenId,
    today,
    tips,
    plants: plants.map(toSecretPlant),
    weather,
    lunarEnabled,
    dismissed: new Set(userTips.filter((tip) => tip.dismissedAt).map((tip) => tip.slug)),
    revealed: new Set(userTips.filter((tip) => tip.revealedAt).map((tip) => tip.slug)),
    lastTriedAt,
    previous: previousTip ? { slug: previousTip.slug, evidence: previousTip.evidence } : null,
  })
  if (!pick) {
    noPickUntil.set(memoKey, Date.now() + NO_PICK_TTL_MS)
    return null
  }

  await prisma.gardenTipPick.createMany({
    data: [{ gardenId, week, slug: pick.slug, plantInstanceId: pick.plantId }],
    skipDuplicates: true,
  })
  return prisma.gardenTipPick.findUnique({
    where: { gardenId_week: { gardenId, week } },
    select: { slug: true, plantInstanceId: true },
  })
}

const noPickUntil = new Map<string, number>()

/** Pour les tests. */
export function forgetNoPickMemo(): void {
  noPickUntil.clear()
}

function dayOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS)
}

function addDaysIso(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Les actions « secret » d'un jardin : au plus un secret à découvrir, plus
 * les suites des essais en cours — préparation prête, « Ça a marché ? ».
 * Seul le premier compte dans le rythme d'un secret par semaine.
 *
 * @param today Le jour de l'utilisateur, `YYYY-MM-DD`.
 */
export async function secretActionsForGarden(
  userId: string,
  gardenId: string,
  today: string,
): Promise<GardenAction[]> {
  try {
    return await buildSecretActions(userId, gardenId, today)
  } catch (err) {
    console.error('[secrets.service] secretActionsForGarden:', gardenId, err)
    return []
  }
}

async function buildSecretActions(userId: string, gardenId: string, today: string): Promise<GardenAction[]> {
  const [user, plants] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lunarCalendar: true, timezone: true } }),
    prisma.plantInstance.findMany({
      where: { userId, gardenId },
      select: {
        id: true,
        customName: true,
        emoji: true,
        photoUrl: true,
        location: true,
        healthStatus: true,
        catalogPlant: {
          select: {
            commonName: true,
            emoji: true,
            imageUrl: true,
            category: true,
            family: true,
            scientificName: true,
            edible: true,
            toxic: true,
          },
        },
      },
    }),
  ])
  if (plants.length === 0) return []

  const timeZone = safeTimeZone(user?.timezone ?? 'Europe/Paris')
  const plantById = new Map(plants.map((plant) => [plant.id, plant]))
  const { start: weekStart, end: weekEnd } = isoWeekBounds(today)

  // Le journal des secrets de ce jardin : essais, préparations utilisées, retours.
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - SUITES_LOOKBACK_DAYS * DAY_MS)
  const logs = await prisma.careLog.findMany({
    where: {
      plantInstanceId: { in: plants.map((plant) => plant.id) },
      ruleId: { in: Object.values(SECRET_RULE_IDS) },
      occurredAt: { gte: since },
    },
    select: { id: true, plantInstanceId: true, ruleId: true, tipSlug: true, occurredAt: true, tipVerdict: true },
    orderBy: { occurredAt: 'asc' },
  })

  const actions: GardenAction[] = []

  // 1. Le secret de la semaine.
  const pick = await weeklyPick(userId, gardenId, today, plants, user?.lunarCalendar ?? false)
  if (pick) {
    const plant = plantById.get(pick.plantInstanceId)
    // Publié, et seulement publié : dépublier un secret en urgence doit le
    // retirer des jardins qui l'ont déjà tiré cette semaine.
    const published = await findPublishedTip(pick.slug)
    // Un secret lunaire tiré avant que l'option soit coupée ne s'affiche plus.
    const tip = published?.conditions.lunarOnly && !user?.lunarCalendar ? null : published
    const [dismissed, planned, triedThisWeek] = await Promise.all([
      prisma.userTip.findFirst({ where: { userId, slug: pick.slug, dismissedAt: { not: null } }, select: { id: true } }),
      // « Je tente » l'a mis à faire : la tâche le porte désormais au planning,
      // la carte n'a plus à le proposer — ni cette semaine, ni tant qu'elle
      // reste ouverte.
      prisma.plantTask.findFirst({
        where: {
          userId,
          source: 'SECRET',
          tipSlug: pick.slug,
          OR: [
            { doneAt: null, supersededAt: null },
            { createdAt: { gte: new Date(Date.parse(`${weekStart}T00:00:00Z`) - DAY_MS) } },
          ],
        },
        select: { id: true },
      }),
      // Une version de l'app qui ignore les secrets coche l'action sans
      // `tipSlug` : la règle suffit à dire que c'est fait.
      Promise.resolve(
        logs.some(
          (log) =>
            log.ruleId === SECRET_RULE_IDS.discover &&
            dayOf(log.occurredAt, timeZone) >= weekStart &&
            (log.tipSlug === pick.slug || log.tipSlug === null),
        ),
      ),
    ])

    if (plant && tip && !dismissed && !planned && !triedThisWeek) {
      actions.push({
        id: `${SECRET_RULE_IDS.discover}:${gardenId}:${isoWeekKey(today)}`,
        type: 'autre',
        label: `Secret de jardinier — ${tip.title}`,
        shortLabel: 'Secret de jardinier',
        ...plantFields(plant),
        dueDate: weekEnd,
        done: false,
        priority: 'low',
        kind: 'window',
        window: { start: weekStart, end: weekEnd },
        estimatedMinutes: tip.effortMinutes ?? undefined,
        ruleId: SECRET_RULE_IDS.discover,
        why: tip.teaser,
        howTo: tip.recipe,
        secret: toSecret(tip, 'discover'),
      })
    }
  }

  // 2. Les suites des essais.
  const trials = logs.filter((log) => log.ruleId === SECRET_RULE_IDS.discover && log.tipSlug)
  for (const trial of trials) {
    const plant = plantById.get(trial.plantInstanceId)
    const tip = trial.tipSlug ? await findTip(trial.tipSlug) : null
    if (!plant || !tip) continue

    const trialDay = dayOf(trial.occurredAt, timeZone)
    const after = (ruleId: string) =>
      logs.find(
        (log) =>
          log.ruleId === ruleId &&
          log.plantInstanceId === trial.plantInstanceId &&
          // Sans `tipSlug` : une version de l'app qui ignore les secrets.
          (log.tipSlug === trial.tipSlug || log.tipSlug === null) &&
          log.occurredAt >= trial.occurredAt,
      )

    // Le jour où le remède a servi : l'essai lui-même, ou la préparation prête.
    let usedDay: string | null = trialDay
    if (tip.prepDays > 0) {
      const ready = after(SECRET_RULE_IDS.ready)
      const readyDay = addDaysIso(trialDay, tip.prepDays)
      usedDay = ready ? dayOf(ready.occurredAt, timeZone) : null

      if (!ready && readyDay <= today && daysBetween(readyDay, today) <= READY_UNTIL_DAYS) {
        actions.push({
          id: `${SECRET_RULE_IDS.ready}:${trial.id}`,
          type: 'autre',
          label: `${tip.title} — c'est prêt`,
          shortLabel: 'Ta préparation est prête',
          ...plantFields(plant),
          dueDate: readyDay,
          done: false,
          priority: 'medium',
          kind: 'dated',
          ruleId: SECRET_RULE_IDS.ready,
          why: `Lancée il y a ${daysBetween(trialDay, today)} jours : c'est le moment de t'en servir.`,
          howTo: tip.recipe,
          secret: toSecret(tip, 'ready', trial.id),
        })
      }
    }

    if (!usedDay || trial.tipVerdict) continue
    const feedbackDay = addDaysIso(usedDay, FEEDBACK_AFTER_DAYS)
    const answered = after(SECRET_RULE_IDS.feedback)
    if (!answered && feedbackDay <= today && daysBetween(feedbackDay, today) <= FEEDBACK_UNTIL_DAYS) {
      actions.push({
        id: `${SECRET_RULE_IDS.feedback}:${trial.id}`,
        type: 'autre',
        label: `${tip.title} — ça a marché ?`,
        shortLabel: 'Ça a marché ?',
        ...plantFields(plant),
        dueDate: feedbackDay,
        done: false,
        priority: 'low',
        kind: 'dated',
        ruleId: SECRET_RULE_IDS.feedback,
        why: `Tu as essayé « ${tip.title} » il y a ${daysBetween(usedDay, today)} jours. Qu'en dis-tu ?`,
        secret: toSecret(tip, 'feedback', trial.id),
      })
    }
  }

  return actions
}

// ─── Gestes ────────────────────────────────────────────────────────────────

/**
 * Un secret sur lequel l'utilisateur peut agir : publié, ou déjà entre ses
 * mains (dévoilé, refusé, essayé). Un brouillon deviné par son slug répond
 * comme un secret inconnu.
 */
async function assertTip(userId: string, slug: string): Promise<TipRecord> {
  const published = await findPublishedTip(slug)
  if (published) return published

  const [known, tried] = await Promise.all([
    prisma.userTip.findUnique({ where: { userId_slug: { userId, slug } }, select: { id: true } }),
    prisma.careLog.findFirst({ where: { plantInstance: { userId }, tipSlug: slug }, select: { id: true } }),
  ])
  const tip = known || tried ? await findTip(slug) : null
  if (!tip) throw new ServiceError('NOT_FOUND', 'Secret introuvable')
  return tip
}

/**
 * Le secret d'un geste coché sans `tipSlug` — par une version de l'app qui
 * ignore les secrets. Sans lui, l'essai n'aurait ni suites, ni délai avant
 * d'être reproposé, ni place au grimoire.
 */
export async function inferTipSlug(
  userId: string,
  params: { gardenId: string; plantId: string; ruleId: string; today: string },
): Promise<string | undefined> {
  if (params.ruleId === SECRET_RULE_IDS.discover) {
    const pick = await prisma.gardenTipPick.findUnique({
      where: { gardenId_week: { gardenId: params.gardenId, week: isoWeekKey(params.today) } },
      select: { slug: true, plantInstanceId: true, garden: { select: { userId: true } } },
    })
    return pick && pick.plantInstanceId === params.plantId && pick.garden.userId === userId ? pick.slug : undefined
  }
  if (params.ruleId === SECRET_RULE_IDS.ready || params.ruleId === SECRET_RULE_IDS.feedback) {
    const trial = await prisma.careLog.findFirst({
      where: {
        plantInstanceId: params.plantId,
        plantInstance: { userId },
        ruleId: SECRET_RULE_IDS.discover,
        tipSlug: { not: null },
      },
      orderBy: { occurredAt: 'desc' },
      select: { tipSlug: true },
    })
    return trial?.tipSlug ?? undefined
  }
  return undefined
}

/** Le secret a été dévoilé : il entre au grimoire. Idempotent. */
export async function revealSecret(userId: string, slug: string): Promise<void> {
  const tip = await assertTip(userId, slug)
  const existing = await prisma.userTip.findUnique({ where: { userId_slug: { userId, slug } } })
  if (existing?.revealedAt) return

  await prisma.userTip.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug, revealedAt: new Date() },
    update: { revealedAt: new Date() },
  })
  trackServer(userId, 'tip_revealed', { slug, evidence: tip.evidence })
}

/**
 * « Je tente » : le secret s'ajoute au calendrier en tâche à faire, pour la
 * plante de la carte, datée du jour de l'utilisateur. Rien n'est inscrit au
 * journal ici — l'essai le sera quand la tâche sera cochée.
 *
 * @throws ServiceError('NOT_FOUND') si le secret, le jardin ou la plante ne
 *   sont pas à l'utilisateur.
 */
export async function trySecret(
  userId: string,
  slug: string,
  input: TrySecretInput,
  now: Date = new Date(),
): Promise<GardenAction> {
  const tip = await assertTip(userId, slug)
  const [plant, user] = await Promise.all([
    prisma.plantInstance.findFirst({
      where: { id: input.plantId, userId, garden: { id: input.gardenId, userId } },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ])
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')

  // Le tenter vaut l'avoir dévoilé, même si l'ouverture n'a pas été notée.
  await prisma.userTip.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug, revealedAt: now },
    update: {},
  })

  return planSecretTask(userId, {
    plantInstanceId: plant.id,
    tipSlug: slug,
    title: tip.title,
    recipe: tip.recipe,
    dueDate: zonedDayIso(now, safeTimeZone(user?.timezone ?? 'Europe/Paris')),
  })
}

/** « Pas pour moi » : le secret ne sera plus proposé. Idempotent. */
export async function dismissSecret(userId: string, slug: string): Promise<void> {
  const tip = await assertTip(userId, slug)
  await prisma.userTip.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  })
  trackServer(userId, 'tip_dismissed', { slug, evidence: tip.evidence })
}

/** Annule un « Pas pour moi », depuis le grimoire. */
export async function restoreSecret(userId: string, slug: string): Promise<void> {
  await prisma.userTip.updateMany({ where: { userId, slug }, data: { dismissedAt: null } })
}

/**
 * « Ça a marché ? » — le verdict est posé sur le geste d'essai. Refait, il
 * remplace le précédent : on a le droit de changer d'avis.
 */
export async function recordSecretFeedback(userId: string, input: SecretFeedbackInput): Promise<void> {
  const trial = await prisma.careLog.findFirst({
    where: {
      id: input.careLogId,
      plantInstance: { userId },
      ruleId: SECRET_RULE_IDS.discover,
      tipSlug: { not: null },
    },
    select: { id: true, tipSlug: true },
  })
  if (!trial?.tipSlug) throw new ServiceError('NOT_FOUND', 'Essai introuvable')

  await prisma.careLog.update({
    where: { id: trial.id },
    data: { tipVerdict: input.verdict, tipVerdictAt: new Date() },
  })

  const tip = await findTip(trial.tipSlug)
  if (tip) trackServer(userId, 'tip_feedback', { slug: tip.slug, evidence: tip.evidence, verdict: input.verdict })
}

// ─── Grimoire ──────────────────────────────────────────────────────────────

/**
 * La collection de l'utilisateur. Un secret non découvert ne montre que son
 * titre, son accroche et son badge : la recette se mérite.
 *
 * Le secret lunaire n'y figure que si l'option est activée — sans quoi il
 * resterait éternellement verrouillé, sans moyen de le débloquer.
 *
 * Un secret dépublié depuis reste dans la collection de qui l'a découvert :
 * on ne reprend pas ce qu'on a donné. Il cesse seulement d'être tiré.
 */
export async function getGrimoire(userId: string): Promise<Grimoire> {
  const [published, user, userTips, trials] = await Promise.all([
    listPublishedTips(),
    prisma.user.findUnique({ where: { id: userId }, select: { lunarCalendar: true } }),
    prisma.userTip.findMany({ where: { userId } }),
    prisma.careLog.findMany({
      where: { plantInstance: { userId }, ruleId: SECRET_RULE_IDS.discover, tipSlug: { not: null } },
      select: { tipSlug: true, occurredAt: true, tipVerdict: true },
      orderBy: { occurredAt: 'desc' },
    }),
  ])

  const discoveredSlugs = new Set([
    ...userTips.filter((tip) => tip.revealedAt).map((tip) => tip.slug),
    ...trials.flatMap((trial) => (trial.tipSlug ? [trial.tipSlug] : [])),
  ])
  const missing = [...discoveredSlugs].filter((slug) => !published.some((tip) => tip.slug === slug))
  const retired = missing.length
    ? (await prisma.gardenTip.findMany({ where: { slug: { in: missing } } })).flatMap((row) => toRecord(row) ?? [])
    : []
  const tips = [...published, ...retired]

  const byUserTip = new Map(userTips.map((tip) => [tip.slug, tip]))
  const trialsBySlug = new Map<string, typeof trials>()
  for (const trial of trials) {
    if (!trial.tipSlug) continue
    const list = trialsBySlug.get(trial.tipSlug) ?? []
    list.push(trial)
    trialsBySlug.set(trial.tipSlug, list)
  }

  const entries: GrimoireEntry[] = tips
    .filter((tip) => !tip.conditions.lunarOnly || user?.lunarCalendar)
    .map((tip) => {
      const state = byUserTip.get(tip.slug)
      const tipTrials = trialsBySlug.get(tip.slug) ?? []
      const discovered = !!state?.revealedAt || tipTrials.length > 0
      const verdict = tipTrials.find((trial) => trial.tipVerdict)?.tipVerdict as SecretVerdict | undefined
      return {
        slug: tip.slug,
        title: tip.title,
        teaser: tip.teaser,
        evidence: tip.evidence,
        discovered,
        triedAt: tipTrials[0]?.occurredAt.toISOString() ?? null,
        trials: tipTrials.length,
        verdict: verdict ?? null,
        dismissed: !!state?.dismissedAt,
        recipe: discovered ? tip.recipe : null,
        story: discovered ? tip.story : null,
        ingredients: discovered ? tip.ingredients : [],
        cautions: discovered ? tip.cautions : null,
        planche: discovered ? tip.planche : null,
      }
    })
    .sort((a, b) => Number(b.discovered) - Number(a.discovered) || a.title.localeCompare(b.title, 'fr'))

  return { discovered: entries.filter((entry) => entry.discovered).length, total: entries.length, entries }
}

/** Le `trackServer` de « Je tente », appelé par `advice.service.markActionDone`. */
export async function trackSecretTried(userId: string, slug: string, stage: SecretStage): Promise<void> {
  const tip = await findTip(slug)
  if (tip) trackServer(userId, 'tip_tried', { slug, evidence: tip.evidence, stage })
}
