import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { LISTING_SAFETY_NOTICE, LISTING_STATUS_LABELS } from '@growi/shared'

import { auth } from '@/auth'
import { ThreadComposer } from '@/components/community/ThreadComposer'
import { getThread } from '@/lib/services/community/listing.service'
import { isServiceError } from '@/lib/services/errors'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Discussion — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type Params = { params: { threadId: string } }

export default async function ThreadPage({ params }: Params) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  let thread
  try {
    // Cet appel **marque la lecture** : ouvrir un fil, c'est le lire.
    thread = await getThread(params.threadId, session.user.id)
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  // Les messages arrivent du plus récent au plus ancien ; à l'écran, le bas
  // est le présent.
  const messages = [...thread.messages.items].reverse()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href="/dashboard/communaute/messages"
        className="font-raleway text-sm text-forest/60 hover:text-forest"
      >
        ← Retour aux messages
      </Link>

      <header className="rounded-2xl border border-forest/10 bg-white p-4">
        <p className="font-raleway text-xs text-forest/50">
          Discussion avec {thread.other.handle}
        </p>
        <Link
          href={`/dashboard/communaute/bourse/${thread.listingId}`}
          className="font-poppins font-semibold text-forest hover:underline"
        >
          {thread.listingTitle}
        </Link>
        <p className="font-raleway text-xs text-forest/50">
          {LISTING_STATUS_LABELS[thread.listingStatus]}
        </p>
      </header>

      <p className="flex items-start gap-2 rounded-2xl bg-sand p-4 font-raleway text-sm text-forest/70">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden />
        {LISTING_SAFETY_NOTICE}
      </p>

      <ul className="space-y-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn('flex', message.isMine ? 'justify-end' : 'justify-start')}
          >
            <span
              className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 font-raleway text-sm',
                message.isMine ? 'bg-lime text-forest' : 'border border-forest/10 bg-white text-forest',
              )}
            >
              {message.body}
            </span>
          </li>
        ))}
      </ul>

      {thread.messages.nextCursor && (
        <p className="text-center font-raleway text-xs text-forest/40">
          Les messages plus anciens sont consultables depuis l’app mobile.
        </p>
      )}

      <ThreadComposer threadId={thread.id} />
    </div>
  )
}
