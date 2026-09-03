import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Leaf, Stethoscope } from 'lucide-react'

import { getUserPlants } from '@/lib/actions/plant.actions'
import { PlantHealthBadge } from '@/components/dashboard/plantes/PlantHealthBadge'

export const metadata: Metadata = { title: 'Diagnostic IA' }

/**
 * Point d'entrée du diagnostic depuis la navigation.
 *
 * Le diagnostic porte toujours sur une plante précise — c'est son contexte
 * (fiche, jardin, météo, journal) qui fait la qualité de l'analyse. Cette page
 * ne fait donc que conduire à la bonne fiche, où le parcours se déroule.
 */
export default async function DiagnosticPage() {
  const plants = await getUserPlants()

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-forest text-white">
            <Stethoscope size={18} aria-hidden />
          </span>
          <h1 className="font-poppins font-bold text-2xl text-forest">Diagnostic IA</h1>
        </div>
        <p className="font-raleway text-sm text-forest/60">
          Choisis une plante : l&apos;analyse croise ta photo avec sa fiche, son
          jardin, la météo de chez toi et son journal d&apos;entretien.
        </p>
      </header>

      {plants.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lime/15 flex items-center justify-center text-forest">
            <Leaf size={26} aria-hidden />
          </div>
          <p className="font-poppins font-semibold text-forest">
            Aucune plante à diagnostiquer
          </p>
          <p className="font-raleway text-sm text-forest/60 max-w-sm">
            Ajoute une plante à ton jardin pour pouvoir suivre son état de santé.
          </p>
          <Link
            href="/dashboard/plantes/nouveau"
            className="rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-5 py-2.5 hover:bg-forest/90 transition-colors"
          >
            Ajouter une plante
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {plants.map((plant) => (
            <li key={plant.id}>
              <Link
                href={`/dashboard/plantes/${plant.id}`}
                className="rounded-2xl bg-white shadow-card p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow"
              >
                <span className="text-2xl" aria-hidden>
                  {plant.emoji}
                </span>
                <span className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <span className="font-poppins font-semibold text-sm text-forest truncate">
                    {plant.name}
                  </span>
                  <PlantHealthBadge status={plant.healthStatus} className="self-start" />
                </span>
                <ArrowRight size={16} className="shrink-0 text-forest/40" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
