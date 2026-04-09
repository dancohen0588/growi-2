// growi-frontend/app/dashboard/parametres/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ParametresLayout } from '@/components/dashboard/parametres/ParametresLayout'

export const metadata: Metadata = {
  title: 'Paramètres — Growi',
  description: 'Gère ton profil et tes préférences de notifications.',
  robots: { index: false },
}

export default async function ParametresPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <ParametresLayout
      initialSession={{
        firstName: session.user.firstName ?? session.user.name ?? 'Jardinier',
        email: session.user.email ?? '',
      }}
    />
  )
}
