import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import type { IdentifiedPlant } from '@/components/identify/IdentifyFlow'

/**
 * L'action de fin de parcours côté page publique.
 *
 * Un seul appel à l'action : c'est le meilleur point d'entrée du site, le
 * visiteur a déjà une plante dans les mains. Le slug voyage jusqu'à
 * l'inscription pour que la plante soit présélectionnée à l'arrivée.
 */
export function IdentifiedPlantCta({ plant }: { plant: IdentifiedPlant }) {
  const href = plant.encyclopediaSlug
    ? `/register?plant=${encodeURIComponent(plant.encyclopediaSlug)}`
    : '/register'

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 font-poppins text-sm font-semibold text-white transition-colors hover:bg-forest/90"
    >
      Ajouter cette plante à mon jardin
      <ArrowRight size={16} aria-hidden />
    </Link>
  )
}
