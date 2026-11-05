'use client'

import { ScrollText } from 'lucide-react'
import {
  LUNAR_COURSE_ADVICE,
  LUNAR_DAY_ADVICE,
  LUNAR_DAY_LABELS,
  LUNAR_PHASE_EMOJIS,
  LUNAR_PHASE_LABELS,
  type LunarDay,
} from '@growi/shared'

interface LunarBannerProps {
  lunar: LunarDay
  /** « Ne plus afficher » — coupe l'option du compte, pas seulement le bandeau. */
  onDisable?: () => void
  disabling?: boolean
}

/**
 * Le jour lunaire, en haut du calendrier, quand l'option est active.
 *
 * Le badge « Tradition » est **permanent** (décision du 05/11/2026) : aucune
 * preuve n'établit l'effet de la Lune sur les cultures, et le bandeau ne doit
 * jamais se lire comme une consigne au même titre que l'arrosage d'en dessous.
 * D'où aussi le fond forest, distinct des cartes du planning.
 */
export function LunarBanner({ lunar, onDisable, disabling = false }: LunarBannerProps) {
  const phase = LUNAR_PHASE_LABELS[lunar.phase]
  const day = LUNAR_DAY_LABELS[lunar.dayType]
  const course = lunar.ascending ? LUNAR_COURSE_ADVICE.ascending : LUNAR_COURSE_ADVICE.descending

  return (
    <section
      aria-labelledby="lunar-banner-title"
      className="flex gap-4 rounded-2xl bg-forest px-4 py-4 text-sand shadow-card sm:px-5"
    >
      <span className="text-4xl leading-none" role="img" aria-label={phase}>
        {LUNAR_PHASE_EMOJIS[lunar.phase]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="lunar-banner-title" className="font-poppins text-base font-bold text-sand">
            {day}
          </h2>
          <span className="font-raleway text-sm text-sand/80">
            · {phase} · lune {lunar.ascending ? 'montante' : 'descendante'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sand/15 px-2 py-0.5 font-raleway text-xs font-semibold text-sand ring-1 ring-inset ring-sand/30">
            <ScrollText size={12} aria-hidden />
            Tradition
          </span>
        </div>

        <p className="font-raleway text-sm leading-relaxed text-sand/90">{LUNAR_DAY_ADVICE[lunar.dayType]}</p>
        <p className="font-raleway text-xs leading-relaxed text-sand/75">{course}</p>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-raleway text-xs text-sand/70">
          <span>Une tradition de jardinier, sans preuve scientifique : à suivre pour le plaisir.</span>
          {onDisable && (
            <button
              type="button"
              onClick={onDisable}
              disabled={disabling}
              className="font-semibold text-sand underline underline-offset-2 hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime disabled:opacity-60"
            >
              Ne plus afficher
            </button>
          )}
        </p>
      </div>
    </section>
  )
}
