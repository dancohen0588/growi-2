'use client'

import { Brain, CloudSun, Bell, Sparkles } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Brain,    label: 'Conseils adaptés à chaque plante et chaque saison' },
  { icon: CloudSun, label: 'Rappels météo : gel, canicule, pluie abondante' },
  { icon: Bell,     label: 'Notifications au bon moment — pas en excès' },
  { icon: Sparkles, label: "Plan d'entretien hebdomadaire généré automatiquement" },
]

export function SectionAssistant() {
  return (
    <SectionFeature
      id="assistant"
      bg="sand"
      eyebrow="Assistant IA"
      title="Ton assistant jardin qui sait quand agir"
      description="Plus besoin de te souvenir de tout. Growi analyse la météo de ton code postal, le type de substrat et le stade de tes plantes pour te suggérer exactement ce qu'il faut faire — et quand le faire."
      points={points}
      visual={<GardenImagePlaceholder variant="assistant" />}
      reverse={true}
      aria-label="Fonctionnalité assistant IA"
    />
  )
}
