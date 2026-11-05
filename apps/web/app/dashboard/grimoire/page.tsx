import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { TrackView } from '@/components/analytics/TrackView'
import { GrimoireEntryCard } from '@/components/dashboard/grimoire/GrimoireEntryCard'
import { BD_CARD, BD_EYEBROW } from '@/components/dashboard/secrets/bd'
import { LeavesWatermark } from '@/components/dashboard/secrets/SecretCard'
import { SecretEmblem } from '@/components/dashboard/secrets/SecretEmblem'
import { getGrimoire } from '@/lib/services/secrets.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mon grimoire — Growi', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * Le grimoire : la collection des « Secrets de jardinier ».
 *
 * Un secret non découvert ne montre que son titre, son accroche et son badge
 * — la recette se mérite, en ouvrant le secret de la semaine dans le planning.
 * Les secrets mis de côté (« Pas pour moi ») y restent, avec de quoi changer
 * d'avis.
 */
export default async function GrimoirePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const grimoire = await getGrimoire(session.user.id)
  const percent = grimoire.total > 0 ? Math.round((grimoire.discovered / grimoire.total) * 100) : 0

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <TrackView
        event="grimoire_viewed"
        props={{ discovered: grimoire.discovered, total: grimoire.total }}
      />

      <div className="flex items-center gap-4">
        {/* L'emblème double le titre : décoratif, pour ne pas le lire deux fois. */}
        <SecretEmblem variant="full" decorative className="h-14 w-14 sm:h-16 sm:w-16" />
        <div>
          <h1 className="font-poppins text-[1.75rem] font-bold text-forest">Mon grimoire</h1>
          <p className="mt-1 font-raleway text-forest/70">
            Les secrets de jardinier que tu as découverts — et ceux qui t&apos;attendent encore.
          </p>
        </div>
      </div>

      <section aria-label="Ton avancement" className={cn(BD_CARD, 'flex flex-col gap-3 px-6 py-6 sm:px-8')}>
        <LeavesWatermark />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <p className="m-0 font-poppins text-white">
            <span className="text-[40px] font-extrabold leading-none">{grimoire.discovered}</span>
            <span className="text-xl font-bold text-[#DCEFC0]"> / {grimoire.total}</span>
            <span className="ml-2 text-lg font-semibold">
              secret{grimoire.discovered > 1 ? 's' : ''} découvert{grimoire.discovered > 1 ? 's' : ''}
            </span>
          </p>
          <p className={cn(BD_EYEBROW, 'm-0 text-lime')}>{percent} %</p>
        </div>
        <div
          role="progressbar"
          aria-label="Secrets découverts"
          aria-valuemin={0}
          aria-valuemax={grimoire.total}
          aria-valuenow={grimoire.discovered}
          aria-valuetext={`${grimoire.discovered} sur ${grimoire.total}`}
          className="relative h-3.5 overflow-hidden rounded-full border-2 border-[#DCEFC0]/50 bg-[#143D22]"
        >
          <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(percent, grimoire.discovered > 0 ? 4 : 0)}%` }} />
        </div>
        <p className="relative m-0 font-raleway text-[15px] text-[#DCEFC0]">
          Un nouveau secret t&apos;attend chaque semaine dans ton{' '}
          <Link
            href="/dashboard/calendrier"
            className="rounded font-poppins font-semibold text-sand underline underline-offset-4 hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            calendrier
          </Link>
          .
        </p>
      </section>

      {grimoire.entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center font-raleway text-forest/70 shadow-card">
          Ton grimoire se remplira au fil des semaines. Reviens bientôt 🌱
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {grimoire.entries.map((entry) => (
            <li key={entry.slug} className="flex">
              <GrimoireEntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
