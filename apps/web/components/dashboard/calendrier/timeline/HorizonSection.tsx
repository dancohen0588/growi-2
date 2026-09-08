'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ACTION_HORIZON_LABELS, groupWateringActions, type ActionHorizon } from '@growi/shared'
import { GardenAction } from '@/lib/mock-actions'
import { ActionCardLarge } from '../cards/ActionCardLarge'
import { ActionRowCompact } from '../cards/ActionRowCompact'
import { WateringGroupCard } from '../cards/WateringGroupCard'
import { EmptyState } from '../EmptyState'
import { SectionMenu } from '../SectionMenu'
import { staggerContainer, fadeUp } from '@/lib/animations'

/** Au-delà, une section « à ton rythme » occupe l'écran sans rien presser. */
const FOLD_THRESHOLD = 4

interface HorizonSectionProps {
  horizon: ActionHorizon
  actions: GardenAction[]
  onDone: (id: string) => void
  onDoneMany: (actions: GardenAction[]) => void
  onOpenDetail: (action: GardenAction) => void
  /** « Ignorer pour aujourd'hui » — la section du jour seulement. */
  onClearToday?: () => void
  /** Le jardin est en pause : la section l'annonce et propose de rétablir. */
  cleared?: boolean
  onRestore?: () => void
}

/**
 * Une section par échéance — aujourd'hui, cette semaine, ce mois-ci, plus tard
 * — comme dans l'app mobile, et avec la même dégressivité : plus l'échéance est
 * lointaine, plus la carte est discrète. Ce qui est « à ton rythme » descend
 * donc naturellement en lignes compactes, sans rouge et sans photo de 160 px.
 */
export function HorizonSection({
  horizon,
  actions,
  onDone,
  onDoneMany,
  onOpenDetail,
  onClearToday,
  cleared,
  onRestore,
}: HorizonSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const headingId = `horizon-${horizon}`

  // Seul l'arrosage est groupé : c'est le seul geste qu'on fasse en tournée.
  const { groups, singles } = groupWateringActions(actions, horizon)
  const folds = horizon === 'month' && !expanded && singles.length > FOLD_THRESHOLD
  const visible = folds ? singles.slice(0, FOLD_THRESHOLD) : singles

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
        {(horizon === 'today' || horizon === 'month') && (
          <SectionMenu
            actions={actions}
            onDoneAll={() => onDoneMany(actions)}
            onClearToday={horizon === 'today' ? onClearToday : undefined}
          />
        )}
      </div>

      {cleared && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-sand px-4 py-3 font-raleway text-sm text-forest/70">
          <span>🙈 Actions ignorées pour aujourd&apos;hui.</span>
          <button
            type="button"
            onClick={onRestore}
            className="font-semibold text-forest underline underline-offset-2 hover:text-forest/70"
          >
            Rétablir
          </button>
        </div>
      )}

      {actions.length === 0 ? (
        cleared ? null : (
          <EmptyState
            message={
              horizon === 'today'
                ? "Rien à faire aujourd'hui — profite de ton jardin !"
                : 'Rien de prévu.'
            }
            icon={horizon === 'today' ? '☀️' : '🌿'}
          />
        )
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className={
            horizon === 'today' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col'
          }
        >
          {groups.map((group) => (
            <motion.div key={group.key} variants={fadeUp} layout>
              <WateringGroupCard
                group={group}
                onDoneMany={onDoneMany}
                onOpenDetail={onOpenDetail}
              />
            </motion.div>
          ))}

          {visible.map((action) =>
            horizon === 'today' ? (
              <motion.div key={action.id} variants={fadeUp} layout>
                <ActionCardLarge action={action} onDone={onDone} onOpenDetail={onOpenDetail} />
              </motion.div>
            ) : (
              <ActionRowCompact
                key={action.id}
                action={action}
                onDone={onDone}
                onOpenDetail={onOpenDetail}
              />
            ),
          )}

          {folds && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 self-start font-raleway text-sm font-semibold text-forest/70 underline underline-offset-2 hover:text-forest"
            >
              Voir les {singles.length} actions
            </button>
          )}
        </motion.div>
      )}
    </section>
  )
}
