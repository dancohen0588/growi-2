'use client'

import { Map, Layers, CloudSun, NotebookPen } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { MapVisual } from './SectionVisuals'

// « Analyse automatique de l'exposition et des micro-climats » et
// « suggestions d'arrosage par zone » n'existent pas : le plan est un outil de
// dessin où l'on place ses plantes. À la place, ce qui existe vraiment —
// plusieurs jardins, et le journal par plante.
const points = [
  { icon: Map,         label: 'Crée le plan de ton jardin en quelques minutes, sur ordinateur — et consulte-le dans l’app' },
  { icon: Layers,      label: 'Zone par zone : pelouse, massifs, potager, terrasse, véranda' },
  { icon: CloudSun,    label: 'Plusieurs jardins, chacun avec son code postal et sa météo' },
  { icon: NotebookPen, label: 'Un journal par plante : arrosage, taille, fertilisation, récolte, traitement, rempotage, semis, santé' },
]

export function SectionCartographie() {
  return (
    <SectionFeature
      id="cartographie"
      bg="white"
      eyebrow="Cartographie"
      title="Visualise et organise ton jardin comme un pro"
      description="Dessine ton espace en quelques gestes, définis tes zones et place tes plantes. Growi sait alors où vit chacune d’elles, et adapte ses conseils à ton jardin — pas à un jardin en général."
      points={points}
      visual={<MapVisual />}
      footer={
        <div className="rounded-2xl border-l-4 border-lime bg-sand p-4">
          <p className="mb-1 font-poppins text-xs font-semibold uppercase tracking-wider text-forest/60">
            Pourquoi ça compte
          </p>
          <p className="font-raleway leading-relaxed text-forest/75">
            Ce que tu confies à Growi — zones, plantes, gestes faits — nourrit son
            calendrier, ses diagnostics et ses réponses. Plus il connaît ton
            jardin, plus il est précis.
          </p>
        </div>
      }
      aria-label="Fonctionnalité cartographie"
    />
  )
}
