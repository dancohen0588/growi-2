'use client'

import { useState, useTransition } from 'react'
import { Droplets, Loader2, Plus, Scissors, Sprout } from 'lucide-react'
import {
  CARE_LOG_TYPES,
  CARE_LOG_TYPE_LABELS,
  HEALTH_STATUSES,
  HEALTH_STATUS_LABELS,
  type CareLogType,
  type CreateCareLogInput,
  type HealthStatus,
} from '@growi/shared'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { logCareAction } from '@/lib/actions/plant.actions'

/**
 * Les gestes d'entretien, à portée de clic sur la fiche.
 *
 * Trois boutons pour ce qui se fait chaque semaine, un quatrième pour le
 * reste — récolte, traitement, rempotage, semis, note de santé — qui se fait
 * quelques fois par an et mérite un champ ou deux. Même découpage que la fiche
 * mobile, dont ces gestes manquaient ici.
 */

/** Les gestes qui n'ont pas leur bouton dédié, dans l'ordre où on les propose. */
const OTHER_TYPES = CARE_LOG_TYPES.filter(
  (type) => !['watering', 'pruning', 'fertilizing'].includes(type),
)

export interface PlantQuickActionsProps {
  plantId: string
  /** Remonte le geste noté pour que la fiche rafraîchisse ses dates et son journal. */
  onLogged?: () => void
}

export function PlantQuickActions({ plantId, onLogged }: PlantQuickActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { toast } = useToast()

  const log = (input: CreateCareLogInput, confirmation: string) => {
    startTransition(async () => {
      try {
        await logCareAction(plantId, input)
        toast(confirmation)
        onLogged?.()
      } catch {
        toast("Le geste n'a pas pu être enregistré. Réessaie.")
      }
    })
  }

  return (
    <>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <QuickAction
          icon={<Droplets size={20} aria-hidden />}
          label="J'ai arrosé"
          disabled={isPending}
          onClick={() => log({ type: 'watering' }, 'Arrosage enregistré 💧')}
        />
        <QuickAction
          icon={<Scissors size={20} aria-hidden />}
          label="J'ai taillé"
          disabled={isPending}
          onClick={() => log({ type: 'pruning' }, 'Taille enregistrée ✂️')}
        />
        <QuickAction
          icon={<Sprout size={20} aria-hidden />}
          label="J'ai fertilisé"
          disabled={isPending}
          onClick={() => log({ type: 'fertilizing' }, 'Fertilisation enregistrée 🌱')}
        />
        <QuickAction
          icon={<Plus size={20} aria-hidden />}
          label="Autre geste"
          disabled={isPending}
          onClick={() => setSheetOpen(true)}
        />
      </section>

      <CareLogDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isPending={isPending}
        onSubmit={(input) => {
          setSheetOpen(false)
          log(input, 'Geste enregistré 🌿')
        }}
      />
    </>
  )
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white shadow-card px-3 py-3.5 hover:shadow-card-hover transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="text-forest">{icon}</span>
      <span className="font-poppins text-xs font-semibold text-forest text-center">{label}</span>
    </button>
  )
}

/** Saisie d'un geste moins courant : le type, et ce qui le précise. */
function CareLogDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onSubmit: (input: CreateCareLogInput) => void
}) {
  const [type, setType] = useState<CareLogType>('harvest')
  const [note, setNote] = useState('')
  const [productUsed, setProductUsed] = useState('')
  const [status, setStatus] = useState<HealthStatus>('HEALTHY')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')

  const submit = () => {
    // Le clavier rend du texte : on convertit à la soumission plutôt que de
    // laisser une chaîne vide devenir `NaN` en base.
    const parsedQuantity = quantity.trim() ? Number(quantity.replace(',', '.')) : undefined

    onSubmit({
      type,
      note: note.trim() || undefined,
      ...(type === 'health' ? { status } : {}),
      ...(type === 'harvest' && Number.isFinite(parsedQuantity)
        ? { quantity: parsedQuantity, unit }
        : {}),
      ...(['treatment', 'fertilizing', 'repotting'].includes(type) && productUsed.trim()
        ? { productUsed: productUsed.trim() }
        : {}),
    } as CreateCareLogInput)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-poppins text-forest">Noter un geste</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {OTHER_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`rounded-full px-3 py-1.5 font-poppins text-xs font-semibold transition-colors ${
                  type === value
                    ? 'bg-forest text-white'
                    : 'bg-sand text-forest hover:bg-lime/30'
                }`}
              >
                {CARE_LOG_TYPE_LABELS[value]}
              </button>
            ))}
          </div>

          {type === 'health' && (
            <div className="flex flex-wrap gap-2">
              {HEALTH_STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`rounded-full px-3 py-1.5 font-raleway text-xs transition-colors ${
                    status === value
                      ? 'bg-lime text-forest font-semibold'
                      : 'bg-sand text-forest/70 hover:bg-lime/30'
                  }`}
                >
                  {HEALTH_STATUS_LABELS[value]}
                </button>
              ))}
            </div>
          )}

          {type === 'harvest' && (
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantité"
                className="flex-1 rounded-xl border border-forest/20 px-3 py-2 font-raleway text-sm text-forest"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="rounded-xl border border-forest/20 px-3 py-2 font-raleway text-sm text-forest"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="pièces">pièces</option>
              </select>
            </div>
          )}

          {['treatment', 'fertilizing', 'repotting'].includes(type) && (
            <input
              value={productUsed}
              onChange={(e) => setProductUsed(e.target.value)}
              placeholder="Produit employé (facultatif)"
              className="rounded-xl border border-forest/20 px-3 py-2 font-raleway text-sm text-forest"
            />
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (facultatif)"
            rows={2}
            className="rounded-xl border border-forest/20 px-3 py-2 font-raleway text-sm text-forest resize-none"
          />

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-2.5 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isPending && <Loader2 size={16} className="animate-spin" aria-hidden />}
            Enregistrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
