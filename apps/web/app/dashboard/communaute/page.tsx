import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, MessageSquare, Sprout } from 'lucide-react'
import {
  COMMUNITY_RADII_KM,
  COMMUNITY_RADIUS_LABELS,
  communityRadiusSchema,
  feedScopeSchema,
  type CommunityRadiusKm,
} from '@growi/shared'

import { CommunityDisabled, CommunityEmpty, MoreLink } from '@/components/community/bits'
import { PostCard } from '@/components/community/PostCard'
import { auth } from '@/auth'
import { cn } from '@/lib/utils'
import { getFeed } from '@/lib/services/community/post.service'
import { getSettings } from '@/lib/services/community/profile.service'
import { isServiceError } from '@/lib/services/errors'
import { TrackView } from '@/components/analytics/TrackView'

export const metadata: Metadata = {
  title: 'Communauté — Growi',
  description: 'Les jardiniers autour de toi.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function readParam(params: SearchParams, key: string): string | undefined {
  const raw = params[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value?.trim() || undefined
}

/** Construit un lien de la page en conservant les autres paramètres. */
function link(params: SearchParams, patch: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...params, ...patch })) {
    const single = Array.isArray(value) ? value[0] : value
    if (single) query.set(key, single)
  }
  const suffix = query.toString()
  return suffix ? `/dashboard/communaute?${suffix}` : '/dashboard/communaute'
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-lg border px-4 py-2 font-raleway text-sm transition-colors',
        active
          ? 'border-forest bg-lime font-medium text-forest'
          : 'border-forest/15 bg-white text-forest/60 hover:bg-sand',
      )}
    >
      {label}
    </Link>
  )
}

export default async function CommunautePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const settings = await getSettings(session.user.id)
  if (!settings.enabled) {
    return (
      <div className="space-y-6">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Communauté</h1>
        <CommunityDisabled />
      </div>
    )
  }

  // Lectures tolérantes, comme les filtres de l'admin : un paramètre absurde
  // vaut « pas de filtre », jamais une erreur.
  const scopeParsed = feedScopeSchema.safeParse(readParam(searchParams, 'onglet'))
  const scope = scopeParsed.success ? scopeParsed.data : 'nearby'

  const radiusParsed = communityRadiusSchema.safeParse(Number(readParam(searchParams, 'rayon')))
  const radius: CommunityRadiusKm | null = radiusParsed.success ? radiusParsed.data : null

  let feed
  try {
    feed = await getFeed(session.user.id, scope, radius, readParam(searchParams, 'apres') ?? null)
  } catch (err) {
    // Le seul refus possible est « profil non activé », déjà traité plus haut ;
    // tout le reste est une vraie panne.
    if (isServiceError(err) && err.code === 'FORBIDDEN') return <CommunityDisabled />
    throw err
  }

  const applied = feed.appliedRadiusKm ?? settings.radiusKm

  return (
    <div className="space-y-6">
      <TrackView
        event="community_feed_viewed"
        props={{ posts_count: feed.items.length, scope }}
        dedupeKey={`${scope}:${readParam(searchParams, 'apres') ?? ''}`}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Communauté</h1>

        <nav aria-label="Communauté" className="flex items-center gap-2">
          <Link
            href="/dashboard/communaute/bourse"
            className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-3 py-2 font-raleway text-sm text-forest hover:bg-sand"
          >
            <Sprout size={16} aria-hidden />
            Bourse
          </Link>
          <Link
            href="/dashboard/communaute/messages"
            className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-3 py-2 font-raleway text-sm text-forest hover:bg-sand"
          >
            <MessageSquare size={16} aria-hidden />
            Messages
          </Link>
          <Link
            href="/dashboard/communaute/notifications"
            aria-label="Notifications"
            className="inline-flex items-center rounded-lg border border-forest/15 bg-white p-2 text-forest hover:bg-sand"
          >
            <Bell size={16} aria-hidden />
          </Link>
        </nav>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {/* Changer d'onglet ou de rayon repart d'une première page : garder le
            curseur d'un fil dans l'autre n'aurait aucun sens. */}
        <Chip
          href={link(searchParams, { onglet: undefined, apres: undefined })}
          label="Autour de moi"
          active={scope === 'nearby'}
        />
        <Chip
          href={link(searchParams, { onglet: 'following', apres: undefined })}
          label="Abonnements"
          active={scope === 'following'}
        />

        {scope === 'nearby' && (
          <span className="ml-auto flex flex-wrap gap-2">
            {COMMUNITY_RADII_KM.map((km) => (
              <Chip
                key={km}
                href={link(searchParams, { rayon: String(km), apres: undefined })}
                label={COMMUNITY_RADIUS_LABELS[km]}
                active={applied === km && feed.widened === false}
              />
            ))}
          </span>
        )}
      </div>

      {scope === 'nearby' && feed.widened && (
        <p
          role="status"
          className="rounded-2xl border border-forest/10 bg-white p-4 font-raleway text-sm text-forest/70"
        >
          Peu d’activité à {feed.requestedRadiusKm} km — voici ce qui se passe à {applied} km.
        </p>
      )}

      {feed.items.length === 0 ? (
        scope === 'following' ? (
          <CommunityEmpty
            emoji="🌿"
            title="Tu ne suis encore personne"
            hint="Ouvre « Autour de moi » et abonne-toi aux jardiniers du coin — leurs publications arriveront ici."
          />
        ) : (
          <CommunityEmpty
            emoji="🌱"
            title="Personne n’a encore publié près de chez toi"
            hint="Publie depuis l’app mobile : une photo de ton jardin suffit à lancer le voisinage."
          />
        )
      ) : (
        <div className="space-y-4">
          {feed.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {feed.nextCursor && <MoreLink href={link(searchParams, { apres: feed.nextCursor })} />}
        </div>
      )}
    </div>
  )
}
