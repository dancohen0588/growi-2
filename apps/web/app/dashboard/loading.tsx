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
 * Ce qu'affiche le tableau de bord pendant qu'une page se calcule.
 *
 * Sans ce fichier, l'App Router garde l'ancienne page à l'écran jusqu'à ce que
 * la nouvelle soit prête : un clic dans le menu ne produisait aucun retour,
 * parfois pendant plusieurs secondes. Le menu et l'en-tête (le layout) restent
 * en place ; seul le contenu passe en squelette.
 *
 * Un seul fichier pour tout le dashboard, et non un par section : la page des
 * plantes charge sa liste dans son **layout**, qu'un `loading.tsx` placé dans
 * `plantes/` n'envelopperait pas. Celui-ci, posé au-dessus, couvre tout — il
 * choisit donc son squelette d'après l'adresse demandée, que `usePathname`
 * donne déjà pendant le chargement.
 */
export default function DashboardLoading() {
  const pathname = usePathname() ?? ''
  const section = pathname.split('/')[2] ?? ''

  switch (section) {
    case 'plantes':
      // `/dashboard/plantes/<id>` : une fiche ; `nouveau` et `quick-add` sont
      // des formulaires.
      if (/^\/dashboard\/plantes\/(?!nouveau|quick-add)[^/]+/.test(pathname)) return <DetailSkeleton />
      if (pathname === '/dashboard/plantes') return <CardGridSkeleton title="Mes plantes" />
      return <PageSkeleton />
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
