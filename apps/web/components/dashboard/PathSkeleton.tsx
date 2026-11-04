'use client'

import { usePathname } from 'next/navigation'

import {
  CalendarSkeleton,
  CardGridSkeleton,
  DetailSkeleton,
  FeedSkeleton,
  GardenSkeleton,
  PageSkeleton,
} from '@/components/dashboard/DashboardSkeletons'
import { WeatherSkeleton } from '@/components/dashboard/meteo/WeatherSkeleton'

/**
 * Le squelette qui correspond à l'adresse demandée — `usePathname` donne déjà
 * la destination pendant le chargement.
 *
 * Partagé par les `loading.tsx` du dashboard. Il en faut plusieurs : une
 * frontière de chargement n'est remontée que lorsque le segment **qui la
 * suit** change. Celle de `dashboard/` couvre le passage d'une section à
 * l'autre (et le layout de `plantes/`, qui charge la liste) ; celles de
 * `plantes/` et `communaute/` couvrent les navigations internes à la section,
 * de la liste vers une fiche, que la première laisserait sans squelette.
 */
export function PathSkeleton() {
  const pathname = usePathname() ?? ''
  const section = pathname.split('/')[2] ?? ''

  switch (section) {
    case 'plantes':
      if (pathname === '/dashboard/plantes') return <CardGridSkeleton title="Mes plantes" />
      // `nouveau` et `quick-add` sont des formulaires ; le reste, une fiche.
      if (/^\/dashboard\/plantes\/(nouveau|quick-add)(\/|$)/.test(pathname)) return <PageSkeleton />
      return <DetailSkeleton />
    case 'catalogue':
      return <CardGridSkeleton title="Encyclopédie" count={9} />
    case 'calendrier':
      return <CalendarSkeleton />
    case 'communaute':
      return pathname === '/dashboard/communaute' ? <FeedSkeleton /> : <PageSkeleton />
    case 'jardin':
      return <GardenSkeleton />
    case 'meteo':
      return <WeatherSkeleton />
    default:
      return <PageSkeleton />
  }
}
