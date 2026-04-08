// growi-frontend/components/dashboard/calendrier/timeline/TodaySection.tsx
import { motion } from 'framer-motion'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardLarge } from '../cards/ActionCardLarge'
import { EmptyState } from '../EmptyState'
import { staggerContainer, fadeUp } from '@/lib/animations'

interface TodaySectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function TodaySection({ actions, onDone }: TodaySectionProps) {
  return (
    <section aria-labelledby="today-heading">
      <div className="flex items-center gap-3 mb-4 rounded-xl bg-lime/10 px-4 py-2.5">
        <h2
          id="today-heading"
          className="font-poppins font-bold text-forest text-base flex-1"
        >
          Aujourd&apos;hui
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-lime px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          message="Rien à faire aujourd'hui — profite de ton jardin !"
          icon="☀️"
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >
          {actions.map(a => (
            <motion.div key={a.id} variants={fadeUp} layout>
              <ActionCardLarge action={a} onDone={onDone} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
