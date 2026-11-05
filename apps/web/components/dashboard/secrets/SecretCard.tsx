'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { BookOpen, FlaskConical, Leaf, MessageCircleQuestion, Sparkles, type LucideIcon } from 'lucide-react'
import {
  SECRET_VERDICT_LABELS,
  SECRET_VERDICTS,
  type SecretPlanche,
  type SecretStage,
  type SecretVerdict,
} from '@growi/shared'

import { useTrack } from '@/lib/analytics/client'
import { effortLabel, secretOpenLabel, type SecretAction } from '@/lib/secrets/display'
import { cn } from '@/lib/utils'
import { BD_CARD, BD_EYEBROW, BD_LIME_CTA, BD_ON_DARK_OUTLINE } from './bd'
import { EvidenceBadge } from './EvidenceBadge'
import { SecretArt } from './SecretArt'
import { SecretEmblem } from './SecretEmblem'

const EYEBROW: Record<SecretStage, { icon: LucideIcon | null; label: string }> = {
  discover: { icon: null, label: 'Secret de jardinier · cette semaine' },
  ready: { icon: FlaskConical, label: 'Ta préparation est prête' },
  feedback: { icon: MessageCircleQuestion, label: 'Ça a marché ?' },
}

/** L'avancement du grimoire, quand l'écran l'a sous la main. */
export interface GrimoireProgress {
  discovered: number
  total: number
}

interface SecretCardProps {
  action: SecretAction
  /** Un geste est en cours sur ce secret : les boutons attendent. */
  pending?: boolean
  grimoire?: GrimoireProgress | null
  className?: string
  onOpen: (action: SecretAction) => void
  onReadyDone: (action: SecretAction) => void
  onFeedback: (action: SecretAction, verdict: SecretVerdict) => void
}

/**
 * La carte d'un secret, en tête du planning — fond forest plein, emblème,
 * feuilles en filigrane (maquette Claude Design `Main`).
 *
 * Trois moments, trois cartes, un même habillage :
 * - **découverte** — l'accroche seule et le badge de preuve ; le titre et la
 *   recette attendent qu'on ouvre la planche (ou le secret en texte), ce qui
 *   vaut dévoilement. À droite, la vignette penchée : les cases réduites de la
 *   planche, ou l'emblème pour un secret pas encore dessiné ;
 * - **préparation prête** — le titre, le rappel, « C'est fait » ;
 * - **« Ça a marché ? »** — trois réponses, d'un tap, sans ouvrir de popin.
 *
 * `tip_shown` part une fois par carte, quand elle est à l'écran.
 */
export function SecretCard({
  action,
  pending = false,
  grimoire,
  className,
  onOpen,
  onReadyDone,
  onFeedback,
}: SecretCardProps) {
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
  const effort = effortLabel(secret.effortMinutes)
  const plantLine = [action.plantName && `Pour ${action.plantName}`, secret.stage === 'discover' && effort]
    .filter(Boolean)
    .join(' · ')

  const eyebrow = (
    <div className="flex flex-wrap items-center gap-3">
      <p className={cn(BD_EYEBROW, 'm-0 inline-flex items-center gap-1.5 text-lime')}>
        {Icon && <Icon size={15} aria-hidden />}
        {label}
      </p>
      <EvidenceBadge evidence={secret.evidence} tone="sun" />
    </div>
  )

  const plant = plantLine ? (
    <p className="m-0 flex items-center gap-2 font-raleway text-base text-[#DCEFC0]">
      <Leaf size={18} className="shrink-0 text-lime" aria-hidden />
      {plantLine}
    </p>
  ) : null

  if (secret.stage === 'discover') {
    return (
      <article
        aria-labelledby={headingId}
        className={cn(
          BD_CARD,
          'grid items-center gap-5 px-5 py-6 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-8 sm:px-9 sm:py-8 xl:grid-cols-[120px_minmax(0,1fr)_260px]',
          className,
        )}
      >
        <LeavesWatermark />
        <SecretEmblem
          variant="full"
          className="relative h-16 w-16 sm:h-[88px] sm:w-[88px] xl:h-[120px] xl:w-[120px]"
        />

        <div className="relative flex min-w-0 flex-col gap-3.5">
          {eyebrow}
          {/* Le titre reste caché : l'intitulé accessible est l'accroche. */}
          <h3
            id={headingId}
            className="m-0 font-poppins text-xl font-semibold leading-[1.3] text-white sm:text-2xl xl:text-[27px]"
          >
            {secret.teaser}
          </h3>
          {plant}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="button" className={BD_LIME_CTA} disabled={pending} onClick={() => onOpen(action)}>
              {secret.planche ? <BookOpen size={20} aria-hidden /> : <Sparkles size={20} aria-hidden />}
              {secretOpenLabel(secret)}
            </button>
            <GrimoireLink tone="dark" progress={grimoire} />
          </div>
        </div>

        <SecretThumbnail planche={secret.planche ?? null} className="hidden xl:flex" />
      </article>
    )
  }

  return (
    <article aria-labelledby={headingId} className={cn(BD_CARD, 'flex gap-4 p-5 sm:gap-5 sm:p-6', className)}>
      <LeavesWatermark />
      <SecretEmblem variant="full" className="relative hidden h-12 w-12 sm:inline-block" />
      <div className="relative flex min-w-0 flex-1 flex-col gap-3">
        {eyebrow}
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="m-0 font-poppins text-lg font-semibold leading-snug text-white">
            {secret.title}
          </h3>
          {plant}
        </div>
        {action.why && <p className="m-0 font-raleway text-sm leading-relaxed text-[#DCEFC0]">{action.why}</p>}

        {secret.stage === 'ready' ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className={BD_LIME_CTA} disabled={pending} onClick={() => onReadyDone(action)}>
              ✓ C&apos;est fait
            </button>
            <button type="button" className={BD_ON_DARK_OUTLINE} disabled={pending} onClick={() => onOpen(action)}>
              {secret.planche ? 'Revoir la planche' : 'Revoir la recette'}
            </button>
          </div>
        ) : (
          <VerdictButtons
            tone="dark"
            label={`Ton avis sur « ${secret.title} »`}
            disabled={pending}
            onVerdict={(verdict) => onFeedback(action, verdict)}
          />
        )}
      </div>
    </article>
  )
}

