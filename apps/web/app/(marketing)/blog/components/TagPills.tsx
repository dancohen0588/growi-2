import Link from 'next/link'
import { BLOG_TAG_LABELS, type BlogTag } from '@growi/shared'

import { cn } from '@/lib/utils'

/**
 * Filtre par tag de la page liste.
 *
 * Ce sont de vrais liens (`/blog?tag=…`) et non des boutons : le filtre reste
 * partageable, indexable, et fonctionne sans JavaScript.
 */
export function TagPills({ tags, active }: { tags: BlogTag[]; active?: BlogTag }) {
  if (tags.length === 0) return null

  return (
    <nav aria-label="Filtrer par thème">
      <ul className="flex flex-wrap justify-center gap-2">
        <li>
          <TagPill href="/blog" isActive={!active}>
            Tout
          </TagPill>
        </li>
        {tags.map(tag => (
          <li key={tag}>
            <TagPill href={`/blog?tag=${tag}`} isActive={active === tag}>
              {BLOG_TAG_LABELS[tag]}
            </TagPill>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function TagPill({
  href,
  isActive,
  children,
}: {
  href: string
  isActive: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-[40px] items-center rounded-full px-4 font-raleway text-sm font-semibold transition-colors',
        isActive
          ? 'bg-forest text-sand'
          : 'bg-white text-forest/70 shadow-card hover:bg-lime/25 hover:text-forest',
      )}
    >
      {children}
    </Link>
  )
}

/** Étiquette non cliquable, pour les cartes et l'en-tête d'article. */
export function TagBadge({ tag, className }: { tag: BlogTag; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-lime/25 px-3 py-1 font-raleway text-xs font-semibold text-forest',
        className,
      )}
    >
      {BLOG_TAG_LABELS[tag]}
    </span>
  )
}
