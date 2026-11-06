// growi-frontend/app/dashboard/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { auth } from '@/auth'
import Link from 'next/link'
import {
  ArrowRight,
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  UserCircle,
  Map,
  ScanSearch,
} from 'lucide-react'
import { FeatureCard } from '@/components/dashboard/FeatureCard'
import { SapCard, SapCardSkeleton } from '@/components/dashboard/seve/SapCard'
import { SummaryStats } from '@/components/dashboard/SummaryStats'
import { serializeSapSummary } from '@/lib/api/serializers'
import { getSettings } from '@/lib/services/community/profile.service'
import { ThemeArt } from '@/components/dashboard/seve/ThemeArt'
import { getHomeTheme, getSapOverview } from '@/lib/services/sap-rewards.service'
import { getDashboardSummary } from '@/lib/services/summary.service'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

const featureCards = [
  {
    href: '/dashboard/identifier',
    title: 'Identifier une plante',
    description:
      'Photographie n\'importe quelle plante pour obtenir sa fiche complète instantanément.',
    icon: ScanSearch,
    badge: 'IA',
  },
  {
    href: '/dashboard/jardin',
    title: 'Mon jardin',
    description: 'Crée la carte de ton jardin et planifie tes zones.',
    icon: Map,
  },
  {
    href: '/dashboard/plantes',
    title: 'Mes plantes',
    description: 'Gère tes plantes et suis leur entretien.',
    icon: Leaf,
  },
  {
    href: '/dashboard/calendrier',
    title: 'Calendrier',
    description: 'Planning personnalisé calé sur la météo.',
    icon: CalendarDays,
  },
  {
    href: '/dashboard/diagnostic',
    title: 'Diagnostic IA',
    description: 'Analyse la santé d\'une plante en photo.',
    icon: Stethoscope,
  },
  {
    href: '/dashboard/meteo',
    title: 'Météo locale',
    description: 'Alertes gel, canicule et arrosage optimal.',
    icon: CloudSun,
  },
  {
    href: '/dashboard/compte',
    title: 'Mon compte',
    description: 'Gère ton profil et tes réglages.',
    icon: UserCircle,
  },
]

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'Jardinier'
  const homeTheme = session?.user?.id ? await getHomeTheme(session.user.id) : null

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome — habillé du thème qu'un cerne a débloqué, s'il y en a un
          de choisi ; sinon tel qu'il a toujours été. */}
      {homeTheme ? (
        <div className="relative overflow-hidden rounded-2xl bg-forest px-6 py-8">
          <ThemeArt theme={homeTheme} width={1000} height={180} className="absolute inset-0 h-full w-full" />
          <div className="relative">
            <h1 className="font-poppins font-bold text-2xl text-sand">Bonjour, {firstName} 👋</h1>
            <p className="font-raleway text-sm text-[#E6F0DA] mt-1">Voici un aperçu de ton jardin connecté.</p>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="font-poppins font-bold text-2xl text-forest">
            Bonjour, {firstName} 👋
          </h1>
          <p className="font-raleway text-sm text-forest/60 mt-1">
            Voici un aperçu de ton jardin connecté.
          </p>
        </div>
      )}

      {/* Overview stats row — en flux : le reste de la page, statique,
          s'affiche sans attendre le moteur de conseils. */}
      {session?.user?.id && (
        <Suspense fallback={<SummaryStatsSkeleton />}>
          <SummarySection userId={session.user.id} />
        </Suspense>
      )}

      {/* Identifier hero CTA */}
      <Link
        href="/dashboard/identifier"
        className="rounded-2xl border border-lime/30 bg-lime/10 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-lime/20 transition-colors group"
      >
        <div className="shrink-0 w-14 h-14 rounded-full bg-forest text-white flex items-center justify-center">
          <ScanSearch size={28} aria-hidden />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <h2 className="font-poppins font-bold text-lg text-forest">
            Identifier une plante en photo
          </h2>
          <p className="font-raleway text-sm text-forest/70">
            Pointe ta caméra vers n&apos;importe quelle plante. L&apos;IA
            l&apos;identifie et te donne tous les conseils d&apos;entretien.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-2.5 group-hover:bg-forest/90 transition-colors">
          Identifier maintenant
          <ArrowRight size={16} aria-hidden />
        </span>
      </Link>

      {/* La sève après le jardin du jour, comme sur l'app : elle dit ce que
          les gestes ont fait pousser, et mène aux gouttes à offrir. */}
      {session?.user?.id && (
        <Suspense fallback={<SapCardSkeleton />}>
          <SapSection userId={session.user.id} />
        </Suspense>
      )}

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureCards.map((card) => (
          <FeatureCard key={card.href} {...card} />
        ))}
      </div>

      {/* La bannière « Passer à Premium » menait à `/tarifs`, page supprimée.
          Elle vendait une offre qui n'existe pas — ni paiement, ni diagnostics
          limités, ni météo pro — à quelqu'un déjà inscrit : la rediriger vers
          `/register` n'aurait eu aucun sens. Elle reviendra avec Stripe. */}
    </div>
  )
}

/**
 * Les indicateurs ne valent pas la page : si le moteur ou la base bronche,
 * l'accueil s'affiche sans eux plutôt que de ne pas s'afficher.
 */
async function SummarySection({ userId }: { userId: string }) {
  const summary = await getDashboardSummary(userId).catch((error) => {
    console.error('[dashboard] indicateurs indisponibles :', error)
    return null
  })
  return summary ? <SummaryStats summary={summary} /> : null
}

/**
 * La sève, même règle que les indicateurs : une panne la fait disparaître —
 * y compris tant que la migration `20261106120000_sap` n'est pas appliquée —
 * sans emporter l'accueil.
 */
async function SapSection({ userId }: { userId: string }) {
  const data = await Promise.all([getSapOverview(userId), getSettings(userId)]).catch((error) => {
    console.error('[dashboard] sève indisponible :', error)
    return null
  })
  if (!data) return null
  const [summary, settings] = data
  return <SapCard summary={serializeSapSummary(summary)} communityEnabled={settings.enabled} />
}

/** Même grille que `SummaryStats`, pour que rien ne saute à l'arrivée. */
function SummaryStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-sand-dark" />
      ))}
    </div>
  )
}
