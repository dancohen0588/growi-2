import Link from 'next/link'
import { AlertTriangle, CalendarDays, Droplets, Leaf } from 'lucide-react'
import {
  indicatorTone,
  type DashboardSummary,
  type IndicatorKind,
  type IndicatorTone,
} from '@growi/shared'
import { cn } from '@/lib/utils'

/**
 * Les indicateurs de l'accueil.
 *
 * La couleur vient de `indicatorTone`, partagé avec l'app mobile : une même
 * situation s'y teinte de la même façon. Le rouge est réservé à ce qui se
 * dégrade — du retard, une alerte grave — l'ambre à ce qui attend.
 */
const TONE_STYLE: Record<IndicatorTone, { card: string; value: string; icon: string }> = {
  neutral: { card: 'border-forest/10', value: 'text-forest/70', icon: 'text-forest/40' },
  good: { card: 'border-lime', value: 'text-forest', icon: 'text-lime-hover' },
  warning: { card: 'border-sun', value: 'text-amber-600', icon: 'text-sun' },
  critical: { card: 'border-red-300', value: 'text-red-600', icon: 'text-red-500' },
}

interface Indicator {
  kind: IndicatorKind
  label: string
  value: number
  sub: string
  href: string
  icon: React.ElementType
}

export function SummaryStats({ summary }: { summary: DashboardSummary }) {
  const indicators: Indicator[] = [
    {
      kind: 'plants',
      label: 'Plantes',
      value: summary.plants,
      sub:
        summary.gardens > 0
          ? `dans ${summary.gardens} jardin${summary.gardens > 1 ? 's' : ''}`
          : 'aucun jardin',
      href: '/dashboard/plantes',
      icon: Leaf,
    },
    {
      kind: 'tasks',
      label: 'Gestes du jour',
      value: summary.tasksToday,
      sub:
        summary.tasksLate > 0
          ? `dont ${summary.tasksLate} en retard`
          : summary.tasksWeek > 0
            ? `${summary.tasksWeek} cette semaine`
            : 'rien ne presse',
      href: '/dashboard/calendrier',
      icon: CalendarDays,
    },
    {
      kind: 'water',
      label: 'À arroser',
      value: summary.plantsToWater,
      sub: summary.plantsToWater > 0 ? "aujourd'hui" : 'tout est arrosé',
      href: '/dashboard/calendrier',
      icon: Droplets,
    },
    {
      kind: 'alerts',
      label: 'Alertes',
      value: summary.alerts,
      sub: summary.alertsHigh > 0 ? `dont ${summary.alertsHigh} urgente${summary.alertsHigh > 1 ? 's' : ''}` : 'en cours',
      href: '/dashboard/calendrier',
      icon: AlertTriangle,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {indicators.map(({ kind, label, value, sub, href, icon: Icon }) => {
        const tone = indicatorTone(kind, summary)
        const style = TONE_STYLE[tone]

        return (
          <Link
            key={label}
            href={href}
            className={cn(
              'flex flex-col gap-1 rounded-2xl border-l-4 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover',
              style.card,
            )}
          >
            <span className="flex items-center gap-2 font-raleway text-xs text-forest/50">
              <Icon size={14} className={style.icon} aria-hidden />
              {label}
            </span>
            <span className={cn('font-poppins font-bold text-3xl tabular-nums', style.value)}>
              {value}
            </span>
            <span className="font-raleway text-xs text-forest/40">{sub}</span>
          </Link>
        )
      })}
    </div>
  )
}
