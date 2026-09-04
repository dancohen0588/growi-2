import type { MetadataRoute } from 'next'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.NEXTAUTH_URL
  ?? 'https://growi-garden.fr'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/encyclopedie/'],
        disallow: ['/dashboard/', '/admin', '/api/', '/login', '/register'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
