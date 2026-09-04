import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdminNav } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { countNew } from '@/lib/services/contact.service'
import { isServiceError } from '@/lib/services/errors'

/**
 * **C'est ici, et nulle part ailleurs, que l'accès au portail se décide.**
 *
 * Le middleware se contente d'exiger une session : il ne dispose que du JWT,
 * où le rôle est figé à la connexion. `requireAdmin()` relit l'état réel du
 * compte, ce qui fait qu'une promotion comme une rétrogradation prend effet
 * immédiatement, sans attendre que l'intéressé se reconnecte.
 */
export const metadata: Metadata = {
  title: 'Administration — Growi',
  robots: { index: false, follow: false },
}

/** Aucune page d'administration n'est statique : elles montrent l'état vivant. */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    if (isServiceError(err) && err.code === 'UNAUTHENTICATED') redirect('/login')
    if (isServiceError(err) && err.code === 'FORBIDDEN') redirect('/dashboard')
    throw err
  }

  // Le badge de la navigation. Un message non traité qui n'apparaît nulle part
  // est un message oublié : le compteur est la seule chose qui le rappelle
  // depuis n'importe quelle page de l'admin.
  const newMessages = await countNew()

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <header className="border-b border-forest/10 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-poppins text-lg font-semibold text-forest">Admin Growi</span>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-forest/60 hover:text-forest">
              Retour à l’app
            </Link>
            <span className="hidden truncate text-sm text-forest/60 sm:inline">{admin.email}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col md:flex-row">
        <AdminNav counts={{ '/admin/messages': newMessages }} />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
