import Link from 'next/link'
import { Leaf, MessageCircle } from 'lucide-react'
import type { CommunityPost } from '@growi/shared'

import { AuthorLine, Tag } from '@/components/community/bits'
import { LikeButton } from '@/components/community/LikeButton'

/**
 * Une publication dans le fil web.
 *
 * La photo est le sujet et occupe toute la largeur de la carte ; le texte
 * suit. Même parti que sur mobile — un fil de jardin se parcourt à l'image.
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
}

export function PostCard({ post }: { post: CommunityPost }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-forest/10 bg-white">
      <header className="p-4">
        <AuthorLine user={post.author} suffix={formatDate(post.createdAt)} />
      </header>

      {post.photos[0] && (
        <Link href={`/p/${post.id}`} className="block bg-sand-dark">
          {/* Ratio fixe : sans lui, le fil sautille au fur et à mesure que les
              photos arrivent. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.photos[0]}
            alt=""
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
        </Link>
      )}

      <div className="space-y-2 p-4">
        {post.plantLabel && (
          <Tag tone="lime">
            <Leaf size={13} aria-hidden />
            {post.plantLabel}
          </Tag>
        )}

        {post.body && (
          <p className="whitespace-pre-wrap font-raleway text-sm text-forest">{post.body}</p>
        )}

        <div className="flex items-center gap-5 pt-1">
          <LikeButton postId={post.id} likedByMe={post.likedByMe} likeCount={post.likeCount} />

          <Link
            href={`/p/${post.id}`}
            className="inline-flex items-center gap-1.5 font-raleway text-sm text-forest/60 hover:text-forest"
          >
            <MessageCircle size={18} aria-hidden />
            {post.commentCount}
          </Link>

          {post.photos.length > 1 && (
            <span className="font-raleway text-xs text-forest/40">
              {post.photos.length} photos
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
