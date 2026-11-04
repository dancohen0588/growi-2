import { PathSkeleton } from '@/components/dashboard/PathSkeleton'

/**
 * Ce qu'affiche le tableau de bord pendant qu'une page se calcule.
 *
 * Sans ce fichier, l'App Router garde l'ancienne page à l'écran jusqu'à ce que
 * la nouvelle soit prête : un clic dans le menu ne produisait aucun retour,
 * parfois pendant plusieurs secondes. Le menu et l'en-tête (le layout) restent
 * en place ; seul le contenu passe en squelette, choisi d'après l'adresse
 * demandée (`PathSkeleton`, qui explique aussi pourquoi `plantes/` et
 * `communaute/` ont le leur).
 */
export default function DashboardLoading() {
  return <PathSkeleton />
}
