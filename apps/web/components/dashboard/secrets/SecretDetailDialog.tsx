'use client'

import { Check, Clock, Hourglass, X } from 'lucide-react'
import type { SecretVerdict } from '@growi/shared'

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  effortLabel,
  plancheFollowUp,
  practicalLine,
  prepLabel,
  type SecretAction,
} from '@/lib/secrets/display'
import { cn } from '@/lib/utils'
import { BD_EYEBROW, BD_FOREST_CTA, BD_OUTLINE, BD_PAPER, BD_TEXT_BUTTON } from './bd'
import { EvidenceBadge } from './EvidenceBadge'
import { SecretEmblem } from './SecretEmblem'
import { SecretPlanche } from './SecretPlanche'
import { SecretRecipe } from './SecretRecipe'
import { GrimoireLink, VerdictButtons } from './SecretCard'

interface SecretDetailDialogProps {
  action: SecretAction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
  onTry: (action: SecretAction) => void
  onDismiss: (action: SecretAction) => void
  onReadyDone: (action: SecretAction) => void
  onFeedback: (action: SecretAction, verdict: SecretVerdict) => void
}

/**
 * Le secret dévoilé.
 *
 * - **Avec planche** (maquette Claude Design `Planche`) : en-tête emblème,
 *   encadré de récit jaune, « Ce qu'il te faut », les cases numérotées, la
 *   case précaution forest, puis « Je tente » / « Plus tard » / « Pas pour
 *   moi ». Sous 720 px, les cases s'empilent.
 * - **Sans planche** : la structure d'avant — badge, titre, accroche,
 *   recette en texte —, sur le même papier et sous le même emblème.
 *
 * Le bouton de fermeture par défaut de `DialogContent` est masqué au profit
 * du nôtre, nommé en français et à la taille d'une cible tactile.
 *
 * L'ouverture **est** le dévoilement : c'est l'appelant qui appelle
 * `revealSecret`, une fois, au clic sur la carte.
 */
