'use client'

import { Sprout, Scissors, CloudRain, CheckCheck } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { CalendarVisual } from './SectionVisuals'

// « Planning annuel » était trop large : le moteur produit des gestes à horizon
// court, ajustés à la météo réelle. Les puces suivent les règles codées.
const points = [
  { icon: Sprout,     label: 'Dates de semis et de repiquage au bon moment pour ta zone climatique' },
  { icon: Scissors,   label: 'Rappels taille, récolte, fertilisation et rempotage, plante par plante' },
  { icon: CloudRain,  label: 'Ajustements en cas de météo atypique : canicule, pluie, gel tardif' },
  { icon: CheckCheck, label: 'Tu coches un geste fait, il l’enregistre et décale le suivant' },
]

export function SectionCalendrier() {
  return (
    <SectionFeature
      id="calendrier"
      bg="white"
      eyebrow="Calendrier"
      title="Ne rate plus jamais le bon moment pour semer"
      description="Semis intérieur ou extérieur, taille, récolte, fertilisation, rempotage : Growi cale chaque geste sur ta région et ta météo réelle, et l’ajuste quand la saison ne suit pas le calendrier."
      points={points}
      visual={<CalendarVisual />}
      reverse={true}
      aria-label="Fonctionnalité calendrier"
    />
  )
}
