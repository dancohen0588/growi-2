import type { Metadata } from 'next'

import { PublicIdentify } from '@/components/identify/PublicIdentify'

export const metadata: Metadata = {
  title: 'Identifier une plante en photo — gratuit, sans compte',
  description:
    "Photographie une plante, Growi reconnaît l'espèce et te donne ses besoins : arrosage, lumière, substrat. Gratuit, sans compte, en quelques secondes.",
  alternates: { canonical: '/identifier' },
  openGraph: {
    title: 'Identifier une plante en photo — Growi',
    description:
      "Photographie une plante, Growi reconnaît l'espèce et te donne ses besoins. Gratuit et sans compte.",
    url: '/identifier',
    type: 'website',
  },
}

/**
 * Le teaser de la home promettait « gratuit » et menait à
 * `/dashboard/identifier`, protégé par le middleware — donc au login. Cette
 * page tient la promesse : le parcours est le même que dans le tableau de
 * bord, seule l'action de fin change (créer un compte plutôt qu'ajouter la
 * plante à un jardin qui n'existe pas encore).
 */
export default function IdentifierPubliquePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <PublicIdentify />
    </div>
  )
}
