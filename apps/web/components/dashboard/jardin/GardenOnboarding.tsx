'use client'

import { Fragment } from 'react'
import {
  X, Check, ChevronLeft, ChevronRight, Wand2,
  Ruler, Square, Sprout, MessageSquarePlus, Map,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatParcelId } from '@/lib/garden/cadastre-seed'
import type { GardenConfig, GardenOrientation } from '@/lib/garden/types'

// Assistant de création du jardin (P4) — carte flottante guidée en 4 étapes.

const ORIENTATIONS: Array<[GardenOrientation, string]> = [
  ['S', 'Sud'], ['N', 'Nord'], ['E', 'Est'], ['O', 'Ouest'],
  ['SE', 'Sud-Est'], ['SO', 'Sud-Ouest'], ['NE', 'Nord-Est'], ['NO', 'Nord-Ouest'],
]

const STEPS = [
  { title: 'Le terrain', Icon: Ruler },
  { title: 'Les zones', Icon: Square },
  { title: 'Les végétaux', Icon: Sprout },
  { title: 'Les commentaires', Icon: MessageSquarePlus },
]

interface GardenOnboardingProps {
  step: number
  onStepChange: (step: number) => void
  config: GardenConfig
  onConfigChange: (patch: Partial<GardenConfig>) => void
  onActivateComments: () => void
  onClose: () => void
  onComplete: () => void
  /**
   * L'import cadastral n'est proposé que là où il a un sens : un jardin en
   * pleine terre, hors balcon, serre et intérieur.
   */
  cadastreAvailable?: boolean
  /** Adresse du compte, affichée sous le bouton. */
  addressLabel?: string | null
  onOpenCadastre?: () => void
}