/** « Mon grimoire · 3 / 24 » — le compte seulement quand on l'a. */
export function GrimoireLink({
  className,
  tone = 'light',
  progress,
}: {
  className?: string
  tone?: 'light' | 'dark'
  progress?: GrimoireProgress | null
}) {
  return (
    <Link
      href="/dashboard/grimoire"
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        tone === 'dark'
          ? 'font-poppins text-[15px] font-semibold text-sand hover:text-lime focus-visible:ring-sun focus-visible:ring-offset-forest'
          : 'font-raleway text-sm font-semibold text-forest/75 hover:text-forest focus-visible:ring-lime',
        className,
      )}
    >
      {tone === 'light' && <BookOpen size={15} aria-hidden />}
      Mon grimoire
      {progress && progress.total > 0 && (
        <>
          <span aria-hidden> · {progress.discovered} / {progress.total}</span>
          <span className="sr-only">
            , {progress.discovered} secret{progress.discovered > 1 ? 's' : ''} découvert
            {progress.discovered > 1 ? 's' : ''} sur {progress.total}
          </span>
        </>
      )}
    </Link>
  )
}

/** Les trois réponses à « Ça a marché ? » — groupées, et nommées comme telles. */
export function VerdictButtons({
  label,
  disabled,
  tone = 'light',
  onVerdict,
}: {
  label: string
  disabled?: boolean
  tone?: 'light' | 'dark'
  onVerdict: (verdict: SecretVerdict) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2.5 pt-1">
      {SECRET_VERDICTS.map((verdict) => (
        <button
          key={verdict}
          type="button"
          disabled={disabled}
          onClick={() => onVerdict(verdict)}
          className={
            verdict === 'WORKED'
              ? tone === 'dark'
                ? BD_LIME_CTA
                : cn(BD_LIME_CTA, 'focus-visible:ring-forest focus-visible:ring-offset-[#FFFDF5]')
              : tone === 'dark'
                ? BD_ON_DARK_OUTLINE
                : 'inline-flex min-h-[44px] items-center rounded-[14px] border-2 border-forest bg-white px-5 py-2.5 font-poppins text-[15px] font-semibold text-forest hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60'
          }
        >
          {SECRET_VERDICT_LABELS[verdict]}
        </button>
      ))}
    </div>
  )
}

/** Les feuilles en filigrane de la carte — décor pur, hors de l'arbre accessible. */
function LeavesWatermark() {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1088 260"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
    >
      <g fill="none" stroke="#2d7a47" strokeWidth="2" strokeLinecap="round">
        <path d="M660 30 C680 10 708 8 724 20 C708 40 680 44 660 30 Z" />
        <path d="M660 30 L736 26" />
        <path d="M560 200 C584 186 612 190 624 206 C604 222 576 220 560 200 Z" />
        <path d="M560 200 L636 210" />
        <path d="M980 40 C996 22 1022 22 1034 36 C1018 54 994 54 980 40 Z" />
        <path d="M430 236 C446 220 470 222 480 236 C466 252 444 250 430 236 Z" />
        <circle cx="520" cy="40" r="3" />
        <circle cx="900" cy="226" r="3" />
        <circle cx="1050" cy="150" r="3" />
        <circle cx="300" cy="22" r="3" />
      </g>
    </svg>
  )
}

/**
 * La vignette penchée de la carte : deux cases en haut, une large en bas avec
 * le point d'interrogation — la planche en miniature, qui donne envie de
 * l'ouvrir sans la livrer. Sans planche, l'emblème la remplace.
 */
function SecretThumbnail({ planche, className }: { planche: SecretPlanche | null; className?: string }) {
  const panels = planche?.panels ?? []
  const top = panels.slice(0, 2)
  const bottom = panels[2]
  const cell = 'flex items-center justify-center overflow-hidden rounded-md border-[3px] border-forest bg-white'

  return (
    <div
      aria-hidden
      className={cn(
        'relative h-[200px] w-[260px] rotate-3 items-center justify-center overflow-hidden rounded-[20px] bg-sand p-3 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      {top.length === 0 ? (
        <SecretEmblem variant="full" decorative className="h-28 w-28" />
      ) : (
        <div className="grid h-full w-full grid-rows-2 gap-2">
          <div className={cn('grid gap-2', top.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {top.map((panel, index) => (
              <div key={`${index}-${panel.art}`} className={cell}>
                <SecretArt artKey={panel.art} className="aspect-[4/3] h-full" />
              </div>
            ))}
          </div>
          <div className={cn(cell, 'justify-between gap-2 px-4')}>
            <span className="font-poppins text-[40px] font-extrabold leading-none text-forest">?</span>
            {bottom && <SecretArt artKey={bottom.art} className="aspect-[4/3] h-full" />}
          </div>
        </div>
      )}
    </div>
  )
}
