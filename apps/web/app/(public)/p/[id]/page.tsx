import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Leaf } from 'lucide-react'

import { auth } from '@/auth'
import { AuthorLine, Tag } from '@/components/community/bits'
import { CommentSection } from '@/components/community/CommentSection'
import { LikeButton } from '@/components/community/LikeButton'
import { getPost } from '@/lib/services/community/post.service'
import { isServiceError } from '@/lib/services/errors'

/**
 * Une publication, **lisible sans compte**.
 *
 * C'est ce qui rend un lien partageable hors de l'app — et la raison pour
 * laquelle cette page vit dans `(public)` plutôt que dans `dashboard` : elle
 * sert les deux publics, et le layout affiche déjà « Mon jardin » quand une
 * session existe.
 *
 * Une lecture anonyme n'emporte ni distance ni « j'aime » : la page est la
 * même, ce qu'elle sait de vous ne l'est pas.
 */

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** Extrait court, pour la description et l'aperçu des réseaux. */
function excerpt(body: string, fallback: string): string {
  const text = body.trim()
  if (!text) return fallback
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPost(params.id, null).catch(() => null)

  if (!post) {
    // Ni titre alléchant ni indexation pour un contenu masqué ou supprimé.
    return { title: 'Publication introuvable — Growi', robots: { index: false } }
  }

  const title = post.plantLabel
    ? `${post.plantLabel}, par ${post.author.handle} — Growi`
    : `Une publication de ${post.author.handle} — Growi`

  const description = excerpt(
    post.body,
    `${post.author.handle} partage son jardin sur Growi.`,
  )

  return {
    title,
    description,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      title,
      description,
      url: `/p/${post.id}`,
      type: 'article',
      // La première photo fait l'aperçu : c'est elle qu'on partage.
      images: post.photos[0] ? [{ url: post.photos[0] }] : undefined,
    },
  }
}

export default async function PublicPostPage({ params }: Params) {
  const session = await auth()
  const viewerId = session?.user?.id ?? null

  let post
  try {
    post = await getPost(params.id, viewerId)
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  const date = new Date(post.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <AuthorLine user={post.author} suffix={date} size={48} />

      {post.photos.length > 0 && (
        <div className="space-y-2">
          {post.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo}
              src={photo}
              alt=""
              className="w-full rounded-2xl bg-sand-dark object-cover"
            />
          ))}
        </div>
      )}

      {post.plantLabel && (
        <Tag tone="lime">
          <Leaf size={13} aria-hidden />
          {post.plantLabel}
        </Tag>
      )}

      {post.body && (
        <p className="whitespace-pre-wrap font-raleway text-forest">{post.body}</p>
      )}

      <div className="flex items-center gap-5 border-y border-forest/10 py-3">
        <LikeButton postId={post.id} likedByMe={post.likedByMe} likeCount={post.likeCount} />
        <span className="font-raleway text-sm text-forest/60">
          {post.commentCount} commentaire{post.commentCount > 1 ? 's' : ''}
        </span>
      </div>

      <CommentSection
        postId={post.id}
        comments={post.comments.items}
        canComment={Boolean(viewerId)}
      />

      {!viewerId && (
        <aside className="rounded-2xl border border-forest/10 bg-white p-6 text-center">
          <p className="font-poppins text-lg font-semibold text-forest">
            Ton jardin aussi mérite d’être partagé
          </p>
          <p className="mx-auto mt-1 max-w-md font-raleway text-sm text-forest/60">
            Growi réunit les jardiniers d’un même quartier : conseils, échanges de graines et
            entretien au jour le jour.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
          >
            Créer mon jardin
          </Link>
        </aside>
      )}
    </article>
  )
}
