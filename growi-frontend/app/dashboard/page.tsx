// growi-frontend/app/dashboard/page.tsx
import type { Metadata } from 'next'
import { auth } from '@/auth'
import {
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
  TrendingUp,
  Map,
} from 'lucide-react'
import { FeatureCard } from '@/components/dashboard/FeatureCard'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

const featureCards = [
  {
    href: '/dashboard/jardin',
    title: 'Mon Jardin',
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
