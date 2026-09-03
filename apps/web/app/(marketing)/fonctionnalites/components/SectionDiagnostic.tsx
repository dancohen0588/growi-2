'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Camera, ScanLine, CalendarPlus, History } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionFeature } from './SectionFeature'
import { DiagnosisCard } from './SectionVisuals'

// Ces promesses décrivent ce que la fonctionnalité fait réellement depuis sa
// mise en service. Le télé-conseil avec un expert, annoncé ici auparavant,
// appartient encore à la feuille de route : le promettre sur la page
// publique alors que l'app ne l'offre pas nous exposait pour rien.
//
// L'identification photo rejoint ce bloc : elle a sa page, sa route et son
// onglet mobile, et n'était mentionnée nulle part.
const points = [
  { icon: Camera,       label: 'Identification en photo, et ajout de la plante à ton jardin avec sa fiche d’entretien' },
  { icon: ScanLine,     label: 'Maladies, carences et nuisibles repérés sur la photo' },
  { icon: CalendarPlus, label: 'Un plan de soin en quelques gestes datés — ajouté à ton calendrier si tu l’acceptes' },
  { icon: History,      label: 'État de santé mis à jour et historisé, après ton accord' },
]

export function SectionDiagnostic() {
  return (
    <SectionFeature
      id="diagnostic"
      bg="sand"
      eyebrow="Identification & diagnostic"
      title="Identifie et soigne tes plantes en un clic"
      description="Une plante inconnue ? Une feuille qui jaunit, une tache qui apparaît ? Photographie-la. Growi reconnaît l’espèce, ou croise l’image avec ce qu’il sait déjà de la plante — son exposition, la météo de chez toi, ses derniers arrosages — pour nommer le problème et te proposer des gestes concrets, du plus doux au plus radical."
      points={points}
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="forest" asChild>
              <Link href="/identifier">Identifier une plante — sans compte</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">Créer mon jardin</Link>
            </Button>
          </div>
          {/* Le diagnostic a besoin du contexte de la plante — jardin, météo,
              journal — donc d'un compte. L'identification, non. */}
          <p className="font-raleway text-sm leading-relaxed text-forest/80">
            L&apos;identification reste accessible sans être connecté. Le
            diagnostic, lui, a besoin du contexte de la plante — son jardin, la
            météo, son journal — et reste réservé aux comptes.
          </p>
        </div>
      }
      visual={
        <div className="flex flex-wrap items-start justify-center gap-5">
          <div className="w-[190px] shrink-0 overflow-hidden rounded-[1.5rem] bg-black shadow-card">
            <Image
              src="/images/app/app-identifier.webp"
              alt="L'écran Identifier de l'app Growi : prendre une photo ou en choisir une dans la galerie"
              width={800}
              height={1694}
              sizes="190px"
              className="block h-auto w-full"
            />
          </div>
          <DiagnosisCard />
        </div>
      }
      aria-label="Fonctionnalité identification et diagnostic"
    />
  )
}
