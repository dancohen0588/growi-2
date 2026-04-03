'use client'

import { CalendarDays, Sprout, Scissors, CloudRain } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: CalendarDays, label: 'Calendrier potager adapté à ta zone climatique' },
  { icon: Sprout,       label: 'Dates de semis et repiquage optimisées par plante' },
  { icon: Scissors,     label: 'Rappels taille, division, récolte au bon moment' },
  { icon: CloudRain,    label: 'Ajustements automatiques en cas de météo atypique' },
]

export function SectionCalendrier() {
  return (
    <SectionFeature
      id="calendrier"
      bg="sand"
      eyebrow="Calendrier"
      title="Ne rate plus jamais le bon moment pour semer"
      description="Growi construit ton planning annuel selon ta région, tes légumes et tes fleurs préférés. Chaque semaine, une liste de tâches courtes t'attend — taillée pour ton jardin, pas pour un jardin générique."
      points={points}
      visual={<GardenImagePlaceholder variant="calendrier" />}
      reverse={true}
      aria-label="Fonctionnalité calendrier potager"
    />
  )
}
