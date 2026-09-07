import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { NotificationTarget } from '@growi/shared'

import { auth } from '@/auth'
import { Avatar, CommunityEmpty, MoreLink } from '@/components/community/bits'
import { MarkAllRead } from '@/components/community/MarkAllRead'
import { listNotifications } from '@/lib/services/community/notification.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Notifications — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Où mène une notification — le pendant web de `lib/notifications.ts` côté
 * mobile, et lu dans le même ordre : du plus précis au plus vague.
 *
 * Une cible que cette version ne reconnaît pas ne devient pas un lien, plutôt
 * que d'ouvrir un écran au hasard.
 */
function targetHref(target: NotificationTarget): string | null {
  if (target.postId) return `/p/${target.postId}`
  if (target.threadId) return `/dashboard/communaute/messages/${target.threadId}`
  if (target.listingId) return `/dashboard/communaute/bourse/${target.listingId}`
  if (target.handle) return `/u/${target.handle}`
  return null
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const raw = searchParams.apres
  const cursor = (Array.isArray(raw) ? raw[0] : raw) ?? null
  const page = await listNotifications(session.user.id, cursor)

  const unread = page.items.some((item) => item.readAt === null)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-poppins text-2xl font-semibold text-forest">Notifications</h1>
        {unread && <MarkAllRead />}
      </header>

      {page.items.length === 0 ? (
        <CommunityEmpty
          emoji="🔔"
          title="Rien de neuf"
          hint="Les réactions à tes publications et tes nouveaux abonnés apparaîtront ici."
        />
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {page.items.map((notification) => {
              const href = targetHref(notification.target)
              const date = new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
              })

              const content = (
                <span className="flex items-center gap-3">
                  {notification.actor ? (
                    <Avatar user={notification.actor} size={36} />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-lg"
                    >
                      🌿
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {/* Texte figé à l'écriture : l'acteur a pu changer de pseudo
                        depuis, ce qui a été annoncé ne se réécrit pas. */}
                    <span className="block font-raleway text-sm text-forest">
                      {notification.preview}
                    </span>
                    <span className="block font-raleway text-xs text-forest/50">{date}</span>
                  </span>
                </span>
              )

              return (
                <li
                  key={notification.id}
                  className={cn(
                    'rounded-2xl border p-3',
                    notification.readAt === null
                      ? 'border-lime bg-lime/20'
                      : 'border-forest/10 bg-white',
                  )}
                >
                  {href ? (
                    <Link href={href} className="block hover:opacity-80">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              )
            })}
          </ul>

          {page.nextCursor && (
            <MoreLink href={`/dashboard/communaute/notifications?apres=${page.nextCursor}`} />
          )}
        </div>
      )}
    </div>
  )
}
