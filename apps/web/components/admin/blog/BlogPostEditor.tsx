'use client'

import { useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'
import { BLOG_TAG_LABELS, BLOG_TAGS, type BlogTag } from '@growi/shared'

import type { ActionResult } from '@/components/admin/ActionButton'
import { cn } from '@/lib/utils'

const EXCERPT_MAX = 160

/**
 * Édition simple d'un article : titre, extrait, tags, corps MDX.
 *
 * Volontairement minimaliste (spec § 0, décision 4) : pas d'éditeur riche. Le
 * corps est du MDX dans un `textarea` ; l'aperçu, à côté, montre la version
 * **enregistrée**, rendue avec les vrais composants du site.
 *
 * Les défauts bloquants (termes interdits, MDX qui ne compile pas…) sont
 * refusés par le serveur avec leur explication ; la longueur n'est qu'un
 * avertissement, l'admin a le dernier mot.
 */
export function BlogPostEditor({
  post,
  action,
}: {
  post: {
    title: string
    excerpt: string
    tags: string[]
    source: string
    coverImageAlt: string | null
  }
  action: (formData: FormData) => Promise<ActionResult>
}) {
  const [excerpt, setExcerpt] = useState(post.excerpt)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(async () => setResult(await action(formData)))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Titre" htmlFor="post-title">
        <input
          id="post-title"
          name="title"
          defaultValue={post.title}
          required
          maxLength={100}
          className="w-full rounded-lg border border-forest/15 px-3 py-2 text-forest"
        />
      </Field>

      <Field
        label="Extrait"
        htmlFor="post-excerpt"
        hint={
          <span className={cn(excerpt.length > EXCERPT_MAX && 'font-semibold text-red-700')}>
            {excerpt.length} / {EXCERPT_MAX}
          </span>
        }
      >
        <textarea
          id="post-excerpt"
          name="excerpt"
          rows={3}
          required
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
          className="w-full rounded-lg border border-forest/15 px-3 py-2 text-forest"
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-forest">Tags (1 ou 2)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {BLOG_TAGS.map((tag: BlogTag) => (
            <label key={tag} className="flex items-center gap-2 text-sm text-forest/80">
              <input
                type="checkbox"
                name="tags"
                value={tag}
                defaultChecked={post.tags.includes(tag)}
                className="h-4 w-4 accent-forest"
              />
              {BLOG_TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Corps de l’article (MDX)" htmlFor="post-source">
        <textarea
          id="post-source"
          name="source"
          rows={30}
          required
          defaultValue={post.source}
          spellCheck
          className="w-full rounded-lg border border-forest/15 px-3 py-2 font-mono text-xs leading-relaxed text-forest"
        />
      </Field>

      <Field label="Texte alternatif de la couverture" htmlFor="post-alt" hint="Ce qu’on voit sur l’image.">
        <input
          id="post-alt"
          name="coverImageAlt"
          defaultValue={post.coverImageAlt ?? ''}
          maxLength={200}
          className="w-full rounded-lg border border-forest/15 px-3 py-2 text-sm text-forest"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
          Enregistrer
        </button>
        {result && (
          <p role="status" className={cn('text-sm', result.ok ? 'text-forest/70' : 'text-red-700')}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-forest">
          {label}
        </label>
        {hint && <span className="text-xs text-forest/55">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
