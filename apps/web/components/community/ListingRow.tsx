import Link from 'next/link'
import {
  LISTING_CATEGORY_LABELS,
  LISTING_KIND_LABELS,
  LISTING_STATUS_LABELS,
  type Listing,
} from '@growi/shared'

import { Tag } from '@/components/community/bits'

/**
 * Une annonce dans la liste web.
 *
 * Dans son propre fichier, et pas dans la page : Next.js n'autorise qu'un jeu
 * d'exports précis dans un fichier de route (`default`, `metadata`,
 * `dynamic`…), et un composant exporté depuis une page fait échouer le build.
 */

export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/dashboard/communaute/bourse/${listing.id}`}
      className="flex gap-4 rounded-2xl border border-forest/10 bg-white p-4 transition-colors hover:bg-sand/50"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sand-dark">
        {listing.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photoUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="lime">{LISTING_KIND_LABELS[listing.kind]}</Tag>
          {/* `active` est l'état normal : l'afficher n'apprendrait rien. */}
          {listing.status !== 'active' && <Tag>{LISTING_STATUS_LABELS[listing.status]}</Tag>}
        </div>

        <p className="font-raleway font-medium text-forest">{listing.title}</p>

        <p className="font-raleway text-xs text-forest/50">
          {[
            LISTING_CATEGORY_LABELS[listing.category],
            listing.quantity,
            listing.author.distanceLabel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
  )
}
