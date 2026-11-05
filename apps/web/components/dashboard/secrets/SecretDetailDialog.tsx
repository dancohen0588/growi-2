'use client'

import { Clock, Hourglass } from 'lucide-react'
import type { SecretVerdict } from '@growi/shared'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { effortLabel, prepLabel, type SecretAction } from '@/lib/secrets/display'
import { cn } from '@/lib/utils'
import { EvidenceBadge } from './EvidenceBadge'
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
 * Le secret dévoilé — même structure que la popin d'une action
 * (`ActionDetailDialog`) : en-tête, contenu, ce qu'on peut en faire. Le fond
 * reprend le papier sand de la carte, pour qu'on sache d'où l'on vient.
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
  const effort = effortLabel(secret.effortMinutes)
  const prep = prepLabel(secret.prepDays)
  const later = (
    <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
      Plus tard
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-sand">
        <DialogHeader className="gap-2 text-left">
          <EvidenceBadge evidence={secret.evidence} withHint />
          <DialogTitle className="pr-6 font-poppins text-xl leading-snug text-forest">{secret.title}</DialogTitle>
          <DialogDescription className="font-raleway text-base italic leading-snug text-forest/75">
            «&nbsp;{secret.teaser}&nbsp;»
          </DialogDescription>
          {action.plantName && (
            <p className="font-raleway text-sm text-forest/70">
              <span aria-hidden>{action.plantEmoji || '🌿'} </span>
              Pour {action.plantName}
            </p>
          )}
        </DialogHeader>

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
          {secret.stage === 'discover' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={pending} onClick={() => onTry(action)}>
                Je tente
              </Button>
              <Button variant="outline" disabled={pending} onClick={() => onDismiss(action)}>
                Pas pour moi
              </Button>
              {later}
            </div>
          )}

          {secret.stage === 'ready' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={pending} onClick={() => onReadyDone(action)}>
                ✓ C&apos;est fait
              </Button>
              {later}
            </div>
          )}

          {secret.stage === 'feedback' && (
            <>
              <p className="font-poppins text-sm font-semibold text-forest">Ça a marché ?</p>
              <VerdictButtons
                label={`Ton avis sur « ${secret.title} »`}
                disabled={pending}
                onVerdict={(verdict) => onFeedback(action, verdict)}
              />
            </>
          )}

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
