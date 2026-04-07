import { cn } from '@/lib/utils'
import {
  type Plant,
  sunExposureConfig,
  locationConfig,
  difficultyConfig,
} from '@/lib/mock-plants'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface InfoCellProps {
  icon: string
  label: string
  value: string
  valueClass?: string
}

function InfoCell({ icon, label, value, valueClass }: InfoCellProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime/10 text-lg" aria-hidden>
        {icon}
      </div>
      <p className="font-raleway text-[10px] font-semibold uppercase tracking-wider text-forest/50">
        {label}
      </p>
      <p className={cn('font-poppins font-semibold text-sm text-forest', valueClass)}>
        {value}
      </p>
    </div>
  )
}

interface PlantInfoGridProps {
  plant: Plant
}

export function PlantInfoGrid({ plant }: PlantInfoGridProps) {
  const sun = sunExposureConfig[plant.sunExposure]
  const loc = locationConfig[plant.location]
  const difficulty = difficultyConfig[plant.wateringDifficulty]

  const plantedDate = plant.datePlanted
    ? new Date(plant.datePlanted).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const fertilizerLabel = plant.fertilizerMonths
    ? plant.fertilizerMonths.map(m => MONTHS[m - 1]).join(', ')
    : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <InfoCell
        icon={sun.icon}
        label="Exposition"
        value={sun.label}
      />
      <InfoCell
        icon="💧"
        label="Arrosage"
        value={`Tous les ${plant.wateringFrequencyDays} j.`}
      />
      <InfoCell
        icon="🌱"
        label="Sol"
        value={plant.soilType ?? 'Non renseigné'}
      />
      <InfoCell
        icon={loc.icon}
        label="Emplacement"
        value={plant.zone ?? loc.label}
      />
      <InfoCell
        icon="📊"
        label="Difficulté"
        value={difficulty.label}
        valueClass={difficulty.color}
      />
      {plantedDate && (
        <InfoCell
          icon="📅"
          label="Planté le"
          value={plantedDate}
        />
      )}
      {fertilizerLabel && (
        <InfoCell
          icon="🌿"
          label="Engrais"
          value={fertilizerLabel}
        />
      )}
    </div>
  )
}
