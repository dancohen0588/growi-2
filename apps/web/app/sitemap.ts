import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { listAllSummaries } from '@/lib/blog/content'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.NEXTAUTH_URL
  ?? 'https://growi.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/fonctionnalites`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/tarifs`,          changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/pro`,             changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/blog`,            changeFrequency: 'weekly',  priority: 0.7 },
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

  return [...staticRoutes, ...blogRoutes, ...plantRoutes]
}
