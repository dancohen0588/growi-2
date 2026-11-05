import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { TrackView } from '@/components/analytics/TrackView'
import { GrimoireEntryCard } from '@/components/dashboard/grimoire/GrimoireEntryCard'
import { PAPER_CLASS, PAPER_INSET } from '@/components/dashboard/secrets/paper'
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
    <div className="flex max-w-3xl flex-col gap-6">
      <TrackView
        event="grimoire_viewed"
        props={{ discovered: grimoire.discovered, total: grimoire.total }}
      />

      <div>
        <h1 className="font-poppins text-[1.75rem] font-bold text-forest">Mon grimoire 📖</h1>
        <p className="mt-1 font-raleway text-forest/70">
          Les secrets de jardinier que tu as découverts — et ceux qui t&apos;attendent encore.
        </p>
      </div>

      <div className={cn(PAPER_CLASS, 'flex flex-col gap-2 rounded-2xl py-4', PAPER_INSET)}>
        <p className="font-poppins text-lg font-semibold text-forest">
          {grimoire.discovered} / {grimoire.total} secret{grimoire.total > 1 ? 's' : ''} découvert
          {grimoire.discovered > 1 ? 's' : ''}
        </p>
        <div
          role="progressbar"
          aria-label="Secrets découverts"
          aria-valuemin={0}
          aria-valuemax={grimoire.total}
          aria-valuenow={grimoire.discovered}
          aria-valuetext={`${grimoire.discovered} sur ${grimoire.total}`}
          className="h-2 overflow-hidden rounded-full bg-forest/10"
        >
          <div className="h-full rounded-full bg-lime" style={{ width: `${percent}%` }} />
        </div>
        <p className="font-raleway text-sm text-forest/70">
          Un nouveau secret t&apos;attend chaque semaine dans ton{' '}
          <Link
            href="/dashboard/calendrier"
            className="font-semibold text-forest underline underline-offset-2 hover:text-forest/75"
          >
            calendrier
          </Link>
          .
        </p>
      </div>

      {grimoire.entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center font-raleway text-forest/70 shadow-card">
          Ton grimoire se remplira au fil des semaines. Reviens bientôt 🌱
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
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
