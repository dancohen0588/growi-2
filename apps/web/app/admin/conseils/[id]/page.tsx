import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { compileMDX } from 'next-mdx-remote/rsc'
import { BLOG_TAG_LABELS, type BlogPostStatus, type BlogTag } from '@growi/shared'

import {
  deleteBlogPostAction,
  publishBlogPostAction,
  regenerateCoverAction,
  unpublishBlogPostAction,
  updateBlogPostAction,
} from '@/app/actions/admin/blog'
import { ActionButton } from '@/components/admin/ActionButton'
import { DateCell, PageHeader, Pill } from '@/components/admin/bits'
import { BlogPostEditor } from '@/components/admin/blog/BlogPostEditor'
import { CoverRegenerateForm } from '@/components/admin/blog/CoverRegenerateForm'
import { requireAdmin } from '@/lib/admin/auth'
import { compileArticleMdx } from '@/lib/blog/compile'
import { countWords } from '@/lib/blog/editorial'
import { webMdxComponents } from '@/lib/blog/mdx-components'
import { mdxOptions } from '@/lib/blog/mdx-options'
import { articleIssues, getPostForAdmin } from '@/lib/services/blog-admin.service'
import { isServiceError } from '@/lib/services/errors'

export const dynamic = 'force-dynamic'

/** « Régénérer l'image » tourne dans cette requête. */
export const maxDuration = 60

const STATUS_PILLS: Record<BlogPostStatus, { label: string; tone: 'warning' | 'positive' | 'neutral' }> = {
  DRAFT: { label: 'Brouillon', tone: 'warning' },
  PUBLISHED: { label: 'Publié', tone: 'positive' },
  ARCHIVED: { label: 'Dépublié', tone: 'neutral' },
}

export default async function AdminConseilPage({ params }: { params: { id: string } }) {
  await requireAdmin()

  let post
  try {
    post = await getPostForAdmin(params.id)
  } catch (error) {
    if (isServiceError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const status = post.status as BlogPostStatus
  const pill = STATUS_PILLS[status] ?? STATUS_PILLS.DRAFT
  const reviewerNotes = Array.isArray(post.reviewerNotes) ? (post.reviewerNotes as string[]) : []
  const issues = await articleIssues({ title: post.title, excerpt: post.excerpt, mdx: post.source })
  const words = countWords(post.source)

  const bound = {
    update: updateBlogPostAction.bind(null, post.id),
    publish: publishBlogPostAction.bind(null, post.id),
    unpublish: unpublishBlogPostAction.bind(null, post.id),
    remove: deleteBlogPostAction.bind(null, post.id),
    cover: regenerateCoverAction.bind(null, post.id),
  }

  return (
    <>
      <Link href="/admin/conseils" className="mb-4 inline-flex items-center gap-1.5 text-sm text-forest/60 hover:text-forest">
        <ArrowLeft size={15} aria-hidden /> Tous les articles
      </Link>

      <PageHeader
        title={post.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={pill.tone}>{pill.label}</Pill>
            <span>/{post.slug}</span>
            {post.publishedAt && (
              <span>
                · publié le <DateCell value={post.publishedAt} />
              </span>
            )}
            {status === 'PUBLISHED' && (
              <Link href={`/blog/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 underline hover:no-underline">
                Voir sur le site <ExternalLink size={12} aria-hidden />
              </Link>
            )}
          </span>
        }
        actions={
          <>
            {status !== 'PUBLISHED' && (
              <ActionButton
                label="Publier"
                action={bound.publish}
                confirm={{
                  title: 'Publier cet article ?',
                  body: 'Il apparaîtra aussitôt sur le blog, et dans l’app mobile dans l’heure. As-tu vérifié les chiffres de l’encart « À vérifier » ?',
                  cta: 'Publier',
                }}
              />
            )}
            {status === 'PUBLISHED' && (
              <ActionButton
                label="Dépublier"
                action={bound.unpublish}
                confirm={{
                  title: 'Dépublier cet article ?',
                  body: 'Il disparaît du site et de l’app ; son adresse répondra « introuvable ». Tu pourras le republier.',
                  cta: 'Dépublier',
                }}
              />
            )}
            {status !== 'PUBLISHED' && (
              <ActionButton
                label="Supprimer"
                tone="danger"
                action={bound.remove}
                confirm={{
                  title: 'Supprimer définitivement ?',
                  body: 'L’article et sa couverture sont effacés. Le journal garde la trace de la suppression, pas le texte.',
                  cta: 'Supprimer',
                }}
              />
            )}
          </>
        }
      />

      {reviewerNotes.length > 0 && (
        <section
          aria-labelledby="a-verifier"
          className="mb-6 rounded-2xl border border-sun bg-sun/15 p-4"
        >
          <h2 id="a-verifier" className="font-poppins text-base font-semibold text-forest">
            À vérifier avant publication
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-forest/85">
            {reviewerNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
          {post.topicRationale && (
            <p className="mt-3 text-sm italic text-forest/60">Pourquoi ce thème : {post.topicRationale}</p>
          )}
        </section>
      )}

      {issues.length > 0 && (
        <section aria-label="Contrôles" className="mb-6 rounded-2xl border border-forest/10 bg-white p-4 text-sm">
          <ul className="space-y-1">
            {issues.map((issue, index) => (
              <li key={index} className={issue.severity === 'error' ? 'text-red-700' : 'text-forest/70'}>
                {issue.severity === 'error' ? 'Bloquant — ' : 'À surveiller — '}
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-forest/10 bg-white p-4">
            <BlogPostEditor
              post={{
                title: post.title,
                excerpt: post.excerpt,
                tags: post.tags,
                source: post.source,
                coverImageAlt: post.coverImageAlt,
              }}
              action={bound.update}
            />
          </div>
          <CoverRegenerateForm prompt={post.coverPrompt} action={bound.cover} />
        </div>

        <aside aria-label="Aperçu" className="min-w-0 rounded-2xl border border-forest/10 bg-sand p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-forest/50">
            Aperçu de la version enregistrée · {words} mots · {Math.max(1, Math.ceil(words / 200))} min de lecture
          </p>

          <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-forest to-lime">
            {post.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu admin, l'URL change à chaque régénération
              <img src={post.coverImage} alt={post.coverImageAlt ?? ''} className="h-full w-full object-cover" />
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Pill key={tag}>{BLOG_TAG_LABELS[tag as BlogTag] ?? tag}</Pill>
            ))}
          </div>
          <h2 className="font-poppins text-2xl font-bold leading-tight text-forest">{post.title}</h2>
          <p className="mt-2 font-raleway text-forest/80">{post.excerpt}</p>

          <div className="article-prose mt-6">
            <Preview source={post.source} />
          </div>
        </aside>
      </div>
    </>
  )
}

/**
 * Rendu avec les composants **du site** : ce que verra le lecteur. Un corps qui
 * ne compile pas ne fait pas tomber la fiche — c'est précisément sur elle qu'on
 * vient le corriger.
 */
async function Preview({ source }: { source: string }) {
  const check = await compileArticleMdx(source)
  if (!check.ok) {
    return <p className="text-sm text-red-700">Aperçu impossible : {check.error}</p>
  }
  const { content } = await compileMDX({ source, components: webMdxComponents, options: { mdxOptions } })
  return content
}
