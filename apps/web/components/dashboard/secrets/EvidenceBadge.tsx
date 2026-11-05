import { BadgeCheck, ScrollText, SearchCheck, Sprout, type LucideIcon } from 'lucide-react'
import { SECRET_EVIDENCE_HINTS, SECRET_EVIDENCE_LABELS, type SecretEvidence } from '@growi/shared'

import { cn } from '@/lib/utils'

/**
 * Le niveau de preuve d'un secret — **toujours visible**, dès la carte
 * (décision du 05/11/2026). Le mystère vient du dévoilement, jamais d'une
 * promesse : un remède sans effet présenté comme sûr fait perdre la confiance
 * au premier échec.
 *
 * La couleur n'est qu'un renfort : le mot et l'icône portent le sens seuls,
 * et le texte reste forest sur fond clair, quelle que soit la teinte.
 */
const STYLES: Record<SecretEvidence, { icon: LucideIcon; className: string }> = {
  PROVEN: { icon: BadgeCheck, className: 'bg-lime/40 text-forest' },
  PLAUSIBLE: { icon: Sprout, className: 'bg-sun/35 text-forest' },
  FOLK: { icon: ScrollText, className: 'bg-forest/10 text-forest' },
  MYTH: { icon: SearchCheck, className: 'bg-white text-forest ring-1 ring-inset ring-forest/25' },
}

interface EvidenceBadgeProps {
  evidence: SecretEvidence
  /**
   * `sun` : la pastille pleine de la direction « planche » (carte forest,
   * planche). Le texte reste forest sur sun — contraste 6,9:1.
   */
  tone?: 'soft' | 'sun'
  /** Ajoute la phrase qui dit ce que vaut le badge — dans le détail seulement. */
  withHint?: boolean
  className?: string
}

export function EvidenceBadge({ evidence, tone = 'soft', withHint = false, className }: EvidenceBadgeProps) {
  const { icon: Icon, className: toneClass } = STYLES[evidence]
  const label = SECRET_EVIDENCE_LABELS[evidence]

  const badge = (
    <span
      className={cn(
        tone === 'sun'
          ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sun py-[5px] pl-2.5 pr-3 font-poppins text-[13px] font-semibold text-forest'
          : cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-raleway text-xs font-semibold', toneClass),
        !withHint && className,
      )}
      // Sans la phrase à côté, l'infobulle la donne à qui la cherche.
      title={withHint ? undefined : SECRET_EVIDENCE_HINTS[evidence]}
    >
      <Icon size={tone === 'sun' ? 15 : 13} aria-hidden />
      <span>
        <span className="sr-only">Niveau de preuve : </span>
        {label}
      </span>
    </span>
  )

  if (!withHint) return badge

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      {badge}
      <p className="font-raleway text-xs leading-relaxed text-forest/70">{SECRET_EVIDENCE_HINTS[evidence]}</p>
    </div>
  )
}
