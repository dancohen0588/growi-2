'use client'

import { Camera, ScanLine, Stethoscope, History } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

// Ces promesses décrivent ce que la fonctionnalité fait réellement depuis sa
// mise en service. Le télé-conseil avec un expert, annoncé ici auparavant,
// appartient encore à la feuille de route : le promettre sur la page
// publique alors que l'app ne l'offre pas nous exposait pour rien.
const points = [
  { icon: Camera,      label: 'Prends une photo — le diagnostic arrive en quelques secondes' },
  { icon: ScanLine,    label: 'Maladies, carences et nuisibles repérés sur la photo' },
  { icon: Stethoscope, label: 'Analyse croisée avec ta météo, ton sol et ton journal d’entretien' },
  { icon: History,     label: 'État de santé mis à jour et historisé, après ton accord' },
]

export function SectionDiagnostic() {
  return (
    <SectionFeature
      id="diagnostic"
      bg="white"
      eyebrow="Diagnostic IA"
      title="Identifie et soigne tes plantes en un clic"
      description="Une feuille jaunit ? Une tache bizarre apparaît ? Photographie ta plante : Growi croise l’image avec ce qu’il sait déjà d’elle — son espèce, son jardin, la météo de chez toi, ses derniers arrosages — pour nommer le problème et te proposer des gestes concrets, du plus doux au plus radical."
      points={points}
      visual={<GardenImagePlaceholder variant="diagnostic" />}
      aria-label="Fonctionnalité diagnostic IA"
    />
  )
}
