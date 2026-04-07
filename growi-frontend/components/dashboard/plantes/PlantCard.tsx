import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { type Plant, locationConfig } from '@/lib/mock-plants'
import { PlantHealthBadge } from './PlantHealthBadge'
import { PlantWateringBar } from './PlantWateringBar'

interface PlantCardProps {
  plant: Plant
}

export function PlantCard({ plant }: PlantCardProps) {
  const locationInfo = locationConfig[plant.location]

  return (
    <Link
      href={`/dashboard/plantes/${plant.id}`}
      aria-label={`Voir la fiche de ${plant.name}`}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100',
      )}
    >
      {/* Health badge — top right */}
      <div className="absolute top-3 right-3">
        <PlantHealthBadge status={plant.healthStatus} />
      </div>

      {/* Photo / emoji */}
      <div className="aspect-square w-full rounded-xl overflow-hidden bg-lime/10 flex items-center justify-center">
        {plant.photoUrl ? (
          <Image
            src={plant.photoUrl}
            alt={plant.name}
            width={200}
            height={200}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-5xl" role="img" aria-label={plant.name}>
            {plant.emoji}
          </span>
        )}
      </div>

      {/* Name */}
      <div>
        <h3 className="font-poppins font-semibold text-sm text-forest leading-tight">
          {plant.name}
        </h3>
        {plant.scientificName && (
          <p className="font-raleway italic text-xs text-forest/50 mt-0.5">
            {plant.scientificName}
          </p>
        )}
      </div>

      {/* Location */}
      <p className="font-raleway text-xs text-forest/60 flex items-center gap-1">
        <span aria-hidden>{locationInfo.icon}</span>
        {plant.zone ?? locationInfo.label}
      </p>

      {/* Watering bar */}
      <PlantWateringBar plant={plant} showLabel />
    </Link>
  )
}
