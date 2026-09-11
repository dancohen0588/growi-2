/**
 * Quelles fiches d'encyclopédie sont prérendues au build.
 *
 * Les 535 fiches du catalogue étaient toutes prérendues, à chaque build : dix-
 * neuf des vingt-deux minutes de build Vercel. Or l'ISR est déjà en place
 * (`revalidate = 86400`, `dynamicParams = true`) — une fiche non prérendue est
 * générée à la première visite, mise en cache, et servie ensuite comme les
 * autres. Le prérendu n'achète donc qu'une chose : que la **première** visite
 * ne paie pas la génération. Cela vaut pour les fiches qu'on sait consultées,
 * pas pour les 500 autres.
 *
 * D'où la règle :
 *
 * - **production** : les 50 fiches les plus pertinentes ;
 * - **partout ailleurs** (preview, local) : aucune. C'est le cas qui compte
 *   pendant la Friends & Family — un correctif doit être testable en quelques
 *   minutes, pas en vingt.
 *
 * Ce module ne dépend pas de Next : c'est ce qui le rend testable.
 */

import { prisma } from '@/lib/prisma'

/**
 * Combien de fiches on prérend en production.
 *
 * Cinquante, parce que c'est ce qui tient dans le budget de build sans rien
 * changer d'autre. Le nombre n'a rien de sacré : la 51ᵉ fiche n'est pas plus
 * lente pour l'utilisateur, elle est seulement générée à sa première visite.
 */
export const PRERENDER_LIMIT = 50

type Env = Record<string, string | undefined>

/**
 * Prérend-on quoi que ce soit ?
 *
 * Seule la production le fait. Une preview sert à relire un correctif : y
 * prérendre cinquante fiches coûterait des minutes pour des pages que
 * personne n'ouvrira.
 */
export function shouldPrerender(env: Env = process.env): boolean {
  return env.VERCEL_ENV === 'production'
}

/**
 * Les slugs à prérendre, dans l'ordre de pertinence.
 *
 * Le critère est le **nombre de plantes que nos utilisateurs possèdent
 * réellement** dans chaque espèce (`plantInstances._count`), puis le nom par
 * ordre alphabétique. Aucun champ n'est ajouté au schéma pour cela : la
 * relation existe déjà, et un compteur de popularité maison serait une donnée
 * de plus à tenir à jour.
 *
 * Le second critère n'est pas cosmétique : tant que la base compte peu de
 * plantes — c'est le cas au début de la Friends & Family — la plupart des
 * espèces sont à égalité à zéro, et c'est l'ordre alphabétique qui tranche.
 * Il est stable, donc le build l'est aussi ; et le jour où les comptes
 * montent, la sélection suit l'usage sans qu'on ait à y toucher.
 */
export async function prerenderedPlantSlugs(env: Env = process.env): Promise<{ slug: string }[]> {
  if (!shouldPrerender(env)) return []

  const plants = await prisma.plantCatalog.findMany({
    where: { slug: { not: null } },
    orderBy: [{ plantInstances: { _count: 'desc' } }, { commonName: 'asc' }],
    take: PRERENDER_LIMIT,
    select: { slug: true },
  })

  return plants
    .filter((plant): plant is { slug: string } => Boolean(plant.slug))
    .map((plant) => ({ slug: plant.slug }))
}