export function SecretDetailDialog({
  action,
  open,
  onOpenChange,
  pending = false,
  onTry,
  onDismiss,
  onReadyDone,
  onFeedback,
}: SecretDetailDialogProps) {
  if (!action) return null

  const { secret } = action
  const planche = secret.planche ?? null
  const eyebrow =
    secret.stage === 'ready'
      ? 'Ta préparation est prête'
      : secret.stage === 'feedback'
        ? 'Ça a marché ?'
        : action.plantName
          ? `Secret de jardinier · pour ${action.plantName}`
          : 'Secret de jardinier'

  const later = (
    <button type="button" className={BD_OUTLINE} disabled={pending} onClick={() => onOpenChange(false)}>
      Plus tard
    </button>
  )

  const actions = (
    <>
      {secret.stage === 'discover' && (
        <>
          <button type="button" className={BD_FOREST_CTA} disabled={pending} onClick={() => onTry(action)}>
            <Check size={20} strokeWidth={2.4} className="text-lime" aria-hidden />
            Je tente
          </button>
          {later}
          <button type="button" className={BD_TEXT_BUTTON} disabled={pending} onClick={() => onDismiss(action)}>
            Pas pour moi
          </button>
        </>
      )}
      {secret.stage === 'ready' && (
        <>
          <button type="button" className={BD_FOREST_CTA} disabled={pending} onClick={() => onReadyDone(action)}>
            <Check size={20} strokeWidth={2.4} className="text-lime" aria-hidden />
            C&apos;est fait
          </button>
          {later}
        </>
      )}
    </>
  )

  const verdicts = secret.stage === 'feedback' && (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-poppins text-sm font-semibold text-forest">Ça a marché ?</p>
      <VerdictButtons
        label={`Ton avis sur « ${secret.title} »`}
        disabled={pending}
        onVerdict={(verdict) => onFeedback(action, verdict)}
      />
    </div>
  )

  const closeButton = (
    <DialogClose
      aria-label="Fermer"
      className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-sand-dark bg-white text-forest hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 sm:right-6 sm:top-6"
    >
      <X size={18} strokeWidth={2.4} aria-hidden />
    </DialogClose>
  )

  if (planche) {
    const practical = practicalLine(secret)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            BD_PAPER,
            'max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[1112px] gap-0 overflow-y-auto rounded-[28px] border-0 p-0 shadow-[0_30px_60px_-30px_rgba(30,86,49,0.45)] sm:rounded-[28px] [&>button:last-child]:hidden',
          )}
        >
          {closeButton}
          <div className="flex flex-col gap-[22px] px-5 py-6 text-forest sm:px-10 sm:py-9">
            <header className="flex items-center gap-4 pr-14 sm:gap-[22px]">
              <SecretEmblem variant="full" className="h-14 w-14 sm:h-[84px] sm:w-[84px]" />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={cn(BD_EYEBROW, 'text-xs text-forest-light')}>{eyebrow}</span>
                  <EvidenceBadge evidence={secret.evidence} tone="sun" />
                  {practical && <span className="font-raleway text-sm text-[#4b6b55]">{practical}</span>}
                </div>
                <DialogTitle className="m-0 font-poppins text-2xl font-bold leading-[1.15] tracking-[-0.01em] text-forest sm:text-[34px]">
                  {secret.title}
                </DialogTitle>
                <DialogDescription className="sr-only">{secret.teaser}</DialogDescription>
              </div>
            </header>

            <SecretPlanche
              planche={planche}
              story={secret.story}
              ingredients={secret.ingredients}
              evidence={secret.evidence}
              cautions={secret.cautions}
            />

            <footer className="mt-2 flex flex-wrap items-center gap-4">
              {actions}
              {verdicts}
              {secret.stage === 'discover' && (
                <span className="w-full font-raleway text-[15px] text-[#4b6b55] sm:ml-auto sm:w-auto">
                  {plancheFollowUp(secret.prepDays)}
                </span>
              )}
            </footer>
            {secret.stage === 'discover' && (
              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-raleway text-sm text-[#4b6b55]">
                « Pas pour moi » : on ne te le proposera plus. Tu pourras changer d&apos;avis depuis ton grimoire.
                <GrimoireLink />
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const effort = effortLabel(secret.effortMinutes)
  const prep = prepLabel(secret.prepDays)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          BD_PAPER,
          'max-h-[90vh] max-w-lg overflow-y-auto rounded-[28px] border-0 shadow-[0_30px_60px_-30px_rgba(30,86,49,0.45)] sm:rounded-[28px] [&>button:last-child]:hidden',
        )}
      >
        {closeButton}
        <header className="flex flex-col gap-2 pr-12 text-left">
          <div className="flex items-center gap-3">
            <SecretEmblem variant="full" className="h-12 w-12" />
            <span className={cn(BD_EYEBROW, 'text-xs text-forest-light')}>{eyebrow}</span>
          </div>
          <EvidenceBadge evidence={secret.evidence} tone="sun" withHint />
          <DialogTitle className="font-poppins text-xl font-bold leading-snug text-forest">{secret.title}</DialogTitle>
          <DialogDescription className="font-raleway text-base italic leading-snug text-forest/75">
            «&nbsp;{secret.teaser}&nbsp;»
          </DialogDescription>
          {action.plantName && (
            <p className="font-raleway text-sm text-forest/70">
              <span aria-hidden>{action.plantEmoji || '🌿'} </span>
              Pour {action.plantName}
            </p>
          )}
        </header>

        <ul className="flex flex-wrap gap-2" aria-label="En pratique">
          {effort && (
            <li className={CHIP}>
              <Clock size={13} aria-hidden />
              {effort}
            </li>
          )}
          <li className={cn(CHIP, prep && 'bg-sun/30')}>
            <Hourglass size={13} aria-hidden />
            {prep ?? 'À utiliser tout de suite'}
          </li>
        </ul>

        <SecretRecipe
          story={secret.story}
          ingredients={secret.ingredients}
          recipe={secret.recipe}
          cautions={secret.cautions}
        />

        <div className="flex flex-col gap-3 border-t border-forest/10 pt-4">
          {secret.stage !== 'feedback' && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          {verdicts}

          {secret.stage === 'discover' && (
            <p className="font-raleway text-xs leading-relaxed text-forest/60">
              « Pas pour moi » : on ne te le proposera plus. Tu pourras changer d&apos;avis depuis ton grimoire.
            </p>
          )}
          <GrimoireLink className="self-start" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 font-raleway text-xs font-semibold text-forest ring-1 ring-inset ring-forest/10'
