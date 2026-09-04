import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Une tuile d'indicateur.
 *
 * La comparaison est **toujours nommée** (« vs semaine dernière ») : un
 * pourcentage seul ne dit pas à quoi il se compare, et se lit alors comme une
 * proportion plutôt que comme une variation.
 */
export function KpiCard({
  label,
  value,
  hint,
  previous,
  previousLabel = 'vs semaine dernière',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Valeur de la période précédente, pour la variation. */
  previous?: number
  previousLabel?: string
}) {
  const current = typeof value === 'number' ? value : null
  const delta = current !== null && previous !== undefined ? current - previous : null

  return (
    <div className="rounded-2xl border border-forest/10 bg-white p-5">
      <p className="font-raleway text-xs font-semibold uppercase tracking-wide text-forest/50">
        {label}
      </p>
      <p className="mt-2 font-poppins text-3xl font-semibold tabular-nums text-forest">
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>

      {delta !== null && <Delta delta={delta} previous={previous!} label={previousLabel} />}
      {hint && <p className="mt-2 text-sm text-forest/55">{hint}</p>}
    </div>
  )
}

function Delta({
  delta,
  previous,
  label,
}: {
  delta: number
  previous: number
  label: string
}) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight
  const tone =
    delta > 0 ? 'text-forest' : delta < 0 ? 'text-red-700' : 'text-forest/40'

  // Une variation en pourcentage depuis zéro n'a pas de sens : on montre alors
  // l'écart brut plutôt qu'un « +∞ % » qui n'apprend rien.
  const percent = previous > 0 ? Math.round((delta / previous) * 100) : null

  return (
    // `flex-wrap` : dans une tuile étroite, « +4 (+400 %) vs semaine dernière »
    // se comprimait en colonne d'un caractère.
    <p className={cn('mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm', tone)}>
      <Icon size={15} className="shrink-0" aria-hidden />
      <span className="tabular-nums">
        {delta > 0 ? '+' : ''}
        {delta.toLocaleString('fr-FR')}
        {percent !== null && ` (${delta > 0 ? '+' : ''}${percent} %)`}
      </span>
      <span className="text-forest/45">{label}</span>
    </p>
  )
}
