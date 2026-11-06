/**
 * Ce que débloquent les cernes de la sève (phase 6 du plan
 * `~/Growi/Documentation/spec/17-plan-seve.md`).
 *
 * Deux récompenses en v1 (décisions du 06/11/2026) : un **Secret en
 * avant-première** et un **thème d'Accueil**, réparties par `sapRingReward`.
 *
 * Elles sont **remises à la lecture** du résumé (`getSapOverview`), pas au
 * moment du gain : le serveur crédite des dizaines de gestes par jour, la sève
 * se relit après chacun d'eux, et c'est à cette lecture que l'écran annonce
 * le cerne. Remettre ici laisse `awardSap` tel qu'il est — trois requêtes, qui
 * ne lèvent jamais — et rattrape d'elle-même une remise qui aurait échoué.
 *
 * Ce module vit à part de `sap.service` : il a besoin de `secrets.service`,
 * qui importe déjà `sap.service` pour créditer les retours sur un Secret.
 */

import {
  SAP_HOME_THEME_LABELS,
  sapHomeThemeSchema,
  sapRingReward,
  type SapHomeTheme,
  type SapRewardKind,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import { getSapSummary, type SapSummaryRecord } from '@/lib/services/sap.service'
import { revealRewardSecret, secretTitles } from '@/lib/services/secrets.service'

/** Au plus autant de cernes remis d'un coup — une borne, jamais atteinte en pratique. */
const MAX_REWARDS_PER_READ = 20

export interface SapRewardRecord {
  ring: number
  kind: SapRewardKind
  value: string | null
  title: string | null
  createdAt: Date
}

export interface SapOverviewRecord extends SapSummaryRecord {
  rewards: SapRewardRecord[]
  homeTheme: SapHomeTheme | null
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/** Une valeur de base qui ne serait plus un thème connu vaut l'Accueil classique. */
function parseTheme(value: string | null | undefined): SapHomeTheme | null {
  const parsed = sapHomeThemeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Remet ce que les cernes formés n'ont pas encore donné. Ne lève jamais : une
 * remise ratée sera refaite à la lecture suivante.
 *
 * La ligne est écrite **avant** le secret : deux lectures simultanées se
 * disputent l'unicité `(userId, ring)`, et seule la gagnante dévoile un
 * secret — sinon le compte en recevrait deux pour un cerne.
 */
export async function ensureRingRewards(userId: string, ringCount: number): Promise<void> {
  if (ringCount < 1) return
  try {
    const existing = await prisma.sapReward.findMany({ where: { userId }, select: { ring: true } })
    const have = new Set(existing.map((row) => row.ring))
    const missing = Array.from({ length: ringCount }, (_, index) => index + 1)
      .filter((ring) => !have.has(ring))
      .slice(0, MAX_REWARDS_PER_READ)

    for (const ring of missing) {
      const reward = sapRingReward(ring)
      try {
        const row = await prisma.sapReward.create({
          data: { userId, ring, kind: reward.kind, value: reward.kind === 'theme' ? reward.theme : null },
        })
        if (reward.kind === 'secret') {
          const slug = await revealRewardSecret(userId, `${userId}:cerne:${ring}`)
          if (slug) await prisma.sapReward.update({ where: { id: row.id }, data: { value: slug } })
        }
        trackServer(userId, 'sap_reward_unlocked', { ring, kind: reward.kind })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
      }
    }
  } catch (error) {
    console.error('[sève] récompenses non remises :', error)
  }
}

/** Les récompenses d'un compte, nommées, du premier cerne au dernier. */
async function listRewards(userId: string): Promise<SapRewardRecord[]> {
  const rows = await prisma.sapReward.findMany({ where: { userId }, orderBy: { ring: 'asc' } })
  const slugs = rows.flatMap((row) => (row.kind === 'secret' && row.value ? [row.value] : []))
  const titles = slugs.length ? await secretTitles(slugs) : new Map<string, string>()

  return rows.map((row) => {
    const kind: SapRewardKind = row.kind === 'theme' ? 'theme' : 'secret'
    const theme = kind === 'theme' ? parseTheme(row.value) : null
    return {
      ring: row.ring,
      kind,
      value: row.value,
      title: theme ? SAP_HOME_THEME_LABELS[theme] : row.value ? (titles.get(row.value) ?? null) : null,
      createdAt: row.createdAt,
    }
  })
}

/**
 * Le résumé de la sève, récompenses comprises — ce que lisent l'Accueil et
 * « Ta sève », sur le web comme sur le mobile.
 */
export async function getSapOverview(userId: string, now: Date = new Date()): Promise<SapOverviewRecord> {
  const summary = await getSapSummary(userId, now)
  await ensureRingRewards(userId, summary.rings.count)
  // Les récompenses sont un complément : illisibles (migration
  // `20261106140000_sap_rewards` pas encore appliquée, base qui bronche), la
  // sève s'affiche sans elles plutôt que pas du tout.
  const [rewards, homeTheme] = await Promise.all([
    listRewards(userId).catch((error) => {
      console.error('[sève] récompenses illisibles :', error)
      return []
    }),
    getHomeTheme(userId),
  ])
  return { ...summary, rewards, homeTheme }
}

/** Le thème d'Accueil choisi. Ne lève jamais : faute de mieux, l'Accueil classique. */
export async function getHomeTheme(userId: string): Promise<SapHomeTheme | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { homeTheme: true } })
    return parseTheme(user?.homeTheme)
  } catch (error) {
    console.error('[sève] thème illisible :', error)
    return null
  }
}

/**
 * Choisit le thème d'Accueil, ou revient au classique avec `null`.
 *
 * @throws ServiceError('FORBIDDEN') pour un thème que les cernes du compte
 *   n'ont pas encore débloqué.
 */
export async function setHomeTheme(userId: string, theme: SapHomeTheme | null): Promise<SapHomeTheme | null> {
  if (theme) {
    const unlocked = await prisma.sapReward.findFirst({
      where: { userId, kind: 'theme', value: theme },
      select: { id: true },
    })
    if (!unlocked) {
      throw new ServiceError('FORBIDDEN', `Le thème « ${SAP_HOME_THEME_LABELS[theme]} » se débloque avec un prochain cerne.`)
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { homeTheme: theme } })
  trackServer(userId, 'home_theme_changed', { theme: theme ?? 'classique' })
  return theme
}
