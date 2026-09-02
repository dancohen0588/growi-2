import { createHash } from 'node:crypto'

import { prisma } from '@/lib/prisma'

/**
 * Plafonds de l'identification photo **anonyme** (page publique `/identifier`).
 *
 * Chaque appel coûte un appel Gemini. Un visiteur non connecté n'a rien à
 * révoquer et rien à perdre : sans plafond, une boucle suffit à faire grimper
 * la facture.
 *
 * Deux plafonds, parce qu'ils ne protègent pas de la même chose :
 *
 * - **par adresse** : il tient l'usage normal à distance de l'abus. Il est
 *   contournable — l'en-tête d'origine se falsifie, et une IP se change ;
 * - **global journalier** : c'est lui qui borne réellement la dépense. Il ne
 *   se contourne pas, au prix d'être partagé : une attaque le sature pour
 *   tout le monde. C'est le compromis assumé, une dépense non bornée serait
 *   pire.
 *
 * Les comptes connectés ne passent pas par ici : ils gardent leur quota.
 */
export const ANONYMOUS_DAILY_LIMIT_PER_IP = 5
export const ANONYMOUS_DAILY_LIMIT_GLOBAL = 200

/** Message unique : on ne dit pas au visiteur lequel des deux plafonds a cédé. */
export const QUOTA_REACHED_MESSAGE = 'Crée ton jardin pour continuer'

/**
 * Clés réservées. Elles ne peuvent entrer en collision avec une empreinte, qui
 * est toujours 64 caractères hexadécimaux.
 */
const GLOBAL_KEY = '@global'
const UNKNOWN_IP_KEY = '@unknown'

/**
 * L'adresse de l'appelant, telle que les proxys la rapportent.
 *
 * `x-vercel-forwarded-for` est posé par la plateforme et n'est pas falsifiable
 * par le client ; `x-forwarded-for` l'est, on n'en garde que la première
 * entrée et on ne s'y fie qu'à défaut. Sans adresse — développement local,
 * appel direct — tout le monde partage un même seau : mieux vaut un plafond
 * trop strict qu'aucun plafond.
 */
export function clientIpFrom(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel.split(',')[0]!.trim()

  const real = headers.get('x-real-ip')?.trim()
  if (real) return real

  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || UNKNOWN_IP_KEY
}

/**
 * Pseudonymise l'adresse. Ce n'est pas un anonymat : une IPv4 se retrouve par
 * force brute sur 2^32 empreintes. Cela évite qu'une fuite de la table livre
 * directement des adresses, et suffit pour un compteur.
 */
function hashIp(ip: string): string {
  if (ip === UNKNOWN_IP_KEY) return UNKNOWN_IP_KEY
  return createHash('sha256').update(ip).digest('hex')
}

/** Jour UTC. Changer de jour, c'est changer de ligne — pas de remise à zéro. */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export interface QuotaVerdict {
  allowed: boolean
  /** Ce qu'il reste sur le plafond par adresse, une fois cet appel décompté. */
  remaining: number
}

/**
 * Décompte une identification anonyme, et dit si elle est permise.
 *
 * L'incrément précède l'appel à Gemini, et non l'inverse : deux requêtes
 * simultanées sous un même plafond doivent en voir refuser une, ce qu'un
 * « lire puis écrire » ne garantit pas. La contrepartie est qu'un échec de
 * Gemini consomme quand même le crédit — un abus coûte, une panne aussi.
 */
export async function consumeAnonymousIdentifyQuota(
  headers: Headers,
  now = new Date(),
): Promise<QuotaVerdict> {
  const day = utcDay(now)
  const ipHash = hashIp(clientIpFrom(headers))

  const [perIp, global] = await Promise.all([
    bump(ipHash, day),
    bump(GLOBAL_KEY, day),
  ])

  // Les lignes de la veille n'ont plus d'usage, et l'empreinte d'une adresse
  // est une donnée personnelle : on ne la garde pas au-delà de sa fenêtre.
  void purgeOlderThan(day)

  return {
    allowed:
      perIp <= ANONYMOUS_DAILY_LIMIT_PER_IP && global <= ANONYMOUS_DAILY_LIMIT_GLOBAL,
    remaining: Math.max(0, ANONYMOUS_DAILY_LIMIT_PER_IP - perIp),
  }
}

/** Incrémente une ligne et rend son nouveau compte, en une seule écriture. */
async function bump(ipHash: string, day: string): Promise<number> {
  const row = await prisma.identifyQuota.upsert({
    where:  { ipHash_day: { ipHash, day } },
    create: { ipHash, day, count: 1 },
    update: { count: { increment: 1 } },
  })
  return row.count
}

/** Purge silencieuse : elle ne doit jamais faire échouer une identification. */
async function purgeOlderThan(day: string): Promise<void> {
  try {
    await prisma.identifyQuota.deleteMany({ where: { day: { lt: day } } })
  } catch {
    // Sans conséquence : les lignes seront purgées au prochain passage.
  }
}
