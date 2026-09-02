'use client'

import type { ReactNode } from 'react'
import { useReducedMotion, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { fadeUp, scaleIn, staggerContainer } from '@/lib/animations'
import type { LucideIcon } from 'lucide-react'

interface FeaturePoint {
  icon: LucideIcon
  label: string
}

interface SectionFeatureProps {
  id: string
  bg?: 'sand' | 'white' | 'forest'
  eyebrow: string
  title: string
  description: string
  points: FeaturePoint[]
  visual: ReactNode
  /** Sous les puces : boutons, encart « Pourquoi ça compte »… */
  footer?: ReactNode
  reverse?: boolean
  'aria-label'?: string
}

export function SectionFeature({
  id,
  bg = 'sand',
  eyebrow,
  title,
  description,
  points,
  visual,
  footer,
  reverse = false,
  'aria-label': ariaLabel,
}: SectionFeatureProps) {
  const shouldReduceMotion = useReducedMotion()
  const onForest = bg === 'forest'

  const textCol = (
    <motion.div
      className="flex flex-col gap-6"
      variants={shouldReduceMotion ? undefined : fadeUp}
    >
      <span
        className={cn(
          'inline-block font-poppins font-semibold text-sm px-3 py-1 rounded-full w-fit',
          onForest ? 'bg-lime/20 text-lime' : 'bg-forest/90 text-lime',
        )}
      >
        {eyebrow}
      </span>
      <h2
        className={cn(
          'font-poppins font-bold text-3xl md:text-4xl leading-tight',
          onForest ? 'text-white' : 'text-forest',
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          'font-raleway text-lg leading-relaxed',
          onForest ? 'text-white/75' : 'text-forest/70',
        )}
      >
        {description}
      </p>
      <ul className="flex flex-col gap-3" aria-label="Points clés">
        {points.map((point) => {
          const Icon = point.icon
          return (
            <li key={point.label} className="flex items-start gap-3">
              <span
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  onForest ? 'bg-lime/20' : 'bg-lime/20',
                )}
              >
                <Icon
                  className={cn('w-4 h-4', onForest ? 'text-lime' : 'text-forest')}
                  aria-hidden="true"
                />
              </span>
              <span
                className={cn(
                  'font-raleway text-base pt-1.5',
                  onForest ? 'text-white/85' : 'text-forest/80',
                )}
              >
                {point.label}
              </span>
            </li>
          )
        })}
      </ul>
      {footer}
    </motion.div>
  )

  const visualCol = (
    <motion.div
      variants={shouldReduceMotion ? undefined : scaleIn}
    >
      {visual}
    </motion.div>
  )

  return (
    <section
      id={id}
      aria-label={ariaLabel ?? title}
      className={cn(
        'py-20 md:py-28 scroll-mt-16',
        bg === 'sand' ? 'bg-sand' : bg === 'forest' ? 'bg-forest' : 'bg-white',
      )}
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {reverse ? (
            <>
              {visualCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {visualCol}
            </>
          )}
        </div>
      </motion.div>
    </section>
  )
}
