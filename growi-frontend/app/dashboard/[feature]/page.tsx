// growi-frontend/app/dashboard/[feature]/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const validFeatures = [
  'calendrier',
  'diagnostic',
  'meteo',
  'marketplace',
  'compte',
] as const

type Feature = (typeof validFeatures)[number]

const featureLabels: Record<Feature, string> = {
  calendrier:  'Calendrier',
  diagnostic:  'Diagnostic IA',
  meteo:       'Météo locale',
  marketplace: 'Marketplace',
  compte:      'Mon compte',
}

export function generateMetadata({
  params,
}: {
  params: { feature: string }
}): Metadata {
  if (!validFeatures.includes(params.feature as Feature)) return {}
  return { title: featureLabels[params.feature as Feature] }
}

export default function FeaturePage({
  params,
}: {
  params: { feature: string }
}) {
  if (!validFeatures.includes(params.feature as Feature)) notFound()
  const feature = params.feature as Feature

  const label = featureLabels[feature]

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 text-center">
      <div className="text-6xl">🌱</div>
      <div className="flex flex-col gap-2">
        <h1 className="font-poppins font-bold text-xl text-forest">{label}</h1>
        <p className="font-raleway text-sm text-forest/60 max-w-xs">
          Cette section arrive bientôt. Reste connecté pour ne pas rater le lancement !
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg border-2 border-forest text-forest font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-forest/5 transition-colors"
      >
        ← Retour au tableau de bord
      </Link>
    </div>
  )
}
