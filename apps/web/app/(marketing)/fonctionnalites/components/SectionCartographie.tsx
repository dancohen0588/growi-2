'use client'

import { Map, Layers, Sun, Droplets } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Map,      label: 'Crée le plan de ton jardin en quelques minutes' },
  { icon: Layers,   label: 'Zone par zone : pelouse, massifs, potager, terrasse' },
  { icon: Sun,      label: "Analyse automatique de l'exposition et des micro-climats" },
  { icon: Droplets, label: "Suggestions d'arrosage par zone selon la météo locale" },
]

export function SectionCartographie() {
  return (
    <SectionFeature
      id="cartographie"
      bg="white"
      eyebrow="Cartographie"
      title="Visualise et organise ton jardin comme un pro"
      description="Dessine ton espace en quelques gestes, indique tes zones et laisse Growi analyser l'exposition au soleil, les micro-climats et les besoins en eau — pour que chaque coin de ton jardin reçoive exactement ce qu'il lui faut."
      points={points}
      visual={<GardenImagePlaceholder variant="cartographie" />}
      aria-label="Fonctionnalité cartographie"
    />
  )
}
