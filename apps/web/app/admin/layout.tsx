import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin/auth'
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
