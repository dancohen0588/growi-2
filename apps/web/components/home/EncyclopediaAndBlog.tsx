import Link from 'next/link'

import { listPosts } from '@/lib/blog/content'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'

/**
 * L'encyclopédie et le blog sont les deux contenus les plus riches du site, et
 * ils n'apparaissaient nulle part sur la home. Section serveur : le compteur
 * est lu en base — écrit en dur, il aurait déjà menti (le catalogue grossit).
 */
export async function EncyclopediaAndBlog() {
  const [plantCount, { posts }] = await Promise.all([
    prisma.plantCatalog.count(),
    Promise.resolve(listPosts({ limit: 3 })),
  ])

  return (
    <section className="bg-white py-16 md:py-20" aria-label="Encyclopédie et conseils">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">

        <div className="flex flex-col gap-3 rounded-3xl bg-sand p-8 shadow-card">
          <p className="font-poppins text-[2.75rem] font-bold leading-none tracking-tight text-forest">
            {plantCount}
          </p>
          <h3 className="font-poppins text-2xl font-bold text-forest">
            plantes dans l&apos;encyclopédie
          </h3>
          <p className="font-raleway leading-relaxed text-forest/70">
            Arrosage, exposition, toxicité, gestes de saison : tout ce que Growi
            sait sur chaque plante, en libre accès, sans compte.
          </p>
          <Button variant="outline" size="sm" className="mt-auto self-start" asChild>
            <Link href="/encyclopedie">Parcourir l&apos;encyclopédie</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl bg-sand p-8 shadow-card">
          <h3 className="font-poppins text-2xl font-bold text-forest">
            Conseils de saison
          </h3>
          <p className="font-raleway leading-relaxed text-forest/70">
            Ce qu&apos;il y a à faire au jardin ce mois-ci, par l&apos;équipe Growi.
          </p>
          <ul className="mt-1 flex flex-col gap-2">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-raleway text-forest hover:underline underline-offset-2"
                >
                  {post.title}{' '}
                  <span className="font-raleway text-sm text-forest/50">
                    · {post.readingTime} min
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-auto self-start" asChild>
            <Link href="/blog">Lire le blog</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
