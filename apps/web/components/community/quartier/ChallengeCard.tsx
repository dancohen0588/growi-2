import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import type { Quartier, QuartierActionTarget } from '@growi/shared'

import { SapProgressBar } from '@/components/dashboard/seve/TrunkRings'

type Challenge = NonNullable<Quartier['challenge']>

/** Où mène le bouton du défi sur le web. Une photo se publie depuis l'app. */
const ACTION_HREFS: Record<QuartierActionTarget, string | null> = {
  calendrier: '/dashboard/calendrier',
  plantes: '/dashboard/plantes',
  publier: null,
  bourse: '/dashboard/communaute/bourse',
  communaute: '/dashboard/communaute',
}

function daysLeftLabel(days: number): string {
  return days <= 1 ? 'dernier jour' : `encore ${days} jours`
}

function participationLine(challenge: Challenge): string {
  const who =
    challenge.participants === 0
      ? 'Personne n’a encore commencé'
      : `${challenge.participants} jardinier${challenge.participants > 1 ? 's' : ''} participe${challenge.participants > 1 ? 'nt' : ''}`
  return challenge.mine > 0 ? `${who} · ta part : ${challenge.mine}` : who
}

/** Le défi de la semaine, en grand — le haut de « Ton quartier ». Même écran que l'app. */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const progress = Math.min(1, challenge.progress / challenge.target)
  const href = ACTION_HREFS[challenge.action.target]

  return (
    <section aria-labelledby="quartier-challenge" className="flex flex-col gap-4 rounded-3xl bg-forest p-6 text-sand">
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-forest-light/70 px-3 py-1.5 font-raleway text-xs font-semibold text-[#E6F0DA]">
        <span className="h-2 w-2 rounded-full bg-sun" aria-hidden />
        Défi de la semaine · {daysLeftLabel(challenge.daysLeft)}
      </span>

      <h2 id="quartier-challenge" className="font-poppins text-2xl font-bold">
        {challenge.title}
      </h2>

      <div className="flex flex-col gap-2">
        <p className="m-0 flex items-baseline gap-2">
          <span className="font-poppins text-[32px] font-bold leading-none text-lime">{challenge.progress}</span>
          <span className="font-raleway font-medium text-[#E6F0DA]">
            / {challenge.target} {challenge.unitLabel}
          </span>
        </p>
        <SapProgressBar progress={progress} onDark />
      </div>

      <p className="m-0 flex items-center gap-3 font-raleway text-sm text-[#E6F0DA]">
        {challenge.participantInitials.length > 0 ? (
          <span className="flex" aria-hidden>
            {challenge.participantInitials.map((initial, index) => (
              <span
                key={index}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-forest bg-lime font-poppins text-xs font-bold text-forest"
                style={{ marginLeft: index === 0 ? 0 : -8 }}
              >
                {initial}
              </span>
            ))}
          </span>
        ) : null}
        {participationLine(challenge)}
      </p>

      <div className="flex flex-col gap-1 rounded-xl bg-forest-light/60 p-4">
        <span className="font-raleway text-xs font-bold uppercase tracking-widest text-lime">
          {challenge.reached ? 'Objectif atteint !' : 'Si on y arrive ensemble'}
        </span>
        <p className="m-0 font-raleway text-sm">
          {challenge.reached
            ? `Lundi matin, chaque participant reçoit ${challenge.successSap + challenge.participationSap} de sève, et tout le quartier découvre un Secret inédit. Tu peux encore ajouter ta part.`
            : `Tout le quartier découvre un Secret inédit, et chaque participant gagne ${challenge.successSap} de sève. Même si on n’y arrive pas, ta participation compte : +${challenge.participationSap}.`}
        </p>
      </div>

      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-lime px-6 font-poppins font-bold text-forest shadow-cta transition hover:bg-lime-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
        >
          {challenge.action.label}
        </Link>
      ) : (
        <p className="m-0 rounded-xl bg-forest-light/60 p-3 text-center font-raleway text-sm text-[#E6F0DA]">
          Les photos se publient depuis l’app Growi.
        </p>
      )}
    </section>
  )
}

/** Le défi en une ligne, en tête du fil de la Communauté. */
export function ChallengeBanner({ challenge }: { challenge: Challenge }) {
  const progress = Math.min(1, challenge.progress / challenge.target)
  return (
    <Link
      href="/dashboard/communaute/quartier"
      className="flex flex-col gap-2.5 rounded-2xl bg-forest p-4 text-sand transition hover:bg-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <span className="flex items-center gap-2 font-raleway text-xs font-semibold uppercase tracking-widest text-lime">
        <Users size={16} aria-hidden />
        <span className="flex-1">Ton quartier · {daysLeftLabel(challenge.daysLeft)}</span>
        <ChevronRight size={18} aria-hidden className="text-sand" />
      </span>
      <span className="font-poppins font-semibold">{challenge.title}</span>
      <span className="flex items-center gap-3">
        <span className="flex-1">
          <SapProgressBar progress={progress} onDark />
        </span>
        <span className="font-raleway text-xs font-semibold text-[#E6F0DA]">
          {challenge.progress} / {challenge.target}
        </span>
      </span>
    </Link>
  )
}
