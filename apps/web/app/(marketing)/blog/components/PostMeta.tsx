import { CalendarDays, Clock, PenLine } from 'lucide-react'

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** `2026-08-19T00:00:00.000Z` → « 19 août 2026 ». */
export function formatPublishedAt(iso: string): string {
  return DATE_FORMAT.format(new Date(iso))
}

/** Date, temps de lecture et — au besoin — auteur, sur une ligne. */
export function PostMeta({
  publishedAt,
  readingTime,
  author,
  className = '',
}: {
  publishedAt: string
  readingTime: number
  author?: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-raleway text-sm text-forest/60 ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={14} aria-hidden />
        <time dateTime={publishedAt}>{formatPublishedAt(publishedAt)}</time>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={14} aria-hidden />
        {readingTime} min de lecture
      </span>
      {author && (
        <span className="inline-flex items-center gap-1.5">
          <PenLine size={14} aria-hidden />
          {author}
        </span>
      )}
    </div>
  )
}
