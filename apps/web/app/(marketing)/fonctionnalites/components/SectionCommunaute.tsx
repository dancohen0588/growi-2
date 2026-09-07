'use client'

import { Heart, MapPin, ShieldCheck, Sprout } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { CommunityVisual } from './SectionVisuals'

// Ce qui distingue Growi des applications de plantes existantes tient en un
// mot : le voisinage. Les puces disent donc ce que la proximité change, pas ce
// qu'un réseau social sait faire en général.
const points = [
  { icon: MapPin,      label: 'Un fil centré sur ton quartier — 5, 20 ou 50 km autour de ton jardin' },
  { icon: Sprout,      label: 'Une bourse aux graines : donne, échange ou cherche plants et boutures' },
  { icon: Heart,       label: 'Suis les jardiniers du coin, réagis à leurs photos, pose tes questions' },
  { icon: ShieldCheck, label: 'Ton adresse n’est jamais partagée : seule une distance approchée l’est' },
]

export function SectionCommunaute() {
  return (
    <SectionFeature
      id="communaute"
      bg="sand"
      eyebrow="Communauté"
      title="Les jardiniers d’à côté, pas ceux du bout du monde"
      description="Growi réunit les jardins d’un même quartier. On y montre ses récoltes, on y donne ses graines en trop, et on y trouve quelqu’un qui cultive le même sol que soi — sans argent, et sans jamais donner son adresse."
      points={points}
      visual={<CommunityVisual />}
      aria-label="Fonctionnalité communauté"
    />
  )
}
