// growi-frontend/app/dashboard/compte/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { CompteLayout } from '@/components/dashboard/compte/CompteLayout'

export const metadata: Metadata = {
  title: 'Mon compte — Growi',
  description: 'Gère ton profil et tes préférences de notifications.',
  robots: { index: false },
}

export default async function ComptePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <CompteLayout
      initialSession={{
        firstName: session.user.firstName ?? session.user.name ?? 'Jardinier',
        email: session.user.email ?? '',
      }}
    />
  )
}
