// growi-frontend/components/dashboard/compte/AlertToggleCard.tsx
'use client'

import { useReducedMotion } from 'framer-motion'
import { AnimatePresence, motion } from 'framer-motion'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AlertToggleCardProps {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onToggle: (val: boolean) => void
  children?: React.ReactNode
  badge?: string
  badgeColor?: 'lime' | 'sun' | 'forest'
  switchAriaLabel: string
}

const badgeClass: Record<string, string> = {
  lime: 'bg-lime/20 text-forest border-0',
  sun: 'bg-sun/20 text-forest border-0',
  forest: 'bg-forest/10 text-forest border-0',
}

export function AlertToggleCard({
  icon,
  title,
  description,
  enabled,
  onToggle,
  children,
  badge,
  badgeColor = 'lime',
  switchAriaLabel,
}: AlertToggleCardProps) {
  const prefersReduced = useReducedMotion()

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card p-5 border-l-4 transition-colors duration-200',
        enabled ? 'border-l-lime' : 'border-l-muted',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 shrink-0 text-forest">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-poppins font-semibold text-sm text-forest">{title}</span>
              {badge && (
                <Badge className={cn('text-xs px-2 py-0.5', badgeClass[badgeColor])}>
                  {badge}
                </Badge>
              )}
            </div>
            <p className="font-raleway text-xs text-forest/60 mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={switchAriaLabel}
          aria-checked={enabled}
          className="shrink-0 mt-0.5"
        />
      </div>

      {/* Expandable sub-parameters */}
      <AnimatePresence initial={false}>
        {enabled && children && (
          <motion.div
            initial={prefersReduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-forest/10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
