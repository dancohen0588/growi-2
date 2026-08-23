import Link from 'next/link'
import Image from 'next/image'
import type { BlogPostSummary } from '@growi/shared'

import { PostMeta } from './PostMeta'
import { TagBadge } from './TagPills'

/**
 * Carte d'article de la grille et du bloc « À lire aussi ».
 *
 * `featured` : la première carte de la première page, sur deux colonnes.
 */
export function PostCard({
  post,
  featured = false,
  priority = false,
}: {
  post: BlogPostSummary
  featured?: boolean
  priority?: boolean
}) {
  return (
    <article
      className={
        featured
          ? 'group h-full overflow-hidden rounded-3xl bg-white shadow-card transition-shadow hover:shadow-card-hover md:col-span-2 md:grid md:grid-cols-2'
          : 'group h-full overflow-hidden rounded-3xl bg-white shadow-card transition-shadow hover:shadow-card-hover'
      }
    >
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col md:contents">
        <Cover post={post} featured={featured} priority={priority} />

        <div className={featured ? 'flex flex-col gap-3 p-6 md:justify-center md:p-8' : 'flex flex-1 flex-col gap-3 p-6'}>
          {post.tags[0] && <TagBadge tag={post.tags[0]} className="self-start" />}

          <h2
            className={
              featured
                ? 'font-poppins text-2xl font-bold leading-tight text-forest md:text-3xl'
                : 'font-poppins text-lg font-bold leading-snug text-forest'
            }
          >
            {post.title}
          </h2>

          <p
            className={
              featured
                ? 'font-raleway leading-relaxed text-forest/80'
                : 'line-clamp-3 flex-1 font-raleway text-sm leading-relaxed text-forest/80'
            }
          >
            {post.excerpt}
          </p>

          <PostMeta
            publishedAt={post.publishedAt}
            readingTime={post.readingTime}
            author={featured ? post.author : undefined}
            className="mt-auto pt-1"
          />
        </div>
      </Link>
    </article>
  )
}

function Cover({
  post,
  featured,
  priority,
}: {
  post: BlogPostSummary
  featured: boolean
  priority: boolean
}) {
  const ratio = featured ? 'aspect-[16/10] md:aspect-auto md:h-full' : 'aspect-[16/9]'

  if (!post.coverImage) {
    // Pas de couverture : un dégradé maison plutôt qu'un trou dans la grille.
    return (
      <div
        aria-hidden
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-lime/40 to-forest/30 ${ratio}`}
      >
        <span className="text-5xl">🌱</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden bg-lime/10 ${ratio}`}>
      <Image
        src={post.coverImage}
        alt={post.coverImageAlt ?? ''}
        fill
        priority={priority}
        sizes={featured ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 100vw, 33vw'}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  )
}
