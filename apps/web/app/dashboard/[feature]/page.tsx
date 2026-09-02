// growi-frontend/app/dashboard/[feature]/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// `diagnostic` a sa propre page depuis que la fonctionnalité existe.
// `marketplace` est sortie de la liste : rien n'existe derrière, et la promesse
// n'est plus faite nulle part sur le site.
const validFeatures = [
  'calendrier',
  'meteo',
] as const

type Feature = (typeof validFeatures)[number]

const featureLabels: Record<Feature, string> = {
  calendrier:  'Calendrier',
  meteo:       'Météo locale',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>
}): Promise<Metadata> {
  const { feature } = await params
  if (!validFeatures.includes(feature as Feature)) return {}
  return { title: featureLabels[feature as Feature] }
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>
}) {
  const { feature: featureParam } = await params
  if (!validFeatures.includes(featureParam as Feature)) notFound()
  const feature = featureParam as Feature

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
