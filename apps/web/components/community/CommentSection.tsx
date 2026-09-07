'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Trash2 } from 'lucide-react'
import type { CommunityComment } from '@growi/shared'
import { COMMENT_BODY_MAX_LENGTH } from '@growi/shared'

import { addCommentAction, deleteCommentAction } from '@/app/actions/community'
import { Avatar } from '@/components/community/bits'

/**
 * Les commentaires d'une publication, à plat.
 *
 * Le formulaire n'est rendu que pour un lecteur connecté : afficher un champ
 * qui renvoie vers la connexion à l'envoi ferait perdre ce qu'on vient
 * d'écrire.
 */
export function CommentSection({
  postId,
  comments,
  canComment,
}: {
  postId: string
  comments: CommunityComment[]
  canComment: boolean
}) {
  const [rows, setRows] = useState(comments)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await addCommentAction(postId, formData)
      if (result.ok) {
        setError(null)
        // Le champ n'est vidé qu'en cas de succès : après un refus — la liste
        // noire, par exemple — ce qui vient d'être écrit ne doit pas
        // disparaître.
        form.reset()
      } else {
        setError(result.error)
      }
    })
  }

  function remove(commentId: string) {
    startTransition(async () => {
      const result = await deleteCommentAction(commentId, postId)
      if (result.ok) setRows((current) => current.filter((row) => row.id !== commentId))
      else setError(result.error)
    })
  }

  return (
    <section className="space-y-4">
      <h2 className="font-poppins text-lg font-semibold text-forest">
        {rows.length > 0
          ? `${rows.length} commentaire${rows.length > 1 ? 's' : ''}`
          : 'Commentaires'}
      </h2>

      {canComment ? (
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="comment-body" className="sr-only">
            Commentaire
          </label>
          <textarea
            id="comment-body"
            name="body"
            rows={3}
            required
            maxLength={COMMENT_BODY_MAX_LENGTH}
            disabled={pending}
            placeholder="Dis-lui ce que tu en penses…"
            className="w-full rounded-lg border border-forest/15 px-3 py-2 font-raleway text-sm text-forest disabled:bg-forest/5"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 font-raleway text-sm font-semibold text-forest hover:bg-lime/80 disabled:opacity-50"
            >
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              Commenter
            </button>
            {error && (
              <p role="alert" className="font-raleway text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        </form>
      ) : (
        <p className="font-raleway text-sm text-forest/60">
          <Link href="/login" className="text-forest underline hover:no-underline">
            Connecte-toi
          </Link>{' '}
          pour réagir à cette publication.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="font-raleway text-sm text-forest/50">
          Personne n’a encore réagi.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((comment) => (
            <li key={comment.id} className="flex gap-3 rounded-2xl border border-forest/10 bg-white p-3">
              <Avatar user={comment.author} size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-raleway text-sm">
                  <Link
                    href={`/u/${comment.author.handle}`}
                    className="font-medium text-forest hover:underline"
                  >
                    {comment.author.handle}
                  </Link>
                </p>
                <p className="whitespace-pre-wrap font-raleway text-sm text-forest/80">
                  {comment.body}
                </p>
              </div>

              {comment.canDelete && (
                <button
                  type="button"
                  onClick={() => remove(comment.id)}
                  disabled={pending}
                  aria-label="Supprimer ce commentaire"
                  className="shrink-0 self-start text-forest/40 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
