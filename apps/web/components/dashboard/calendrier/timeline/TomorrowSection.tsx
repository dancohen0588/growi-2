'use client'
// growi-frontend/components/dashboard/calendrier/timeline/TomorrowSection.tsx
import { motion } from 'framer-motion'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardMedium } from '../cards/ActionCardMedium'
import { EmptyState } from '../EmptyState'
import { staggerContainer, fadeUp } from '@/lib/animations'

interface TomorrowSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function TomorrowSection({ actions, onDone }: TomorrowSectionProps) {
  return (
    <section aria-labelledby="tomorrow-heading">
      <div className="flex items-center gap-3 mb-4">
        <h2
          id="tomorrow-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Demain
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState message="Rien de prévu pour demain." icon="🌙" />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          {actions.map(a => (
            <motion.div key={a.id} variants={fadeUp} layout>
              <ActionCardMedium action={a} onDone={onDone} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
