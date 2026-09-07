import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import { Avatar, CommunityEmpty } from '@/components/community/bits'
import { FollowButton } from '@/components/community/FollowButton'
import { listUserPosts } from '@/lib/services/community/post.service'
import { getProfileByHandle } from '@/lib/services/community/profile.service'
import { isServiceError } from '@/lib/services/errors'

/**
 * Profil public d'un jardinier, **lisible sans compte**.
 *
 * Un profil non activé, un compte désactivé et un compte qui a bloqué le
 * lecteur répondent tous trois 404 — le service s'en charge, et distinguer le
 * troisième confirmerait l'existence du compte à celui dont il se protège.
 */

export const dynamic = 'force-dynamic'

type Params = { params: { handle: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const profile = await getProfileByHandle(params.handle, null).catch(() => null)

  if (!profile) {
    return { title: 'Profil introuvable — Growi', robots: { index: false } }
  }

  const title = `${profile.handle} — Growi`
  const description =
    profile.bio?.trim() ||
    `${profile.handle} jardine${profile.city ? ` à ${profile.city}` : ''} et partage son jardin sur Growi.`

  return {
    title,
    description,
    alternates: { canonical: `/u/${profile.handle}` },
    openGraph: {
      title,
      description,
      url: `/u/${profile.handle}`,
      type: 'profile',
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : undefined,
    },
  }
}

export default async function PublicProfilePage({ params }: Params) {
  const session = await auth()
  const viewerId = session?.user?.id ?? null

  let profile
  try {
    profile = await getProfileByHandle(params.handle, viewerId)
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  const posts = await listUserPosts(profile.id, viewerId, null)

  const memberSince = new Date(profile.memberSince).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-start gap-5">
        <Avatar user={profile} size={88} />

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="font-poppins text-2xl font-semibold text-forest">{profile.handle}</h1>
          <p className="font-raleway text-sm text-forest/60">
            {[profile.city, profile.distanceLabel, `Membre depuis ${memberSince}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {profile.bio && (
            <p className="pt-1 font-raleway text-forest/80">{profile.bio}</p>
          )}

          <dl className="flex gap-6 pt-2 font-raleway text-sm">
            <div>
              <dt className="text-forest/50">Publications</dt>
              <dd className="font-poppins font-semibold text-forest">{profile.postCount}</dd>
            </div>
            <div>
              <dt className="text-forest/50">Abonnés</dt>
              <dd className="font-poppins font-semibold text-forest">{profile.followerCount}</dd>
            </div>
            <div>
              <dt className="text-forest/50">Abonnements</dt>
              <dd className="font-poppins font-semibold text-forest">{profile.followingCount}</dd>
            </div>
          </dl>
        </div>

        <div className="w-full sm:w-auto">
          {profile.isSelf ? (
            <Link
              href="/dashboard/compte#communaute"
              className="inline-block rounded-lg border border-forest/15 bg-white px-5 py-2.5 font-raleway text-sm text-forest hover:bg-sand"
            >
              Modifier mon profil
            </Link>
          ) : (
            <FollowButton
              handle={profile.handle}
              isFollowing={profile.isFollowing}
              isBlocked={profile.isBlocked}
              followerCount={profile.followerCount}
            />
          )}
        </div>
      </header>

      {posts.items.length === 0 ? (
        <CommunityEmpty
          emoji="🌿"
          title="Rien à voir pour l’instant"
          hint={
            profile.isSelf
              ? 'Tes publications apparaîtront ici.'
              : 'Ce jardinier n’a encore rien publié.'
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {posts.items.map((post) => (
            <li key={post.id}>
              <Link
                href={`/p/${post.id}`}
                className="block aspect-square overflow-hidden rounded-lg bg-sand-dark"
              >
                {post.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.photos[0]}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
