import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sprout } from 'lucide-react'

import { auth } from '@/auth'
import { CommunityEmpty, MoreLink } from '@/components/community/bits'
import { listThreads } from '@/lib/services/community/listing.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Messages — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const raw = searchParams.apres
  const cursor = (Array.isArray(raw) ? raw[0] : raw) ?? null
  const page = await listThreads(session.user.id, cursor)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Messages</h1>
        <Link
          href="/dashboard/communaute/bourse"
          className="rounded-lg border border-forest/15 bg-white px-3 py-2 font-raleway text-sm text-forest hover:bg-sand"
        >
          Voir la bourse
        </Link>
      </header>

      {page.items.length === 0 ? (
        <CommunityEmpty
          emoji="💬"
          title="Tes échanges apparaîtront ici"
          hint="Réponds à une annonce de la bourse, ou publie la tienne depuis l’app mobile."
        />
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {page.items.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/dashboard/communaute/messages/${thread.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-white p-3 hover:bg-sand/50"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand-dark">
                    {thread.listingPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thread.listingPhotoUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Sprout size={20} className="text-forest" aria-hidden />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate font-raleway text-forest',
                        thread.unread && 'font-semibold',
                      )}
                    >
                      {thread.other.handle}
                    </span>
                    <span className="block truncate font-raleway text-xs text-forest/50">
                      {thread.listingTitle}
                    </span>
                    {thread.lastMessage && (
                      <span
                        className={cn(
                          'block truncate font-raleway text-sm',
                          thread.unread ? 'text-forest' : 'text-forest/60',
                        )}
                      >
                        {thread.lastMessage}
                      </span>
                    )}
                  </span>

                  {thread.unread && (
                    <span
                      aria-label="Non lu"
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {page.nextCursor && (
            <MoreLink href={`/dashboard/communaute/messages?apres=${page.nextCursor}`} />
          )}
        </div>
      )}
    </div>
  )
}
