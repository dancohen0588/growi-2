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
  bg?: 'sand' | 'white'
  eyebrow: string
  title: string
  description: string
  points: FeaturePoint[]
  visual: ReactNode
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
  reverse = false,
  'aria-label': ariaLabel,
}: SectionFeatureProps) {
  const shouldReduceMotion = useReducedMotion()

  const textCol = (
    <motion.div
      className="flex flex-col gap-6"
      variants={shouldReduceMotion ? undefined : fadeUp}
    >
      <span className="inline-block font-poppins font-semibold text-sm text-lime bg-forest/90 px-3 py-1 rounded-full w-fit">
        {eyebrow}
      </span>
      <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl leading-tight">
        {title}
      </h2>
      <p className="font-raleway text-forest/70 text-lg leading-relaxed">
        {description}
      </p>
      <ul className="flex flex-col gap-3" aria-label="Points clés">
        {points.map((point) => {
          const Icon = point.icon
          return (
            <li key={point.label} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-lime/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-forest" aria-hidden="true" />
              </span>
              <span className="font-raleway text-forest/80 text-base">{point.label}</span>
            </li>
          )
        })}
      </ul>
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
      className={cn('py-20 md:py-28', bg === 'sand' ? 'bg-sand' : 'bg-white')}
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
