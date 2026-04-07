'use client'

import { Camera, ScanLine, Stethoscope, MessageCircle } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Camera,        label: 'Prends une photo — le diagnostic arrive en quelques secondes' },
  { icon: ScanLine,      label: 'Détection maladies, carences et nuisibles (top 200 pathologies)' },
  { icon: Stethoscope,   label: 'Traitement recommandé adapté à ton jardin' },
  { icon: MessageCircle, label: 'Télé-conseil avec un expert horticole si besoin' },
]

export function SectionDiagnostic() {
  return (
    <SectionFeature
      id="diagnostic"
      bg="white"
      eyebrow="Diagnostic IA"
      title="Identifie et soigne tes plantes en un clic"
      description="Une feuille jaunit ? Une tache bizarre apparaît ? Pointe ta caméra et Growi identifie le problème, te propose un traitement naturel adapté et, si la situation est complexe, te connecte à un expert en temps réel."
      points={points}
      visual={<GardenImagePlaceholder variant="diagnostic" />}
      aria-label="Fonctionnalité diagnostic IA"
    />
  )
}
