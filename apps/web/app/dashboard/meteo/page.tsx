import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WeatherPageClient } from '@/components/dashboard/meteo/WeatherPageClient'

export const metadata: Metadata = {
  title: 'Météo — Growi',
  description: "Consulte la météo locale pour optimiser l'entretien de ton jardin.",
  robots: { index: false },
}

export default async function MeteoPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { address: true, latitude: true, longitude: true },
  })

  return (
    <WeatherPageClient
      userAddress={user?.address ?? null}
      userCoords={
        user?.latitude != null && user?.longitude != null
          ? { lat: user.latitude, lon: user.longitude }
          : null
      }
      userId={session.user.id}
    />
  )
}
