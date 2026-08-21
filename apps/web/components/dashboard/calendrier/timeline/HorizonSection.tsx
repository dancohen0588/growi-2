'use client'

import { motion } from 'framer-motion'
import { ACTION_HORIZON_LABELS, type ActionHorizon } from '@growi/shared'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardLarge } from '../cards/ActionCardLarge'
import { ActionCardMedium } from '../cards/ActionCardMedium'
import { ActionRowCompact } from '../cards/ActionRowCompact'
import { EmptyState } from '../EmptyState'
import { staggerContainer, fadeUp } from '@/lib/animations'

interface HorizonSectionProps {
  horizon: ActionHorizon
  actions: GardenAction[]
  onDone: (id: string) => void
}

/**
 * Une section par échéance — aujourd'hui, demain, plus tard — comme dans l'app
 * mobile, et avec la même dégressivité : plus l'échéance est lointaine, plus la
 * carte est discrète.
 */
export function HorizonSection({ horizon, actions, onDone }: HorizonSectionProps) {
  const headingId = `horizon-${horizon}`

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-center gap-3 rounded-xl bg-lime/10 px-4 py-2.5">
        <h2 id={headingId} className="flex-1 font-poppins font-bold text-base text-forest">
          {ACTION_HORIZON_LABELS[horizon]}
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-lime px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          message={
            horizon === 'today'
              ? "Rien à faire aujourd'hui — profite de ton jardin !"
              : 'Rien de prévu.'
          }
          icon={horizon === 'today' ? '☀️' : '🌿'}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className={
            horizon === 'today'
              ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-2'
          }
        >
          {actions.map((action) => (
            <motion.div key={action.id} variants={fadeUp} layout>
              {horizon === 'today' ? (
                <ActionCardLarge action={action} onDone={onDone} />
              ) : horizon === 'tomorrow' ? (
                <ActionCardMedium action={action} onDone={onDone} />
              ) : (
                <ActionRowCompact action={action} onDone={onDone} />
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}
