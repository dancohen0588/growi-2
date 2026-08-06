'use client'

import { ShoppingBag, Star, Wrench, Users } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Wrench,      label: 'Élagage, arrosage enterré, création de massifs' },
  { icon: Star,        label: 'Professionnels notés par ta communauté locale' },
  { icon: ShoppingBag, label: 'Produits recommandés au bon moment, en bonne quantité' },
  { icon: Users,       label: 'Échange de graines et récoltes entre voisins' },
]

export function SectionMarketplace() {
  return (
    <SectionFeature
      id="marketplace"
      bg="white"
      eyebrow="Marketplace"
      title="Trouve les bons pros et les bons produits, sans chercher"
      description="Quand un chantier dépasse tes capacités ou que tu cherches du terreau de qualité, Growi te connecte aux bons interlocuteurs — pros du jardin locaux, boutiques partenaires ou voisins prêts à partager leurs récoltes."
      points={points}
      visual={<GardenImagePlaceholder variant="marketplace" />}
      aria-label="Fonctionnalité marketplace"
    />
  )
}
