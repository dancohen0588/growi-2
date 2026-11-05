'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { BookOpen, FlaskConical, MessageCircleQuestion, Sparkles, type LucideIcon } from 'lucide-react'
import { SECRET_VERDICT_LABELS, SECRET_VERDICTS, type SecretStage, type SecretVerdict } from '@growi/shared'

import { Button } from '@/components/ui/button'
import { useTrack } from '@/lib/analytics/client'
import type { SecretAction } from '@/lib/secrets/display'
import { cn } from '@/lib/utils'
import { EvidenceBadge } from './EvidenceBadge'
import { PAPER_CLASS, PAPER_INSET } from './paper'

const EYEBROW: Record<SecretStage, { icon: LucideIcon; label: string }> = {
  discover: { icon: Sparkles, label: 'Secret de jardinier · cette semaine' },
  ready: { icon: FlaskConical, label: 'Ta préparation est prête' },
  feedback: { icon: MessageCircleQuestion, label: 'Ça a marché ?' },
}

interface SecretCardProps {
  action: SecretAction
  /** Un geste est en cours sur ce secret : les boutons attendent. */
  pending?: boolean
  onOpen: (action: SecretAction) => void
  onReadyDone: (action: SecretAction) => void
  onFeedback: (action: SecretAction, verdict: SecretVerdict) => void
}

/**
 * La carte d'un secret, en tête du planning, sur son papier de carnet.
 *
 * Trois moments, trois cartes :
 * - **découverte** — l'accroche seule et le badge de preuve ; le titre et la
 *   recette attendent qu'on ouvre la popin, qui vaut dévoilement ;
 * - **préparation prête** — le titre, le rappel, « C'est fait » ;
 * - **« Ça a marché ? »** — trois réponses, d'un tap, sans ouvrir de popin.
 *
 * `tip_shown` part une fois par carte, quand elle est à l'écran.
 */
export function SecretCard({ action, pending = false, onOpen, onReadyDone, onFeedback }: SecretCardProps) {
  const { secret } = action
  const track = useTrack()
  const shown = useRef<string | null>(null)

  useEffect(() => {
    if (shown.current === action.id) return
    shown.current = action.id
    track('tip_shown', { slug: secret.slug, evidence: secret.evidence, stage: secret.stage })
  }, [action.id, secret.slug, secret.evidence, secret.stage, track])

  const { icon: Icon, label } = EYEBROW[secret.stage]
  const headingId = `secret-${action.id}`
  const plant = action.plantName ? (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{action.plantEmoji || '🌿'}</span>
      {action.plantName}
    </span>
  ) : null

  return (
    <article aria-labelledby={headingId} className={cn(PAPER_CLASS, 'flex flex-col gap-3 rounded-2xl py-4', PAPER_INSET)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-poppins text-xs font-semibold uppercase tracking-wider text-forest/70">
          <Icon size={14} aria-hidden />
          {label}
        </p>
        <EvidenceBadge evidence={secret.evidence} />
      </div>

      {secret.stage === 'discover' ? (
        <>
          {/* Le titre reste caché : l'intitulé accessible est l'accroche. */}
          <h3 id={headingId} className="font-raleway text-lg italic leading-snug text-forest">
            «&nbsp;{secret.teaser}&nbsp;»
          </h3>
          {plant && <p className="font-raleway text-sm text-forest/70">Pour {plant}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <Button variant="forest" size="sm" disabled={pending} onClick={() => onOpen(action)}>
              <Sparkles size={15} aria-hidden />
              Découvrir le secret
            </Button>
            <GrimoireLink />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h3 id={headingId} className="font-poppins text-base font-semibold leading-snug text-forest">
              {secret.title}
            </h3>
            {plant && <p className="font-raleway text-sm text-forest/70">{plant}</p>}
          </div>
          {action.why && <p className="font-raleway text-sm leading-relaxed text-forest/80">{action.why}</p>}

          {secret.stage === 'ready' ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" size="sm" disabled={pending} onClick={() => onReadyDone(action)}>
                ✓ C&apos;est fait
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpen(action)}>
                Revoir la recette
              </Button>
            </div>
          ) : (
            <VerdictButtons
              label={`Ton avis sur « ${secret.title} »`}
              disabled={pending}
              onVerdict={(verdict) => onFeedback(action, verdict)}
            />
          )}
        </>
      )}
    </article>
  )
}

export function GrimoireLink({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard/grimoire"
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg font-raleway text-sm font-semibold text-forest/75 underline underline-offset-2 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2',
        className,
      )}
    >
      <BookOpen size={15} aria-hidden />
      Mon grimoire
    </Link>
  )
}

/** Les trois réponses à « Ça a marché ? » — groupées, et nommées comme telles. */
export function VerdictButtons({
  label,
  disabled,
  onVerdict,
}: {
  label: string
  disabled?: boolean
  onVerdict: (verdict: SecretVerdict) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2 pt-1">
      {SECRET_VERDICTS.map((verdict) => (
        <Button
          key={verdict}
          variant={verdict === 'WORKED' ? 'primary' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => onVerdict(verdict)}
        >
          {SECRET_VERDICT_LABELS[verdict]}
        </Button>
      ))}
    </div>
  )
}
