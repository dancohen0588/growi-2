'use client'

import { Brain, CloudSun, Bell, MessageSquare } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { AssistantVisual } from './SectionVisuals'

// « Plan d'entretien hebdomadaire généré automatiquement » disait vrai mais mal :
// le moteur produit des actions dans le calendrier. La quatrième puce accueille
// l'assistant conversationnel, la vraie nouveauté, absente du site jusqu'ici.
const points = [
  { icon: Brain,         label: 'Conseils adaptés à chaque plante et à chaque saison' },
  { icon: CloudSun,      label: 'Alertes météo : gel, canicule, pluie abondante — la veille, pas le lendemain' },
  { icon: Bell,          label: 'Rappels sur ton téléphone au bon moment, pas en excès' },
  { icon: MessageSquare, label: 'Une question ? Pose-la depuis une plante, un geste ou un diagnostic : il répond avec le contexte, propose une action, tu décides' },
]

export function SectionAssistant() {
  return (
    <SectionFeature
      id="assistant"
      bg="forest"
      eyebrow="Assistant"
      title="Ton assistant jardin qui sait quand agir"
      description="Growi analyse la météo de ton code postal, l’état de chacune de tes plantes et ce que tu as déjà fait pour te proposer exactement les bons gestes — et quand les faire."
      points={points}
      visual={<AssistantVisual />}
      reverse={true}
      aria-label="Fonctionnalité assistant"
    />
  )
}
