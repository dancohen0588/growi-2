import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { BlogPagination } from '@growi/shared'

import { cn } from '@/lib/utils'

/** Pagination en liens `?page=` — indexable et utilisable sans JavaScript. */
export function Pagination({
  pagination,
  hrefFor,
}: {
  pagination: BlogPagination
  hrefFor: (page: number) => string
}) {
  const { page, pages } = pagination
  if (pages <= 1) return null

  return (
    <nav aria-label="Pagination des articles" className="flex items-center justify-center gap-2">
      <Arrow
        href={hrefFor(page - 1)}
        disabled={page === 1}
        label="Page précédente"
        icon={<ChevronLeft size={18} aria-hidden />}
      />

      <ol className="flex items-center gap-1">
        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <li key={n}>
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? 'page' : undefined}
              aria-label={`Page ${n}`}
              className={cn(
                'flex h-11 min-w-[44px] items-center justify-center rounded-lg px-3 font-poppins text-sm font-semibold transition-colors',
                n === page
                  ? 'bg-forest text-sand'
                  : 'bg-white text-forest/80 shadow-card hover:bg-lime/25 hover:text-forest',
              )}
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>

      <Arrow
        href={hrefFor(page + 1)}
        disabled={page === pages}
        label="Page suivante"
        icon={<ChevronRight size={18} aria-hidden />}
      />
    </nav>
  )
}

function Arrow({
  href,
  disabled,
  label,
  icon,
}: {
  href: string
  disabled: boolean
  label: string
  icon: React.ReactNode
}) {
  const className =
    'flex h-11 w-11 items-center justify-center rounded-lg font-semibold transition-colors'

  if (disabled) {
    return (
      <span aria-hidden className={cn(className, 'cursor-not-allowed bg-white/50 text-forest/25')}>
        {icon}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(className, 'bg-white text-forest shadow-card hover:bg-lime/25')}
    >
      {icon}
    </Link>
  )
}
