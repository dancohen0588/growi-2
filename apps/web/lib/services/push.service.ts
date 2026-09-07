/**
 * Service notifications — enregistrement des appareils et rappels du matin.
 *
 * Un jeton Expo identifie un appareil. Il change à la réinstallation, et la
 * même personne peut en avoir plusieurs : la table est donc unique sur le
 * jeton, pas sur l'utilisateur.
 */

import type { AlertConfig, RegisterPushTokenInput } from '@growi/shared'
import { DEFAULT_ALERT_CONFIG } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { sendPushMessages, type PushMessage } from '@/lib/push/expo-push'
import { getTodayPlanning } from '@/lib/services/planning.service'

// ─── Appareils ─────────────────────────────────────────────────────────────

/**
 * Enregistre l'appareil, ou le rattache à ce compte s'il appartenait à un
 * autre — cas d'un téléphone prêté, ou d'un changement de compte sur le même
 * appareil. Sans cela, l'ancien propriétaire recevrait les rappels du nouveau.
 */
export async function registerPushToken(
  userId: string,
  input: RegisterPushTokenInput,
): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token: input.token },
    create: { userId, token: input.token, platform: input.platform },
    update: { userId, platform: input.platform },
  })
}

/**
 * Oublie un appareil. Idempotent : se déconnecter ne doit jamais échouer
 * parce que le jeton avait déjà disparu.
 */
export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { token, userId } })
}

/** Supprime les jetons qu'Expo déclare morts. */
export async function forgetInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } })
}

// ─── Rappels du matin ──────────────────────────────────────────────────────

/** Minutes depuis minuit, pour comparer des heures « HH:MM ». */
function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/** Heure locale de l'utilisateur, en minutes depuis minuit. */
export function localMinutes(now: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)
    return minutesOfDay(formatted.replace('h', ':'))
  } catch {
    // Fuseau inconnu en base : on s'en remet à l'heure du serveur plutôt que
    // de priver l'utilisateur de ses rappels.
    return now.getHours() * 60 + now.getMinutes()
  }
}

/**
 * Le compte accepte-t-il le push ?
 *
 * `both` couvre le jour où l'email s'ajoutera : le push y est compris.
 */
export function channelAllowsPush(config: AlertConfig): boolean {
  return config.channel === 'push' || config.channel === 'both'
}

/** L'instant présent tombe-t-il dans les heures calmes du compte ? */
export function inQuietHours(config: AlertConfig, localMinute: number): boolean {
  if (!config.quietHoursEnabled) return false

  const start = minutesOfDay(config.quietHoursStart)
  const end = minutesOfDay(config.quietHoursEnd)

  // Une plage de nuit franchit minuit : 22:00 → 07:00.
  return start <= end
    ? localMinute >= start && localMinute < end
    : localMinute >= start || localMinute < end
}

/**
 * L'utilisateur veut-il recevoir un **rappel du matin** maintenant ?
 *
 * Trois conditions : le canal inclut le push, les heures calmes ne couvrent
 * pas l'instant présent, et il reste au moins un type de rappel activé. Cette
 * dernière ne vaut que pour les rappels du jardin — les notifications de la
 * communauté ont leurs propres interrupteurs, dans `alertConfig.community`.
 */
export function wantsPushNow(config: AlertConfig, localMinute: number): boolean {
  if (!channelAllowsPush(config)) return false
  if (inQuietHours(config, localMinute)) return false

  return (
    config.wateringReminder ||
    config.pruningReminder ||
    config.repottingReminder ||
    config.seedingAlerts ||
    config.harvestAlerts ||
    config.frostAlert ||
    config.heatAlert
  )
}

/**
 * Envoie un message aux appareils d'un compte, en respectant son canal et ses
 * heures calmes.
 *
 * L'envoyeur générique, par opposition aux **composeurs** — `composeReminder`
 * pour le jardin, `notification.service` pour la communauté. Les rappels
 * quotidiens ne passent pas par ici : ils composent des centaines de messages
 * qu'il vaut mieux envoyer en un seul lot.
 *
 * Ne lève jamais et ne s'attend pas : une notification manquée est un agrément
 * en moins, pas une raison de faire échouer le geste qui l'a déclenchée.
 */
