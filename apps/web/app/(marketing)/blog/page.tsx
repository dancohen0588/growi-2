import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_TAG_LABELS, blogTagSchema, type BlogTag } from '@growi/shared'

import { listPosts, listUsedTags } from '@/lib/blog/content'
import { PostCard } from './components/PostCard'
import { Pagination } from './components/Pagination'
import { TagPills } from './components/TagPills'

/** Articles par page de la grille. */
const PER_PAGE = 9

export const metadata: Metadata = {
  // Le layout racine applique le gabarit « %s | Growi » : ne pas le répéter ici.
  title: 'Blog — Conseils & actus jardin',
  description:
    'Conseils de jardinage concrets, guides saisonniers, diagnostics de maladies et actualités Growi. Des articles calés sur la saison et sur ta météo.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog Growi — Conseils & actus jardin',
    description:
      'Conseils de jardinage concrets, guides saisonniers et actualités Growi.',
    url: '/blog',
    type: 'website',
  },
}

interface BlogPageProps {
  searchParams: { tag?: string; page?: string }
}

export default function BlogPage({ searchParams }: BlogPageProps) {
  // Un tag ou une page invalides ne cassent rien : on retombe sur la liste
  // complète plutôt que sur une 404, un lien partagé restant souvent approximatif.
  const tag = blogTagSchema.safeParse(searchParams.tag).data
  const page = Number.parseInt(searchParams.page ?? '1', 10)

  const { posts, pagination } = listPosts({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: PER_PAGE,
    tag,
  })

  const tags = listUsedTags()
  const hrefFor = (n: number) =>
    `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`
      .replace(/\?$/, '')

  return (
    <div className="bg-sand">
      <Hero tag={tag} tags={tags} />

      <section
        aria-label="Articles du blog"
        className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 md:pb-28 lg:px-8"
      >
        {posts.length === 0 ? (
          <EmptyState tag={tag} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  featured={index === 0 && pagination.page === 1}
                  priority={index === 0}
                />
              ))}
            </div>

            <div className="mt-12">
              <Pagination pagination={pagination} hrefFor={hrefFor} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Hero({ tag, tags }: { tag?: BlogTag; tags: BlogTag[] }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-gradient-to-bl from-lime/25 to-forest/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-gradient-to-tr from-sun/20 to-lime/10 blur-2xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-12 pt-16 text-center sm:px-6 md:pb-16 md:pt-24">
        <span className="inline-flex items-center rounded-full bg-lime/25 px-4 py-1.5 font-raleway text-sm font-semibold text-forest">
          🌱 Conseils &amp; actus jardin
        </span>

        <h1 className="font-poppins text-4xl font-bold leading-tight text-forest md:text-5xl">
          {tag ? BLOG_TAG_LABELS[tag] : 'Le blog Growi'}
        </h1>

        <p className="font-raleway text-lg leading-relaxed text-forest/80">
          Des conseils concrets, calés sur la saison et sur ce qui pousse vraiment chez toi.
          Pas de généralités : ce qu&apos;il y a à faire, quand, et pourquoi.
        </p>

        <TagPills tags={tags} active={tag} />
      </div>
    </section>
  )
}

function EmptyState({ tag }: { tag?: BlogTag }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white px-6 py-16 text-center shadow-card">
      <span className="text-5xl" aria-hidden>
        🌾
      </span>
      <h2 className="font-poppins text-xl font-bold text-forest">
        {tag ? 'Rien sur ce thème pour l’instant' : 'Les premiers articles arrivent'}
      </h2>
      <p className="font-raleway text-forest/80">
        {tag
          ? 'On y travaille. En attendant, jette un œil aux autres thèmes.'
          : 'Reviens bientôt : on prépare la première série de conseils de saison.'}
      </p>
      {tag && (
        <Link
          href="/blog"
          className="mt-2 inline-flex min-h-[44px] items-center rounded-lg bg-forest px-6 font-poppins text-sm font-semibold text-sand shadow-cta transition-colors hover:bg-forest/90"
        >
          Voir tous les articles
        </Link>
      )}
    </div>
  )
}
