import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  formatSapAmount,
  sapEntryLabel,
  sapFormingLine,
  sapRingsLabel,
  type SapSummary,
} from '@growi/shared'

import { formatSapDay } from './format'
import { GiftDrops, SapDrop } from './SapDrop'
import { SapProgressBar, TrunkRings } from './TrunkRings'

/**
 * « Ta sève » sur l'accueil du tableau de bord — la carte de l'app mobile :
 * la coupe en vignette, le total, le cerne qui se forme, le dernier gain et
 * les gouttes qu'il reste à offrir.
 *
 * La carte mène à « Ta sève » ; la ligne des gouttes, à la Communauté, où
 * l'on trouve à qui les offrir.
 */
export function SapCard({ summary, communityEnabled }: { summary: SapSummary; communityEnabled: boolean }) {
  const { total, rings, recent, giftsLeft, giftsPerWeek } = summary
  const last = recent[0]

  const giftsTitle =
    giftsLeft === 0
      ? 'Tes gouttes de la semaine sont offertes'
      : `${giftsLeft} goutte${giftsLeft > 1 ? 's' : ''} à offrir cette semaine`
  const giftsHint =
    giftsLeft === 0
      ? 'Elles reviennent lundi.'
      : communityEnabled
        ? 'Remercie un voisin pour un conseil ou une bouture'
        : 'Active ton profil public pour remercier tes voisins'

  return (
    <section aria-labelledby="sap-card-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="sap-card-title" className="font-poppins text-lg font-semibold text-forest">
          Ta sève
        </h2>
        <Link
          href="/dashboard/seve"
          className="inline-flex items-center gap-1 rounded font-raleway text-sm font-semibold text-forest-light hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          Voir tes cernes
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-card">
        <Link
          href="/dashboard/seve"
          className="flex items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          <TrunkRings count={rings.count} progress={rings.progress} size={72} label={sapRingsLabel(rings)} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-baseline gap-1.5">
              <span className="font-poppins text-[26px] font-bold leading-none text-forest">{total}</span>
              <span className="font-raleway text-sm font-medium text-forest/60">de sève</span>
            </span>
            <span className="font-raleway text-[13px] font-medium text-forest/60">{sapFormingLine(rings)}</span>
            <SapProgressBar progress={rings.progress} />
          </span>
        </Link>

        <div className="h-px bg-sand-dark" />

        {last ? (
          <p className="flex items-center gap-2.5 font-raleway text-sm text-forest">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime/30">
              <SapDrop size={18} />
            </span>
            <span>
              <strong className="font-bold">
                {formatSapAmount(last.amount)} {formatSapDay(last.createdAt)}.
              </strong>{' '}
              {sapEntryLabel(last)}
            </span>
          </p>
        ) : (
          <p className="font-raleway text-sm text-forest/60">
            Chaque geste noté fait monter ta sève — le premier arrosage suffit 🌱
          </p>
        )}

        <Link
          href="/dashboard/communaute"
          className="flex items-center gap-3 rounded-xl border border-sand-dark bg-sand px-4 py-3 transition-colors hover:bg-sand-dark/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          <GiftDrops left={giftsLeft} perWeek={giftsPerWeek} />
          <span className="flex flex-1 flex-col">
            <span className="font-raleway text-sm font-semibold text-forest">{giftsTitle}</span>
            <span className="font-raleway text-xs text-forest/60">{giftsHint}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="text-forest" />
        </Link>
      </div>
    </section>
  )
}

/** Même silhouette que la carte, pour que rien ne saute à l'arrivée. */
export function SapCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-7 w-32 animate-pulse rounded-lg bg-sand-dark" />
      <div className="h-[236px] animate-pulse rounded-2xl bg-sand-dark" />
    </div>
  )
}
