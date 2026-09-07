import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { listAllSummaries } from '@/lib/blog/content'
import { SITE_URL } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/fonctionnalites`, changeFrequency: 'monthly', priority: 0.8 },
    // Page de conversion, et requête SEO forte (« identifier une plante en photo »).
    { url: `${SITE_URL}/identifier`,      changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/blog`,            changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/a-propos`,        changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${SITE_URL}/contact`,         changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${SITE_URL}/encyclopedie`,    changeFrequency: 'daily',   priority: 0.9 },
  ]

  const plants = await prisma.plantCatalog.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
  })

  const plantRoutes: MetadataRoute.Sitemap = plants.map(p => ({
    url:             `${SITE_URL}/encyclopedie/${p.slug}`,
    lastModified:    p.updatedAt,
    changeFrequency: 'weekly',
    priority:        0.6,
  }))

  const blogRoutes: MetadataRoute.Sitemap = listAllSummaries().map(({ summary, updatedAt }) => ({
    url:             `${SITE_URL}/blog/${summary.slug}`,
    lastModified:    new Date(updatedAt),
    changeFrequency: 'monthly',
    priority:        0.7,
  }))

  /**
   * Les profils publics **actifs**, et eux seuls.
   *
   * Un profil désactivé, ou dont le compte l'est, répond 404 : le laisser dans
   * le sitemap enverrait les robots sur des pages mortes. Les publications ne
   * sont pas listées — leur volume grossira vite, elles se découvrent depuis
   * les profils, et elles restent partageables par lien.
   */
  const profiles = await prisma.user.findMany({
    where: { communityEnabled: true, disabledAt: null, handle: { not: null } },
    select: { handle: true, updatedAt: true },
  })

  const profileRoutes: MetadataRoute.Sitemap = profiles
    .filter((user) => !!user.handle)
    .map((user) => ({
      url:             `${SITE_URL}/u/${user.handle!}`,
      lastModified:    user.updatedAt,
      changeFrequency: 'weekly',
      priority:        0.4,
    }))

  return [...staticRoutes, ...blogRoutes, ...plantRoutes, ...profileRoutes]
}
