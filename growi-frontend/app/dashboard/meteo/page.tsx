// growi-frontend/app/dashboard/meteo/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getUserById } from '@/lib/mock-users'
import { WeatherPageClient } from '@/components/dashboard/meteo/WeatherPageClient'

export const metadata: Metadata = {
  title: 'Météo — Growi',
  description: "Consulte la météo locale pour optimiser l'entretien de ton jardin.",
  robots: { index: false },
}

export default async function MeteoPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = getUserById(session.user.id)

  return (
    <WeatherPageClient
      userAddress={user?.address ?? null}
      userId={session.user.id}
    />
  )
}
