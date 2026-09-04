import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin/auth'
import { isServiceError } from '@/lib/services/errors'

/**
 * Le middleware écarte déjà les non-administrateurs, mais un layout ne se
 * repose pas dessus : le JWT peut porter un rôle périmé, et une redirection
 * n'est pas un contrôle d'accès. `requireAdmin()` relit la base.
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

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-forest/10 bg-white">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-poppins text-lg font-semibold text-forest">Admin Growi</span>
          <span className="truncate text-sm text-forest/60">{admin.email}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-xl p-6">{children}</main>
    </div>
  )
}
