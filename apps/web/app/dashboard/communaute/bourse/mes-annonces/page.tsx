import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { auth } from '@/auth'
import { CommunityEmpty, MoreLink } from '@/components/community/bits'
import { ListingRow } from '@/components/community/ListingRow'
import { listMyListings } from '@/lib/services/community/listing.service'

export const metadata: Metadata = {
  title: 'Mes annonces — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Mes annonces, tous statuts.
 *
 * Écran distinct de la bourse : celle-ci est géographique et ne montre que ce
 * qui est disponible, alors qu'on vient ici retrouver une annonce **expirée**
 * pour la prolonger. Sans cette page, une annonce expirée était introuvable
 * depuis le web.
 */
export default async function MesAnnoncesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const raw = searchParams.apres
  const cursor = (Array.isArray(raw) ? raw[0] : raw) ?? null
  const page = await listMyListings(session.user.id, cursor)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/communaute/bourse"
        className="font-raleway text-sm text-forest/60 hover:text-forest"
      >
        ← Retour à la bourse
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Mes annonces</h1>
        <Link
          href="/dashboard/communaute/bourse/nouvelle"
          className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
        >
          <Plus size={16} aria-hidden />
          Publier
        </Link>
      </header>

      {page.items.length === 0 ? (
        <CommunityEmpty
          emoji="🌱"
          title="Aucune annonce"
          hint="Des graines en trop, des boutures, une récolte abondante : le voisinage est preneur."
          action={
            <Link
              href="/dashboard/communaute/bourse/nouvelle"
              className="rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
            >
              Publier une annonce
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {page.items.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}

          {page.nextCursor && (
            <MoreLink
              href={`/dashboard/communaute/bourse/mes-annonces?apres=${page.nextCursor}`}
            />
          )}
        </div>
      )}
    </div>
  )
}
