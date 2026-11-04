import { cn } from '@/lib/utils'

/**
 * Le loader de marque : la pousse du logo, animée.
 *
 * Trois mouvements, chacun pour un usage (maquettes : Claude Design
 * « Growi — Loader pousse ») :
 *
 * - `pousse` — la tige monte, les feuilles s'ouvrent puis s'effacent. Attentes
 *   longues : identification, diagnostic, génération.
 * - `balance` — la pousse se balance depuis le pied. Une page ou une liste qui
 *   tarde au-delà de deux secondes.
 * - `souffle` — les feuilles respirent. Petites tailles (< 24 px), dans un
 *   bouton : un balancement à cette taille se lit comme un tremblement.
 *
 * Les animations sont en CSS (`globals.css`, `.growi-loader`) : aucun JS,
 * rendu serveur possible, et `prefers-reduced-motion` fige la pousse entière.
 *
 * Le tracé reprend l'icône de l'app (`apps/mobile/assets/icon.png`, viewBox
 * 1024) ; le mobile en a la copie dans `components/ui/GrowiLoader.tsx`.
 */

export type GrowiLoaderMotion = 'pousse' | 'balance' | 'souffle'
/** Le fond sur lequel la pousse est posée. */
export type GrowiLoaderTone = 'sand' | 'lime' | 'forest'

const TONES: Record<GrowiLoaderTone, { leaf: string; vein: string }> = {
  sand: { leaf: '#1E5631', vein: '#9CC86E' },
  lime: { leaf: '#1E5631', vein: '#B4DD7F' },
  forest: { leaf: '#B4DD7F', vein: '#2d7a47' },
}

export const LEAF_LEFT =
  'M 512 528 C 498 420, 400 296, 207 278 C 197 400, 234 505, 318 550 C 388 586, 464 578, 512 562 Z'
export const LEAF_RIGHT =
  'M 512 528 C 526 420, 624 296, 817 278 C 827 400, 790 505, 706 550 C 636 586, 560 578, 512 562 Z'

interface GrowiLoaderProps {
  motion?: GrowiLoaderMotion
  tone?: GrowiLoaderTone
  /** Côté en px. */
  size?: number
  /**
   * Ce que lit un lecteur d'écran. `null` quand un texte voisin dit déjà ce
   * qui se passe : la pousse n'est alors qu'un ornement.
   */
  label?: string | null
  className?: string
}

export function GrowiLoader({
  motion = 'balance',
  tone = 'sand',
  size = 48,
  label = 'Chargement en cours',
  className,
}: GrowiLoaderProps) {
  const { leaf, vein } = TONES[tone]
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const)

  return (
    <svg
      viewBox="182 222 660 660"
      width={size}
      height={size}
      className={cn('growi-loader overflow-visible', `growi-loader--${motion}`, className)}
      {...a11y}
    >
      <g className="gl-plant">
        <path
          className="gl-stem"
          d="M 512 833 L 512 530"
          stroke={leaf}
          strokeWidth={46}
          strokeLinecap="round"
          fill="none"
        />
        <g className="gl-leaves">
          <g className="gl-leaf-l">
            <path d={LEAF_LEFT} fill={leaf} />
            <path className="gl-vein" d="M 488 527 L 275 338" stroke={vein} strokeWidth={16} strokeLinecap="round" fill="none" />
          </g>
          <g className="gl-leaf-r">
            <path d={LEAF_RIGHT} fill={leaf} />
            <path className="gl-vein" d="M 536 527 L 749 338" stroke={vein} strokeWidth={16} strokeLinecap="round" fill="none" />
          </g>
        </g>
      </g>
    </svg>
  )
}
