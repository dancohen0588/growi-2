import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Composants autorisés dans les articles MDX.
 *
 * Deux jeux, volontairement jumeaux :
 * - `webMdxComponents` pour les pages Next (liens internes en `next/link`) ;
 * - `htmlMdxComponents` pour le HTML servi au mobile, qui ne sait pas exécuter
 *   de React — mêmes balises, sans rien de spécifique à Next.
 *
 * En V1, on s'en tient à `<Callout>`, `<YouTube>` et aux images Markdown.
 */

// ─── Composants utilisables dans les articles ──────────────────────────────

type CalloutTone = 'conseil' | 'attention'

const CALLOUT_STYLES: Record<CalloutTone, { wrapper: string; icon: string; label: string }> = {
  conseil: {
    wrapper: 'border-lime bg-lime/15',
    icon: '🌱',
    label: 'Conseil',
  },
  attention: {
    wrapper: 'border-sun bg-sun/15',
    icon: '⚠️',
    label: 'À surveiller',
  },
}

export function Callout({
  children,
  tone = 'conseil',
  title,
}: {
  children: ReactNode
  tone?: CalloutTone
  title?: string
}) {
  const style = CALLOUT_STYLES[tone] ?? CALLOUT_STYLES.conseil

  return (
    <aside className={`my-6 rounded-2xl border-l-4 p-5 ${style.wrapper}`}>
      <p className="font-poppins text-sm font-bold text-forest m-0 mb-2">
        <span aria-hidden>{style.icon}</span> {title ?? style.label}
      </p>
      <div className="font-raleway text-forest/80 [&>p:last-child]:mb-0">{children}</div>
    </aside>
  )
}

export function YouTube({ id, title }: { id: string; title?: string }) {
  return (
    <div className="my-6 aspect-video w-full overflow-hidden rounded-2xl bg-forest/5">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title ?? 'Vidéo YouTube'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="h-full w-full border-0"
      />
    </div>
  )
}

// ─── Balises Markdown surchargées ──────────────────────────────────────────

function isInternal(href: string): boolean {
  return href.startsWith('/') || href.startsWith('#')
}

function WebLink({ href, children, ...props }: React.ComponentProps<'a'>) {
  if (!href) return <a {...props}>{children}</a>

  if (isInternal(href)) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}

/**
 * Les illustrations d'article restent en `<img>` natif : `next/image` exige des
 * dimensions que le Markdown ne porte pas. Les couvertures, elles — celles qui
 * pèsent sur le LCP — passent bien par `next/image` dans les cartes et le hero.
 */
function ArticleImage({ alt, ...props }: React.ComponentProps<'img'>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} loading="lazy" decoding="async" {...props} />
  )
}

/** Jeu utilisé par les pages web. */
export const webMdxComponents = {
  Callout,
  YouTube,
  a: WebLink,
  img: ArticleImage,
}

/** Jeu utilisé pour produire le HTML pur consommé par le mobile. */
export const htmlMdxComponents = {
  Callout,
  YouTube,
  img: ArticleImage,
}
