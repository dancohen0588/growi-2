// growi-frontend/app/dashboard/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import Link from 'next/link'
import {
  ArrowRight,
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
  TrendingUp,
  Map,
  ScanSearch,
} from 'lucide-react'
import { FeatureCard } from '@/components/dashboard/FeatureCard'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

const featureCards = [
  {
    href: '/dashboard/identifier',
    title: 'Identifier une plante',
    description:
      'Photographiez n\'importe quelle plante pour obtenir sa fiche complète instantanément.',
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
    description: 'Gérez vos plantes et suivez leur entretien.',
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
    description: 'Identifiez maladies et nuisibles en photo.',
    icon: Stethoscope,
    badge: 'Bientôt',
  },
  {
    href: '/dashboard/meteo',
    title: 'Météo locale',
    description: 'Alertes gel, canicule et arrosage optimal.',
    icon: CloudSun,
  },
  {
    href: '/dashboard/marketplace',
    title: 'Marketplace',
    description: 'Trouvez des pros et échangez avec voisins.',
    icon: ShoppingBag,
    badge: 'Bientôt',
  },
  {
    href: '/dashboard/compte',
    title: 'Mon compte',
    description: 'Gérez votre profil et votre abonnement.',
    icon: UserCircle,
  },
]

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'Jardinier'

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Bonjour, {firstName} 👋
        </h1>
        <p className="font-raleway text-sm text-forest/60 mt-1">
          Voici un aperçu de ton jardin connecté.
        </p>
      </div>

      {/* Overview stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Plantes', value: '0', sub: 'ajoutées' },
          { label: 'Tâches', value: '0', sub: 'cette semaine' },
          { label: 'Alertes', value: '0', sub: 'en cours' },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-1"
          >
            <span className="font-raleway text-xs text-forest/50">{label}</span>
            <span className="font-poppins font-bold text-3xl text-forest">{value}</span>
            <span className="font-raleway text-xs text-forest/40">{sub}</span>
          </div>
        ))}
      </div>

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
            Pointez votre caméra vers n&apos;importe quelle plante. L&apos;IA
            l&apos;identifie et vous donne tous les conseils d&apos;entretien.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-2.5 group-hover:bg-forest/90 transition-colors">
          Identifier maintenant
          <ArrowRight size={16} aria-hidden />
        </span>
      </Link>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureCards.map((card) => (
          <FeatureCard key={card.href} {...card} />
        ))}
      </div>

      {/* Premium CTA banner */}
      <div className="rounded-2xl bg-forest text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} aria-hidden />
          <div>
            <p className="font-poppins font-semibold text-sm">Passer à Premium</p>
            <p className="font-raleway text-xs text-white/70">
              Diagnostics illimités, météo pro, multi-jardins.
            </p>
          </div>
        </div>
        <a
          href="/tarifs"
          className="shrink-0 rounded-lg bg-lime text-forest font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-lime-hover transition-colors"
        >
          Voir les offres
        </a>
      </div>
    </div>
  )
}
