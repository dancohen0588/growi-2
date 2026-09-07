import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABELS,
  LISTING_KINDS,
  LISTING_KIND_LABELS,
  listingCategorySchema,
  listingKindSchema,
} from '@growi/shared'

import { auth } from '@/auth'
import { CommunityDisabled, CommunityEmpty, MoreLink } from '@/components/community/bits'
import { ListingRow } from '@/components/community/ListingRow'
import { cn } from '@/lib/utils'
import { listListings } from '@/lib/services/community/listing.service'
import { getSettings } from '@/lib/services/community/profile.service'
import { isServiceError } from '@/lib/services/errors'

export const metadata: Metadata = {
  title: 'Bourse aux graines — Growi',
  description: 'Donne, échange ou cherche des graines, plants et boutures près de chez toi.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function readParam(params: SearchParams, key: string): string | undefined {
  const raw = params[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value?.trim() || undefined
}

function link(params: SearchParams, patch: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...params, ...patch })) {
    const single = Array.isArray(value) ? value[0] : value
    if (single) query.set(key, single)
  }
  const suffix = query.toString()
  return suffix ? `/dashboard/communaute/bourse?${suffix}` : '/dashboard/communaute/bourse'
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-lg border px-3 py-1.5 font-raleway text-sm transition-colors',
        active
          ? 'border-forest bg-lime font-medium text-forest'
          : 'border-forest/15 bg-white text-forest/60 hover:bg-sand',
      )}
    >
      {label}
    </Link>
  )
}

export default async function BoursePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const settings = await getSettings(session.user.id)
  if (!settings.enabled) {
    return (
      <div className="space-y-6">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Bourse aux graines</h1>
        <CommunityDisabled />
      </div>
    )
  }

  const kindParsed = listingKindSchema.safeParse(readParam(searchParams, 'type'))
  const categoryParsed = listingCategorySchema.safeParse(readParam(searchParams, 'categorie'))

  let page
  try {
    page = await listListings(
      session.user.id,
      {
        kind: kindParsed.success ? kindParsed.data : undefined,
        category: categoryParsed.success ? categoryParsed.data : undefined,
      },
      readParam(searchParams, 'apres') ?? null,
    )
  } catch (err) {
    if (isServiceError(err) && err.code === 'FORBIDDEN') return <CommunityDisabled />
    throw err
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-forest">Bourse aux graines</h1>
          <p className="font-raleway text-sm text-forest/60">
            Don et troc uniquement — Growi ne gère aucun paiement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/communaute/bourse/mes-annonces"
            className="rounded-lg border border-forest/15 bg-white px-3 py-2 font-raleway text-sm text-forest hover:bg-sand"
          >
            Mes annonces
          </Link>
          <Link
            href="/dashboard/communaute/bourse/nouvelle"
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
          >
            <Plus size={16} aria-hidden />
            Publier
          </Link>
        </div>
      </header>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Chip
            href={link(searchParams, { type: undefined, apres: undefined })}
            label="Tout"
            active={!kindParsed.success}
          />
          {LISTING_KINDS.map((kind) => (
            <Chip
              key={kind}
              href={link(searchParams, { type: kind, apres: undefined })}
              label={LISTING_KIND_LABELS[kind]}
              active={kindParsed.success && kindParsed.data === kind}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip
            href={link(searchParams, { categorie: undefined, apres: undefined })}
            label="Toutes"
            active={!categoryParsed.success}
          />
          {LISTING_CATEGORIES.map((category) => (
            <Chip
              key={category}
              href={link(searchParams, { categorie: category, apres: undefined })}
              label={LISTING_CATEGORY_LABELS[category]}
              active={categoryParsed.success && categoryParsed.data === category}
            />
          ))}
        </div>
      </div>

      {page.items.length === 0 ? (
        <CommunityEmpty
          emoji="🌻"
          title="Rien dans ta bourse pour l’instant"
          hint="Publie la première annonce de ton quartier — des graines en trop suffisent."
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

          {page.nextCursor && <MoreLink href={link(searchParams, { apres: page.nextCursor })} />}
        </div>
      )}
    </div>
  )
}
