'use client'

import { sunExposureConfig, type Plant } from '@/lib/plant-types'
import { formatLogDate } from '@/lib/plant-dates'

/**
 * Les dates d'entretien de la plante — ce que la fiche mobile montre sous
 * « Entretien » et qui manquait ici.
 *
 * `PlantInfoGrid` juste au-dessus donne les caractéristiques (exposition,
 * fréquence, sol) ; ce bloc-ci donne l'historique récent en une ligne par
 * geste. Les deux se complètent : l'un dit ce dont la plante a besoin,
 * l'autre ce qu'elle a reçu.
 */
export function PlantCareData({ plant }: { plant: Plant }) {
  const sun = sunExposureConfig[plant.sunExposure]

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Dernier arrosage', value: formatLogDate(plant.lastWateredDate) },
    { label: 'Fréquence d’arrosage', value: `Tous les ${plant.wateringFrequencyDays} jours` },
    { label: 'Exposition', value: `${sun.icon} ${sun.label}` },
  ]

  if (plant.soilType) rows.push({ label: 'Sol', value: plant.soilType })
  if (plant.zone) rows.push({ label: 'Zone', value: plant.zone })
  if (plant.lastPrunedDate) {
    rows.push({ label: 'Dernière taille', value: formatLogDate(plant.lastPrunedDate) })
  }
  if (plant.lastFertilizedDate) {
    rows.push({ label: 'Dernière fertilisation', value: formatLogDate(plant.lastFertilizedDate) })
  }
  if (plant.containerSizeLiters) {
    rows.push({ label: 'Contenant', value: `${plant.containerSizeLiters} L` })
  }

  return (
    <section className="rounded-2xl bg-white shadow-card p-6 flex flex-col gap-1">
      <h2 className="font-poppins font-semibold text-lg text-forest mb-2">Entretien</h2>

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-4 border-b border-forest/5 py-2 last:border-0"
        >
          <span className="font-raleway text-sm text-forest/60">{row.label}</span>
          <span className="font-raleway text-sm font-medium text-forest text-right">
            {row.value}
          </span>
        </div>
      ))}
    </section>
  )
}
