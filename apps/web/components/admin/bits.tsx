import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Petites pièces d'affichage communes aux écrans de l'admin : en-têtes,
 * pastilles d'état, dates. Elles tiennent ensemble parce qu'elles répondent
 * toutes à la même question — dire un fait le plus brièvement possible.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-poppins text-2xl font-semibold text-forest">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-forest/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const PILL_TONES = {
  neutral: 'bg-forest/5 text-forest/70',
  positive: 'bg-lime/25 text-forest',
  warning: 'bg-sun/30 text-forest',
  danger: 'bg-red-100 text-red-800',
} as const

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof PILL_TONES
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/**
 * Une date, avec sa valeur exacte au survol.
 *
 * `suppressHydrationWarning` : le formatage dépend du fuseau, celui du serveur
 * n'est pas celui du navigateur. Sans lui, React signale une divergence à
 * chaque ligne de tableau.
 */
export function DateCell({
  value,
  withTime = false,
  fallback = '—',
}: {
  value: Date | null | undefined
  withTime?: boolean
  fallback?: string
}) {
  if (!value) return <span className="text-forest/30">{fallback}</span>

  const formatter = withTime ? dateTimeFormatter : dateFormatter
  return (
    <time dateTime={value.toISOString()} title={value.toISOString()} suppressHydrationWarning>
      {formatter.format(value)}
    </time>
  )
}

/** Un compte est « actif » tant qu'aucune date de désactivation n'est posée. */
export function AccountStatePill({ disabledAt }: { disabledAt: Date | null }) {
  return disabledAt ? (
    <Pill tone="danger">Désactivé</Pill>
  ) : (
    <Pill tone="positive">Actif</Pill>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-poppins text-base font-medium text-forest">{title}</p>
      {hint && <p className="text-sm text-forest/60">{hint}</p>}
    </div>
  )
}
