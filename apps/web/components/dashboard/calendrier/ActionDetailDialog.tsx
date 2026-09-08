'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, Stethoscope } from 'lucide-react'
import { ACTION_TYPE_LABELS } from '@growi/shared'
import type { GardenAction } from '@/lib/mock-actions'

import {
  actionChatParams,
  useChatPanel,
} from '@/components/dashboard/chat/ChatPanelProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatActionWhen } from '@/lib/calendar-utils'
import { ActionIcon } from './ActionIcon'

/**
 * Titre de la modale.
 *
 * Le titre court des tâches planifiées avant l'arrivée de `shortAction` est
 * une simple troncature du libellé — le reprendre ici afficherait une version
 * coupée du texte qui suit immédiatement. Dans ce cas seulement, on titre par
 * le geste, qui reste juste et se lit d'un trait.
 */
function dialogTitle(action: GardenAction): string {
  const isTruncated = action.shortLabel.endsWith('…')
  return isTruncated ? ACTION_TYPE_LABELS[action.type] : action.shortLabel
}

/** D'où vient cette action — dit en clair, jamais deviné à la couleur d'un badge. */
function originLabel(action: GardenAction): string {
  if (action.source === 'task') return 'Issue d’un diagnostic que tu as planifié'
  return 'Proposée par le moteur Growi'
}

interface ActionDetailDialogProps {
  action: GardenAction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: (id: string) => void
}

/**
 * Le détail d'une action — pour **toutes** les actions, moteur compris.
 *
 * Jusqu'ici la modale ne s'ouvrait que pour celles qui portaient une consigne,
 * c'est-à-dire les seules tâches de diagnostic. Les actions du moteur — la
 * grande majorité — n'avaient rien à montrer, et le lien « Voir le détail »
 * n'apparaissait même pas : on ne pouvait donc jamais savoir *pourquoi* Growi
 * demandait de tailler ce rosier-là ce mois-ci.
 *
 * Structure fixe, la même que la feuille du mobile : en-tête, pourquoi
 * maintenant, comment faire, et ce qu'on peut en faire.
 */
export function ActionDetailDialog({
  action,
  open,
  onOpenChange,
  onDone,
}: ActionDetailDialogProps) {
  const openChat = useChatPanel()
  if (!action) return null

  const when = formatActionWhen(action)
  const chatParams = actionChatParams(action)
  // Le « pourquoi » du moteur, ou la consigne de la tâche acceptée.
  const why = action.why ?? action.detail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-poppins text-forest">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand-dark">
              {action.plantPhotoUrl ? (
                <Image src={action.plantPhotoUrl} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="text-2xl" aria-hidden>
                  {action.plantEmoji || '🌿'}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <ActionIcon type={action.type} size={17} className="shrink-0 text-forest" />
                {dialogTitle(action)}
                {action.plantName ? (
                  <span className="truncate font-raleway font-normal text-forest/60">
                    · {action.plantName}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block font-raleway text-sm font-normal capitalize text-forest/60">
                {when.label}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-lime/25 px-2.5 py-1 font-raleway text-xs text-forest">
            {action.source === 'task' && <Stethoscope size={12} aria-hidden />}
            {originLabel(action)}
          </p>

          {why && (
            <section className="flex flex-col gap-1">
              <h3 className="font-poppins text-xs font-semibold uppercase tracking-wide text-forest/50">
                Pourquoi maintenant
              </h3>
              <p className="font-raleway text-sm leading-relaxed text-forest/85">{why}</p>
            </section>
          )}

          {/* Sans conseil catalogue, pas de section vide : mieux vaut une
              popin courte qu'un intertitre qui ne tient pas sa promesse. */}
          {action.howTo && (
            <section className="flex flex-col gap-1">
              <h3 className="font-poppins text-xs font-semibold uppercase tracking-wide text-forest/50">
                Comment faire
              </h3>
              <p className="font-raleway text-sm leading-relaxed text-forest/85">{action.howTo}</p>
            </section>
          )}

          {action.notes && (
            <p className="font-raleway text-sm italic leading-relaxed text-forest/60">
              {action.notes}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {onDone && !action.done && (
              <Button
                variant="primary"
                onClick={() => {
                  onOpenChange(false)
                  onDone(action.id)
                }}
              >
                ✓ C&apos;est fait
              </Button>
            )}

            {action.plantId && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/plantes/${action.plantId}`}>Ouvrir la fiche</Link>
              </Button>
            )}

            {chatParams && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  openChat(chatParams)
                }}
              >
                <MessageCircle size={15} aria-hidden />
                Demander à Growi
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