export function GardenOnboarding({
  step, onStepChange, config, onConfigChange, onActivateComments, onClose, onComplete,
  cadastreAvailable = false, addressLabel, onOpenCadastre,
}: GardenOnboardingProps) {
  const current = STEPS[step - 1]
  const imported = config.cadastre
  const horsBati =
    imported && imported.builtM2 !== null
      ? Math.max(0, imported.contenanceM2 - imported.builtM2)
      : null

  return (
    <div className="absolute bottom-3 left-3 z-30 w-[300px] rounded-2xl border border-forest/10 bg-white shadow-card-hover overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-lime/40 to-sun/20 px-3 py-2">
        <Wand2 size={15} className="text-forest" aria-hidden />
        <span className="flex-1 font-poppins font-semibold text-sm text-forest">Assistant de création</span>
        <button
          onClick={onClose}
          title="Passer en édition libre"
          aria-label="Fermer l'assistant"
          className="p-0.5 rounded text-forest/50 hover:bg-white/60 hover:text-forest transition-colors"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center px-3 pt-3 pb-1">
        {STEPS.map((s, i) => {
          const n = i + 1
          const done = n < step
          const isCurrent = n === step
          return (
            <Fragment key={n}>
              <button
                onClick={() => onStepChange(n)}
                title={s.title}
                aria-label={`Étape ${n} : ${s.title}`}
                className={cn(
                  'grid place-items-center w-6 h-6 rounded-full font-poppins font-bold text-[11px] shrink-0 transition-colors',
                  done
                    ? 'bg-forest text-white'
                    : isCurrent
                      ? 'bg-lime text-forest ring-2 ring-lime/40'
                      : 'bg-forest/10 text-forest/40 hover:bg-forest/20',
                )}
              >
                {done ? <Check size={13} aria-hidden /> : n}
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 rounded', n < step ? 'bg-forest' : 'bg-forest/12')} />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* Corps */}
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <current.Icon size={15} className="text-forest-light" aria-hidden />
          <h3 className="font-poppins font-semibold text-sm text-forest">
            Étape {step} · {current.title}
          </h3>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-2">
            {imported ? (
              <div className="rounded-lg border border-lime/40 bg-lime/10 px-2.5 py-2">
                <p className="font-poppins text-xs font-semibold text-forest">
                  ✅ Terrain importé du cadastre
                </p>
                <p className="font-raleway text-[11px] text-forest/70">
                  Parcelle {imported.parcelIds.map(formatParcelId).join(' + ')} ·{' '}
                  {imported.contenanceM2} m²
                  {horsBati !== null && <> · hors bâti ≈ {horsBati} m²</>}
                </p>
              </div>
            ) : (
              <>
                {cadastreAvailable && (
                  <>
                    <button
                      onClick={onOpenCadastre}
                      className="flex flex-col items-center gap-0.5 rounded-lg bg-lime hover:bg-lime-hover px-2 py-2 shadow-cta transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-poppins font-semibold text-xs text-forest">
                        <Map size={13} aria-hidden />
                        Retrouver mon terrain sur le cadastre
                      </span>
                      <span className="font-raleway text-[10px] text-forest/70">
                        {addressLabel || 'Indique ton adresse'}
                      </span>
                    </button>
                    <p className="text-center font-raleway text-[10px] text-forest/40">
                      ou renseigne-le à la main
                    </p>
                  </>
                )}
                <p className="font-raleway text-xs text-forest/70 leading-snug">
                  Renseigne les dimensions et l&apos;orientation de ton terrain. Le sol, la pente
                  et le climat s&apos;affinent dans l&apos;onglet « Jardin ».
                </p>
              </>
            )}
            <div className="flex gap-2">
              <label className="flex-1 flex flex-col gap-0.5">
                <span className="font-raleway text-[10px] text-forest/50">Largeur (m)</span>
                <input
                  type="number" min={1} max={500}
                  value={config.widthMeters}
                  onChange={e => onConfigChange({ widthMeters: Number(e.target.value) })}
                  className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </label>
              <label className="flex-1 flex flex-col gap-0.5">
                <span className="font-raleway text-[10px] text-forest/50">Longueur (m)</span>
                <input
                  type="number" min={1} max={500}
                  value={config.heightMeters}
                  onChange={e => onConfigChange({ heightMeters: Number(e.target.value) })}
                  className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </label>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="font-raleway text-[10px] text-forest/50">Orientation</span>
              <select
                value={config.orientation}
                onChange={e => onConfigChange({ orientation: e.target.value as GardenOrientation })}
                className="border border-border rounded-lg px-2 py-1 font-raleway text-xs text-forest bg-white focus:outline-none focus:ring-1 focus:ring-lime"
              >
                {ORIENTATIONS.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>
            {imported ? (
              <div className="flex items-center justify-between gap-2">
                <p className="font-raleway text-[11px] text-forest/50">
                  📐 Surface retenue :{' '}
                  <b className="text-forest">{horsBati ?? imported.contenanceM2} m²</b>
                </p>
                <button
                  onClick={onOpenCadastre}
                  className="font-raleway text-[10px] text-forest/60 underline hover:text-forest"
                >
                  Modifier l&apos;import
                </button>
              </div>
            ) : (
              <p className="font-raleway text-[11px] text-forest/50">
                📐 Surface : <b className="text-forest">{config.widthMeters * config.heightMeters} m²</b>
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <p className="font-raleway text-xs text-forest/70 leading-snug">
            {imported
              ? 'Ton terrain et ta maison sont en place. Pose maintenant les zones — '
              : 'Pose les zones structurantes — '}
            <b className="text-forest">terrasse, potager, point d&apos;eau, pelouse, allée</b>
            {' '}— depuis la palette de gauche. Les zones passent automatiquement en
            arrière-plan, et tu peux déformer leur contour en glissant les poignées
            (et les « + » pour ajouter un côté).
          </p>
        )}

        {step === 3 && (
          <p className="font-raleway text-xs text-forest/70 leading-snug">
            Ajoute tes <b className="text-forest">arbres et plantes</b> — par glisser-déposer
            depuis la palette, ou avec le bouton « Ajouter une plante » en haut à droite du plan.
          </p>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2">
            <p className="font-raleway text-xs text-forest/70 leading-snug">
              Annote ton plan : rappels d&apos;entretien, idées d&apos;aménagement,
              contraintes du terrain.
            </p>
            <button
              onClick={onActivateComments}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-lime/30 hover:bg-lime/50 py-1.5 font-poppins font-semibold text-xs text-forest transition-colors"
            >
              <MessageSquarePlus size={13} aria-hidden />
              Activer l&apos;outil commentaire
            </button>
          </div>
        )}
      </div>

      {/* Pied — navigation */}
      <div className="flex items-center justify-between gap-2 border-t border-forest/10 px-3 py-2">
        <button
          onClick={() => onStepChange(step - 1)}
          disabled={step === 1}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 font-poppins text-xs transition-colors',
            step === 1 ? 'text-forest/25 cursor-not-allowed' : 'text-forest/70 hover:bg-sand',
          )}
        >
          <ChevronLeft size={14} aria-hidden /> Précédent
        </button>
        {step < 4 ? (
          <button
            onClick={() => onStepChange(step + 1)}
            className="flex items-center gap-1 rounded-lg bg-forest hover:bg-forest-light px-3 py-1.5 font-poppins font-semibold text-xs text-white transition-colors"
          >
            Suivant <ChevronRight size={14} aria-hidden />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="flex items-center gap-1 rounded-lg bg-lime hover:bg-lime-hover px-3 py-1.5 font-poppins font-semibold text-xs text-forest shadow-cta transition-colors"
          >
            <Check size={14} aria-hidden /> Terminer
          </button>
        )}
      </div>
    </div>
  )
}
