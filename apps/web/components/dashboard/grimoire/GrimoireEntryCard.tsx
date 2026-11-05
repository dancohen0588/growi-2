'use client'

import { useId, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, Lock, RotateCcw } from 'lucide-react'
import { SECRET_VERDICT_LABELS, type GrimoireEntry } from '@growi/shared'

import { restoreSecretAction } from '@/app/actions/secrets'
import { EvidenceBadge } from '@/components/dashboard/secrets/EvidenceBadge'
import { PAPER_CLASS, PAPER_INSET } from '@/components/dashboard/secrets/paper'
import { SecretRecipe } from '@/components/dashboard/secrets/SecretRecipe'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatTrialDate } from '@/lib/secrets/display'
import { cn } from '@/lib/utils'

/** « Essayé 2 fois · dernier essai le 3 nov. 2026 » — ou rien, sans essai. */
function trialsLine(entry: GrimoireEntry): string | null {
  if (entry.trials === 0) return null
  const times = entry.trials === 1 ? 'Essayé une fois' : `Essayé ${entry.trials} fois`
  const date = formatTrialDate(entry.triedAt)
  return date ? `${times} · dernier essai le ${date}` : times
}

/**
 * Une page du grimoire.
 *
 * - **Non découvert** : titre, accroche, badge — la recette est verrouillée.
 * - **Découvert** : la recette se déplie, avec les essais et le verdict.
 * - **Mis de côté** : « Me le reproposer » annule le « Pas pour moi ».
 */
export function GrimoireEntryCard({ entry }: { entry: GrimoireEntry }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(entry.dismissed)
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()
  const panelId = useId()

  const trials = trialsLine(entry)

  function restore() {
    startTransition(async () => {
      try {
        const result = await restoreSecretAction(entry.slug)
        if (result.ok) {
          setDismissed(false)
          toast('C’est noté : ce secret pourra de nouveau t’être proposé.')
        } else {
          toast(result.error)
        }
      } catch {
        toast('Erreur lors de la sauvegarde. Réessaie.')
      }
    })
  }

  return (
    <article
      className={cn(
        'flex w-full flex-col gap-3 rounded-2xl py-4',
        entry.discovered ? PAPER_CLASS : 'bg-white shadow-card ring-1 ring-inset ring-forest/10',
        entry.discovered ? PAPER_INSET : 'px-5',
        dismissed && 'opacity-80',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EvidenceBadge evidence={entry.evidence} />
        {dismissed && (
          <span className="rounded-full bg-forest/10 px-2 py-0.5 font-raleway text-xs font-semibold text-forest/75">
            Mis de côté
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-poppins text-base font-semibold leading-snug text-forest">{entry.title}</h2>
        <p className="font-raleway text-sm italic leading-snug text-forest/75">«&nbsp;{entry.teaser}&nbsp;»</p>
      </div>

      {entry.discovered ? (
        <>
          {(trials || entry.verdict) && (
            <p className="font-raleway text-xs text-forest/70">
              {trials}
              {trials && entry.verdict && ' · '}
              {entry.verdict && (
                <span className="font-semibold text-forest">{SECRET_VERDICT_LABELS[entry.verdict]}</span>
              )}
            </p>
          )}

          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-lg font-raleway text-sm font-semibold text-forest underline underline-offset-2 hover:text-forest/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          >
            <ChevronDown
              size={16}
              aria-hidden
              className={cn('transition-transform', open && 'rotate-180', prefersReduced && 'transition-none')}
            />
            {open ? 'Replier la recette' : 'Voir la recette'}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={panelId}
                initial={prefersReduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <SecretRecipe
                  story={entry.story}
                  ingredients={entry.ingredients}
                  recipe={entry.recipe}
                  cautions={entry.cautions}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <p className="inline-flex items-center gap-1.5 font-raleway text-sm text-forest/70">
          <Lock size={14} aria-hidden />
          Recette à découvrir dans ton calendrier
        </p>
      )}

      {dismissed && (
        <Button variant="outline" size="sm" className="self-start" disabled={pending} onClick={restore}>
          <RotateCcw size={14} aria-hidden />
          Me le reproposer
        </Button>
      )}
    </article>
  )
}
