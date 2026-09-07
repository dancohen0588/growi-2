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
        // `/u/` et `/p/` sont les deux faces publiques de la communauté : un
        // profil et une publication se partagent par lien, et le `noindex`
        // d'un contenu masqué est posé page par page (`generateMetadata`),
        // là où l'on sait s'il est encore visible.
        allow: ['/', '/encyclopedie/', '/u/', '/p/', '/a/'],
        disallow: ['/dashboard/', '/admin', '/api/', '/login', '/register'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
