import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import {
  LISTING_CATEGORY_LABELS,
  LISTING_KIND_LABELS,
  LISTING_SAFETY_NOTICE,
  LISTING_STATUS_LABELS,
} from '@growi/shared'

import { auth } from '@/auth'
import { AuthorLine, Tag } from '@/components/community/bits'
import { ListingActions } from '@/components/community/ListingActions'
import { getListing, listListingThreads } from '@/lib/services/community/listing.service'
import { isServiceError } from '@/lib/services/errors'

export const metadata: Metadata = {
  title: 'Annonce — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export default async function ListingPage({ params }: Params) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  let listing
  try {
    listing = await getListing(params.id, session.user.id)
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  // Les intéressés ne se chargent que pour l'auteur : le service refuserait de
  // toute façon, et le demander pour rien ferait une requête inutile.
  const threads = listing.isMine ? await listListingThreads(listing.id, session.user.id) : []

  const expires = new Date(listing.expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/communaute/bourse"
        className="font-raleway text-sm text-forest/60 hover:text-forest"
      >
        ← Retour à la bourse
      </Link>

      {listing.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.photoUrl}
          alt=""
          className="max-h-96 w-full rounded-2xl bg-sand-dark object-cover"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="lime">{LISTING_KIND_LABELS[listing.kind]}</Tag>
        <Tag>{LISTING_CATEGORY_LABELS[listing.category]}</Tag>
        {listing.status !== 'active' && (
          <Tag tone="sun">{LISTING_STATUS_LABELS[listing.status]}</Tag>
        )}
      </div>

      <h1 className="font-poppins text-2xl font-semibold text-forest">{listing.title}</h1>

      {listing.description && (
        <p className="whitespace-pre-wrap font-raleway text-forest/80">{listing.description}</p>
      )}

      <dl className="grid gap-3 rounded-2xl border border-forest/10 bg-white p-4 font-raleway text-sm sm:grid-cols-2">
        {listing.quantity && (
          <div>
            <dt className="text-forest/50">Quantité</dt>
            <dd className="text-forest">{listing.quantity}</dd>
          </div>
        )}
        {listing.wants && (
          <div>
            <dt className="text-forest/50">En échange de</dt>
            <dd className="text-forest">{listing.wants}</dd>
          </div>
        )}
        <div>
          <dt className="text-forest/50">Expire le</dt>
          <dd className="text-forest">{expires}</dd>
        </div>
      </dl>

      <div className="rounded-2xl border border-forest/10 bg-white p-4">
        <AuthorLine
          user={listing.author}
          suffix={listing.isMine ? 'Ton annonce' : undefined}
          size={44}
        />
      </div>

      <ListingActions
        listingId={listing.id}
        status={listing.status}
        isMine={listing.isMine}
        myThreadId={listing.myThreadId ?? null}
      />

      {listing.isMine && threads.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-poppins text-lg font-semibold text-forest">
            {threads.length} intéressé{threads.length > 1 ? 's' : ''}
          </h2>
          <ul className="space-y-2">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/dashboard/communaute/messages/${thread.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-white p-3 hover:bg-sand/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-raleway font-medium text-forest">
                      {thread.other.handle}
                    </span>
                    {thread.lastMessage && (
                      <span className="block truncate font-raleway text-xs text-forest/50">
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
        </section>
      )}

      <p className="rounded-2xl bg-sand p-4 font-raleway text-sm text-forest/60">
        {LISTING_SAFETY_NOTICE}
      </p>
    </div>
  )
}
