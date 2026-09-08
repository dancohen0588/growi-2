export type ActionType =
  | 'arrosage'
  | 'taille'
  | 'semis'
  | 'rempotage'
  | 'fertilisation'
  | 'traitement'
  | 'recolte'
  | 'autre'

export type ActionPriority = 'high' | 'medium' | 'low'

// Ce module redéfinissait `GardenAction` à l'identique du moteur. Les deux
// copies ont divergé dès qu'un champ a été ajouté d'un seul côté : le type
// canonique vit désormais dans `lib/recommendation/types.ts`, et il est
// simplement réexporté ici pour les dix écrans du calendrier qui l'importent.
//
// Le jeu d'actions factices qui donnait son nom au module est parti avec la v2
// du planning : plus rien ne l'affichait depuis que le calendrier lit le
// moteur, et il portait encore des `estimatedMinutes` que les cartes ne
// montrent plus.
import type { GardenAction } from '@/lib/recommendation/types'

export type { GardenAction }

// Lucide icon name per type — used in card/row components
export const actionTypeIcon: Record<ActionType, string> = {
  arrosage:     'Droplets',
  taille:       'Scissors',
  semis:        'Sprout',
  rempotage:    'Package',
  fertilisation:'FlaskConical',
  traitement:   'Shield',
  recolte:      'Apple',
  autre:        'Wrench',
}

// Dot colour per type — used in CalendarView
export const actionTypeDotColor: Record<ActionType, string> = {
  arrosage:     'bg-blue-400',
  taille:       'bg-forest',
  semis:        'bg-lime',
  rempotage:    'bg-amber-500',
  fertilisation:'bg-purple-400',
  traitement:   'bg-red-400',
  recolte:      'bg-sun',
  autre:        'bg-gray-400',
}
