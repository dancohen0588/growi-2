import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { MDXRemote } from 'next-mdx-remote/rsc'

import { getPost, listRelatedPosts, listSlugs } from '@/lib/blog/content'
import { webMdxComponents } from '@/lib/blog/mdx-components'
import { mdxOptions } from '@/lib/blog/mdx-options'
import { SITE_URL } from '@/lib/site-url'
import { CTABottom } from '../../fonctionnalites/components/CTABottom'
import { PostCard } from '../components/PostCard'
import { PostMeta } from '../components/PostMeta'
import { TagBadge } from '../components/TagPills'

// Les articles sont des fichiers du dépôt : tout est connu au build, rien ne
// change entre deux déploiements. Un slug inconnu doit donc faire une 404,
// pas déclencher un rendu à la demande.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return listSlugs().map(slug => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const entry = getPost(params.slug)
  if (!entry) return { title: 'Article introuvable' }

  const { summary } = entry
  const url = `/blog/${summary.slug}`

  return {
    title: summary.title,
    description: summary.excerpt,
    authors: [{ name: summary.author }],
    alternates: { canonical: url },
    openGraph: {
      title: summary.title,
      description: summary.excerpt,
      url,
      type: 'article',
      publishedTime: summary.publishedAt,
      modifiedTime: entry.updatedAt,
      authors: [summary.author],
      tags: summary.tags,
      images: summary.coverImage
        ? [{ url: summary.coverImage, alt: summary.coverImageAlt ?? summary.title }]
        : undefined,
    },
    twitter: {
      card: summary.coverImage ? 'summary_large_image' : 'summary',
      title: summary.title,
      description: summary.excerpt,
    },
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const entry = getPost(params.slug)
  if (!entry) notFound()

  const { summary, source, updatedAt } = entry
  const related = listRelatedPosts(summary.slug)
  const url = `${SITE_URL}/blog/${summary.slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: summary.title,
        description: summary.excerpt,
        image: summary.coverImage ? `${SITE_URL}${summary.coverImage}` : undefined,
        datePublished: summary.publishedAt,
        dateModified: updatedAt,
        author: { '@type': 'Person', name: summary.author },
        publisher: {
          '@type': 'Organization',
          name: 'Growi',
          url: SITE_URL,
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        keywords: summary.tags.join(', '),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
          { '@type': 'ListItem', position: 3, name: summary.title, item: url },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="bg-sand">
        <header className="mx-auto max-w-3xl px-4 pb-8 pt-10 sm:px-6 md:pt-16">
          <Breadcrumb title={summary.title} />

          <div className="mt-6 flex flex-wrap gap-2">
            {summary.tags.map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          <h1 className="mt-4 font-poppins text-3xl font-bold leading-tight text-forest md:text-[2.75rem]">
            {summary.title}
          </h1>

          <p className="mt-4 font-raleway text-lg leading-relaxed text-forest/80">
            {summary.excerpt}
          </p>

          <PostMeta
            publishedAt={summary.publishedAt}
            readingTime={summary.readingTime}
            author={summary.author}
            className="mt-6"
          />
        </header>

        {summary.coverImage && (
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl bg-lime/10 shadow-card">
              <Image
                src={summary.coverImage}
                alt={summary.coverImageAlt ?? ''}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="article-prose mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
          <MDXRemote
            source={source}
            components={webMdxComponents}
            options={{ mdxOptions }}
          />
        </div>

        {updatedAt !== summary.publishedAt && (
          <p className="mx-auto max-w-3xl px-4 pb-10 font-raleway text-sm italic text-forest/80 sm:px-6">
            Article mis à jour le{' '}
            <time dateTime={updatedAt}>
              {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(updatedAt))}
            </time>
            .
          </p>
        )}

        {related.length > 0 && (
          <section
            aria-labelledby="articles-lies"
            className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
          >
            <h2
              id="articles-lies"
              className="mb-6 font-poppins text-2xl font-bold text-forest"
            >
              À lire aussi
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {related.map(post => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}
      </article>

      <CTABottom />
    </>
  )
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="flex items-center gap-1 font-raleway text-xs text-forest/80">
        <li>
          <Link href="/" className="hover:text-forest">
            Accueil
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight size={12} />
        </li>
        <li>
          <Link href="/blog" className="hover:text-forest">
            Blog
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight size={12} />
        </li>
        <li className="truncate font-semibold text-forest/80">{title}</li>
      </ol>
    </nav>
  )
}
