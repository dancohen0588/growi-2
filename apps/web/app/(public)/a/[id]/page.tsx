import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LISTING_CATEGORY_LABELS, LISTING_KIND_LABELS } from '@growi/shared'

import { auth } from '@/auth'
import { Tag } from '@/components/community/bits'
import { getPublicListingTeaser } from '@/lib/services/community/listing.service'

/**
 * Aperçu public d'une annonce.
 *
 * **Volontairement minimal** : titre, photo, ville. La bourse reste derrière
 * le login — une annonce porte une distance relative à celui qui la lit, et se
 * déclarer intéressé suppose un compte. Cette page n'existe que pour qu'un
 * lien partagé à l'extérieur mène quelque part.
 *
 * Un lecteur déjà connecté est renvoyé vers la vraie fiche, où il peut agir.
 */

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const listing = await getPublicListingTeaser(params.id)

  if (!listing) {
    return { title: 'Annonce introuvable — Growi', robots: { index: false } }
  }

  const title = `${LISTING_KIND_LABELS[listing.kind]} : ${listing.title} — Growi`
  const description = `${LISTING_CATEGORY_LABELS[listing.category]}${
    listing.city ? `, à ${listing.city}` : ''
  }. Don et troc entre jardiniers, sans argent.`

  return {
    title,
    description,
    alternates: { canonical: `/a/${listing.id}` },
    openGraph: {
      title,
      description,
      url: `/a/${listing.id}`,
      type: 'article',
      images: listing.photoUrl ? [{ url: listing.photoUrl }] : undefined,
    },
  }
}

export default async function PublicListingPage({ params }: Params) {
  const listing = await getPublicListingTeaser(params.id)
  if (!listing) notFound()

  const session = await auth()

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      {listing.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.photoUrl}
          alt=""
          className="max-h-80 w-full rounded-2xl bg-sand-dark object-cover"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="lime">{LISTING_KIND_LABELS[listing.kind]}</Tag>
        <Tag>{LISTING_CATEGORY_LABELS[listing.category]}</Tag>
      </div>

      <h1 className="font-poppins text-2xl font-semibold text-forest">{listing.title}</h1>

      {listing.city && (
        <p className="font-raleway text-sm text-forest/60">À {listing.city}</p>
      )}

      <div className="rounded-2xl border border-forest/10 bg-white p-6 text-center">
        <p className="font-poppins text-lg font-semibold text-forest">
          {session ? 'Ouvre l’annonce complète' : 'Réponds à cette annonce'}
        </p>
        <p className="mx-auto mt-1 max-w-md font-raleway text-sm text-forest/60">
          La bourse aux graines réunit les jardiniers d’un même quartier. Don et troc uniquement —
          Growi ne gère aucun paiement.
        </p>
        <Link
          href={session ? `/dashboard/communaute/bourse/${listing.id}` : '/register'}
          className="mt-4 inline-block rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
        >
          {session ? 'Voir l’annonce' : 'Créer mon jardin pour répondre'}
        </Link>
      </div>
    </div>
  )
}