export async function sendToUser(
  userId: string,
  message: Omit<PushMessage, 'to'>,
  options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const now = options.now ?? new Date()

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        alertConfig: true,
        disabledAt: true,
        pushTokens: { select: { token: true } },
      },
    })

    if (!user || user.disabledAt || user.pushTokens.length === 0) return

    const config: AlertConfig = {
      ...DEFAULT_ALERT_CONFIG,
      ...((user.alertConfig as AlertConfig | null) ?? {}),
    }

    if (!channelAllowsPush(config)) return
    if (inQuietHours(config, localMinutes(now, user.timezone))) return

    const outcome = await sendPushMessages(
      user.pushTokens.map(({ token }) => ({ ...message, to: token })),
      options.fetchImpl ?? fetch,
    )
    await forgetInvalidTokens(outcome.invalidTokens)
  } catch (error) {
    console.error('[push] envoi à', userId, 'impossible :', error)
  }
}

/** Titre et corps du rappel, à partir de ce qu'il y a à faire. */
export function composeReminder(
  taskCount: number,
  firstNames: string[],
  alertCount: number,
): { title: string; body: string } {
  const title =
    taskCount === 1 ? 'Un geste au jardin aujourd’hui 🌿' : `${taskCount} gestes au jardin 🌿`

  const listed = firstNames.slice(0, 3).join(', ')
  const rest = taskCount - Math.min(firstNames.length, 3)

  const body =
    rest > 0 ? `${listed} et ${rest} de plus.` : `${listed}.`

  return {
    title,
    body: alertCount > 0 ? `${body} ${alertCount} alerte météo en cours.` : body,
  }
}

export interface DailyRemindersResult {
  /** Comptes examinés — ceux qui ont au moins un appareil enregistré. */
  considered: number
  /** Comptes à qui un message a été composé. */
  notified: number
  sent: number
  failed: number
  invalidTokensRemoved: number
}

/**
 * Compose et envoie les rappels du jour.
 *
 * Parcourt les seuls comptes ayant un appareil enregistré : inutile de
 * calculer un planning pour quelqu'un qui ne peut pas être notifié.
 */
export async function sendDailyReminders(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<DailyRemindersResult> {
  const users = await prisma.user.findMany({
    where: { pushTokens: { some: {} } },
    select: {
      id: true,
      timezone: true,
      alertConfig: true,
      pushTokens: { select: { token: true } },
    },
  })

  const result: DailyRemindersResult = {
    considered: users.length,
    notified: 0,
    sent: 0,
    failed: 0,
    invalidTokensRemoved: 0,
  }

  const messages: PushMessage[] = []

  for (const user of users) {
    const config: AlertConfig = {
      ...DEFAULT_ALERT_CONFIG,
      ...((user.alertConfig as AlertConfig | null) ?? {}),
    }

    if (!wantsPushNow(config, localMinutes(now, user.timezone))) continue

    // Une erreur du moteur sur un compte ne doit pas priver les autres.
    let planning
    try {
      planning = await getTodayPlanning(user.id, now)
    } catch (error) {
      console.error('[push] planning indisponible pour', user.id, error)
      continue
    }

    const dueToday = planning.gardens
      .flatMap((garden) => garden.actions)
      .filter((action) => action.dueDate <= planning.date)

    // Rien à faire : pas de notification. Une alerte quotidienne vide serait
    // le meilleur moyen de faire couper les notifications.
    if (dueToday.length === 0) continue

    const alerts = planning.gardens.flatMap((garden) => garden.alerts).length
    const { title, body } = composeReminder(
      dueToday.length,
      // Le tiret sépare le geste de la plante : accolés, « Tailler les feuilles
      // abîmées Monstera » se lit comme une seule phrase et il faut s'y
      // reprendre à deux fois pour voir où finit l'action.
      dueToday.map((action) => {
        // Les noms sont saisis à la main : une espace finale y traîne vite, et
        // elle se verrait juste avant la virgule de la liste.
        const plant = action.plantName?.trim()
        return plant ? `${action.shortLabel} — ${plant}` : action.shortLabel
      }),
      alerts,
    )

    result.notified += 1
    for (const { token } of user.pushTokens) {
      messages.push({
        to: token,
        title,
        body,
        sound: 'default',
        badge: dueToday.length,
        data: { screen: 'calendrier' },
      })
    }
  }

  const outcome = await sendPushMessages(messages, fetchImpl)
  await forgetInvalidTokens(outcome.invalidTokens)

  result.sent = outcome.sent
  result.failed = outcome.failed
  result.invalidTokensRemoved = outcome.invalidTokens.length

  return result
}
