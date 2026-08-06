'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { fadeUp, staggerContainer } from '@/lib/animations'

const variantStyles: Record<string, string> = {
  sand:     'bg-sand',
  white:    'bg-white',
  forest:   'bg-forest text-white',
  gradient: 'bg-gradient-to-r from-lime to-forest text-white',
}

interface SectionWrapperProps {
  id?: string
  className?: string
  children: React.ReactNode
  variant?: 'sand' | 'white' | 'forest' | 'gradient'
  'aria-label'?: string
}

export function SectionWrapper({
  id,
  className,
  children,
  variant = 'sand',
  'aria-label': ariaLabel,
}: SectionWrapperProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn('py-20 md:py-28', variantStyles[variant], className)}
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        viewport={{ once: true, margin: '-100px' }}
      >
        <motion.div
          variants={shouldReduceMotion ? undefined : fadeUp}
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  )
}
