'use client'

import { useState, useTransition } from 'react'
import { BookOpen, Lock, RotateCcw, X } from 'lucide-react'
import { SECRET_VERDICT_LABELS, type GrimoireEntry } from '@growi/shared'

import { restoreSecretAction } from '@/app/actions/secrets'
import { BD_EYEBROW, BD_FOREST_CTA, BD_OUTLINE, BD_PAPER } from '@/components/dashboard/secrets/bd'
import { EvidenceBadge } from '@/components/dashboard/secrets/EvidenceBadge'
import { SecretArt } from '@/components/dashboard/secrets/SecretArt'
import { LeavesWatermark } from '@/components/dashboard/secrets/SecretCard'
import { SecretEmblem } from '@/components/dashboard/secrets/SecretEmblem'
import { SecretPlanche } from '@/components/dashboard/secrets/SecretPlanche'
import { SecretRecipe } from '@/components/dashboard/secrets/SecretRecipe'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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

/** Le cadre des pages du grimoire : le trait et l'ombre imprimée des cases de la planche. */
const PAGE = 'relative flex w-full flex-col overflow-hidden rounded-[22px] border-[3px] border-forest'

/**
 * Une page du grimoire, dans l'habillage « planche BD ».
 *
 * - **Découvert** : la première case de la planche en couverture, sur papier,
 *   et « Ouvrir la planche » — la planche entière, dans la même popin que
 *   depuis le calendrier (sans les gestes : on relit, on ne retente pas d'ici).
 * - **Non découvert** : une couverture forest scellée — l'emblème et un
 *   cadenas, rien du dessin. Le titre et l'accroche restent lisibles : c'est
 *   ce qui donne envie d'attendre la semaine où il sortira.
 * - **Mis de côté** : « Me le reproposer » annule le « Pas pour moi ».
 */
export function GrimoireEntryCard({ entry }: { entry: GrimoireEntry }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(entry.dismissed)
  const [pending, startTransition] = useTransition()
  const { toast } = useToast()

  const trials = trialsLine(entry)
  const cover = entry.discovered ? entry.planche?.panels[0]?.art : undefined

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
        PAGE,
        entry.discovered ? cn(BD_PAPER, 'shadow-[6px_6px_0_#1E5631]') : 'border-forest/80 bg-white shadow-[6px_6px_0_rgba(30,86,49,0.25)]',
      )}
    >
      {entry.discovered ? (
        // La première case, posée de biais comme une page glissée dans le
        // carnet : on reconnaît le secret sans relire la planche entière.
        <div
          aria-hidden
          className="relative flex h-[168px] items-center justify-center overflow-hidden border-b-[3px] border-forest bg-[#DCEFC0]"
        >
          {cover ? (
            <div className="h-[132px] -rotate-2 overflow-hidden rounded-md border-[3px] border-forest bg-[#FCE7A9] shadow-[4px_4px_0_#1E5631]">
              <SecretArt artKey={cover} className="aspect-[4/3] h-full" />
            </div>
          ) : (
            <SecretEmblem variant="full" decorative className="h-24 w-24" />
          )}
        </div>
      ) : (
        <div
          aria-hidden
          className="relative flex h-[168px] items-center justify-center overflow-hidden border-b-[3px] border-forest/80 bg-forest"
        >
          <LeavesWatermark />
          <SecretEmblem variant="full" decorative className="relative h-24 w-24 opacity-90" />
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-sand bg-forest text-sun">
            <Lock size={16} strokeWidth={2.4} />
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EvidenceBadge evidence={entry.evidence} tone="sun" />
          {dismissed && (
            <span className="rounded-full border-2 border-forest/30 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/75">
              Mis de côté
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 font-poppins text-lg font-bold leading-snug text-forest">{entry.title}</h2>
          <p className="m-0 font-raleway text-[15px] italic leading-snug text-[#4b6b55]">«&nbsp;{entry.teaser}&nbsp;»</p>
        </div>

        {entry.discovered && (trials || entry.verdict) && (
          <p className="m-0 font-raleway text-sm text-[#4b6b55]">
            {trials}
            {trials && entry.verdict && ' · '}
            {entry.verdict && <span className="font-semibold text-forest">{SECRET_VERDICT_LABELS[entry.verdict]}</span>}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          {entry.discovered ? (
            <button
              type="button"
              className={cn(BD_FOREST_CTA, 'px-5 py-2.5 text-[15px]')}
              onClick={() => setOpen(true)}
            >
              <BookOpen size={18} className="text-lime" aria-hidden />
              {entry.planche ? 'Ouvrir la planche' : 'Relire la recette'}
            </button>
          ) : (
            <p className="m-0 inline-flex items-center gap-1.5 font-poppins text-sm font-semibold text-forest/70">
              <Lock size={15} aria-hidden />
              Se dévoile dans ton calendrier
            </p>
          )}
          {dismissed && (
            <button type="button" className={cn(BD_OUTLINE, 'px-4 py-2 text-[15px]')} disabled={pending} onClick={restore}>
              <RotateCcw size={15} aria-hidden />
              Me le reproposer
            </button>
          )}
        </div>
      </div>

      {entry.discovered && <GrimoirePlancheDialog entry={entry} open={open} onOpenChange={setOpen} />}
    </article>
  )
}

/**
 * La planche relue depuis le grimoire : le même papier et le même en-tête que
 * la popin du calendrier, sans « Je tente » — un secret se tente quand le
 * calendrier le propose, pour un jardin et une plante.
 */
function GrimoirePlancheDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: GrimoireEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          BD_PAPER,
          'max-h-[92vh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-[28px] border-0 p-0 shadow-[0_30px_60px_-30px_rgba(30,86,49,0.45)] sm:rounded-[28px] [&>button:last-child]:hidden',
          entry.planche ? 'max-w-[1112px]' : 'max-w-lg',
        )}
      >
        <DialogClose
          aria-label="Fermer"
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-sand-dark bg-white text-forest hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 sm:right-6 sm:top-6"
        >
          <X size={18} strokeWidth={2.4} aria-hidden />
        </DialogClose>
        <div className="flex flex-col gap-[22px] px-5 py-6 text-forest sm:px-10 sm:py-9">
          <header className="flex items-center gap-4 pr-14 sm:gap-[22px]">
            <SecretEmblem variant="full" decorative className="h-14 w-14 sm:h-[84px] sm:w-[84px]" />
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className={cn(BD_EYEBROW, 'text-xs text-forest-light')}>Mon grimoire</span>
                <EvidenceBadge evidence={entry.evidence} tone="sun" />
              </div>
              <DialogTitle className="m-0 font-poppins text-2xl font-bold leading-[1.15] tracking-[-0.01em] text-forest sm:text-[34px]">
                {entry.title}
              </DialogTitle>
              <DialogDescription className="sr-only">{entry.teaser}</DialogDescription>
            </div>
          </header>

          {entry.planche ? (
            <SecretPlanche
              planche={entry.planche}
              story={entry.story}
              ingredients={entry.ingredients}
              evidence={entry.evidence}
              cautions={entry.cautions}
            />
          ) : (
            <SecretRecipe
              story={entry.story}
              ingredients={entry.ingredients}
              recipe={entry.recipe}
              cautions={entry.cautions}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
