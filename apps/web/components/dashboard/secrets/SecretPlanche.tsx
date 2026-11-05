import {
  SECRET_EVIDENCE_HINTS,
  SECRET_EVIDENCE_LABELS,
  type SecretEvidence,
  type SecretPlanche as SecretPlancheData,
} from '@growi/shared'

import { splitEmphasis } from '@/lib/secrets/display'
import { cn } from '@/lib/utils'
import { BD_EYEBROW, PANEL_TINTS } from './bd'
import { SecretArt } from './SecretArt'

/**
 * Colonnes des cases dès 720 px — écrites en toutes lettres, sans quoi
 * Tailwind ne les génère pas. En dessous, les cases s'empilent.
 */
const WIDE_COLUMNS: Record<number, string> = {
  1: 'min-[720px]:grid-cols-1',
  2: 'min-[720px]:grid-cols-2',
  3: 'min-[720px]:grid-cols-3',
  4: 'min-[720px]:grid-cols-2 lg:grid-cols-4',
}

interface SecretPlancheProps {
  planche: SecretPlancheData
  story?: string | null
  ingredients: string[]
  evidence: SecretEvidence
  /**
   * Le texte des précautions du secret : affiché dans la case forest quand la
   * planche n'en dessine pas — une précaution ne se perd jamais en route.
   */
  cautions?: string | null
  /**
   * `wide` : la planche ouverte, cases côte à côte dès 720 px.
   * `compact` : le grimoire et l'aperçu admin, colonnes étroites — chaque
   * case met son dessin à côté de sa légende.
   */
  layout?: 'wide' | 'compact'
  headingLevel?: 'h3' | 'h4'
}

/**
 * Le corps d'une planche : le récit (encadré jaune), ce qu'il te faut, les
 * cases numérotées, la case de précaution. L'en-tête et les boutons
 * appartiennent à l'appelant — la popin du calendrier, le grimoire, l'admin.
 */
export function SecretPlanche({
  planche,
  story,
  ingredients,
  evidence,
  cautions,
  layout = 'wide',
  headingLevel = 'h3',
}: SecretPlancheProps) {
  const wide = layout === 'wide'
  const Heading = headingLevel
  const hint = `${SECRET_EVIDENCE_LABELS[evidence]} : ${lowerFirst(SECRET_EVIDENCE_HINTS[evidence])}`
  const caution = planche.caution ?? (cautions ? { art: null, title: 'Précautions', text: cautions, tone: 'warning' as const } : null)

  return (
    <div className={cn('flex flex-col', wide ? 'gap-[22px]' : 'gap-4')}>
      <div className={cn('grid items-stretch gap-5', wide && story && 'md:grid-cols-[minmax(0,1fr)_300px]')}>
        {story && (
          <p
            className={cn(
              'm-0 rounded-[4px] border-[3px] border-forest bg-sun font-raleway font-medium italic text-forest shadow-[5px_5px_0_#1E5631]',
              wide ? 'px-5 py-4 text-[17px] leading-relaxed' : 'px-4 py-3 text-[15px] leading-relaxed',
            )}
          >
            <span className="sr-only">L’histoire : </span>
            {story}
          </p>
        )}
        <div className="flex flex-col justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-lime-hover px-4 py-3">
          {ingredients.length > 0 && (
            <>
              <Heading className="m-0 font-poppins text-xs font-bold uppercase tracking-[0.1em] text-forest-light">
                Ce qu’il te faut
              </Heading>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {ingredients.map((ingredient) => (
                  <li key={ingredient} className="font-raleway text-base font-semibold text-forest">
                    {upperFirst(ingredient)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="m-0 font-raleway text-[13px] leading-snug text-[#4b6b55]">{hint}</p>
        </div>
      </div>

      <ol
        aria-label="Les étapes"
        className={cn(
          'm-0 grid list-none gap-[18px] p-0',
          wide ? cn('grid-cols-1', WIDE_COLUMNS[planche.panels.length]) : 'grid-cols-1',
        )}
      >
        {planche.panels.map((panel, index) => (
          <li key={`${index}-${panel.art}`} className="flex">
            <figure
              className={cn(
                'relative m-0 flex w-full overflow-hidden rounded-md border-4 border-forest',
                PANEL_TINTS[index % PANEL_TINTS.length],
                wide ? 'flex-col' : 'flex-row items-center gap-2 py-2 pr-2',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute z-[1] flex items-center justify-center rounded-full bg-forest font-poppins font-extrabold text-sun',
                  wide ? 'left-2.5 top-2.5 h-10 w-10 text-xl' : 'left-1.5 top-1.5 h-7 w-7 text-sm',
                )}
              >
                {index + 1}
              </span>
              {/* Décoratif : la légende juste en dessous le dit déjà, un texte
                  alternatif la ferait lire deux fois aux lecteurs d'écran. */}
              <SecretArt
                artKey={panel.art}
                className={cn('aspect-[4/3]', wide ? 'w-full' : 'w-28 shrink-0 sm:w-36')}
              />
              <figcaption
                className={cn(
                  'rounded-[4px] border-[3px] border-forest bg-white font-raleway font-medium text-forest',
                  wide ? 'mx-3 mb-3 mt-auto px-3 py-2.5 text-base leading-snug' : 'min-w-0 flex-1 px-2.5 py-2 text-sm leading-snug',
                )}
              >
                <span className="sr-only">Étape {index + 1} : </span>
                {splitEmphasis(panel.caption, panel.emphasis).map((segment, i) =>
                  segment.strong ? <strong key={i}>{segment.text}</strong> : <span key={i}>{segment.text}</span>,
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>

      {caution && (
        <aside
          aria-label="Précaution"
          className={cn(
            'grid items-center rounded-md border-4 border-forest bg-forest text-sand',
            caution.art && (wide ? 'sm:grid-cols-[220px_minmax(0,1fr)]' : 'sm:grid-cols-[140px_minmax(0,1fr)]'),
            wide ? 'gap-6 py-3.5 pl-3.5 pr-6' : 'gap-3 p-3',
          )}
        >
          {caution.art && (
            <SecretArt
              artKey={caution.art}
              className={cn('aspect-[22/13]', wide ? 'w-full max-w-[220px]' : 'w-full max-w-[140px]')}
            />
          )}
          <div className={cn('flex flex-col gap-1.5', !caution.art && 'px-2')}>
            <span className={cn(BD_EYEBROW, 'text-sun')}>{cautionEyebrow(caution)}</span>
            <p
              className={cn(
                'm-0 font-poppins font-semibold leading-snug text-sand',
                wide ? 'text-[22px]' : 'text-lg',
              )}
            >
              {caution.title}
            </p>
            <p className={cn('m-0 font-raleway leading-relaxed text-[#DCEFC0]', wide ? 'text-base' : 'text-sm')}>
              {caution.text}
            </p>
          </div>
        </aside>
      )}
    </div>
  )
}

/** « Attention » pour un risque, « À savoir » pour une mise en garde sur l'effet. */
const cautionEyebrow = (caution: { tone?: 'warning' | 'note' }) => (caution.tone === 'note' ? 'À savoir' : 'Attention')

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
