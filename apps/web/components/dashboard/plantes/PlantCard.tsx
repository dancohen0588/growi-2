import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { type Plant, locationConfig } from '@/lib/plant-types'
import { PlantHealthBadge } from './PlantHealthBadge'
import { PlantWateringBar } from './PlantWateringBar'

interface PlantCardProps {
  plant: Plant
  priority?: boolean
}

export function PlantCard({ plant, priority = false }: PlantCardProps) {
  const locationInfo = locationConfig[plant.location]

  // Resolve image source: user photo > catalog photo > emoji fallback
  const catalogImageUrl = plant.catalogPlant?.imageUrl ?? null
  const imageSrc = plant.photoUrl ?? catalogImageUrl
  const isCatalogImage = !plant.photoUrl && catalogImageUrl != null

  return (
    <Link
      href={`/dashboard/plantes/${plant.id}`}
      aria-label={`Voir la fiche de ${plant.name}`}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card hover:shadow-card-hover transition-all duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100',
      )}
    >
      {/* Health badge — top right */}
      <div className="absolute top-3 right-3 z-10">
        <PlantHealthBadge status={plant.healthStatus} />
      </div>

      {/* Photo / catalog image / emoji */}
      <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-lime/10 flex items-center justify-center">
        {imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt={plant.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              quality={75}
              priority={priority}
            />
            {isCatalogImage && (
              <span
                aria-label="Photo issue du catalogue Growi"
                className="absolute top-2 left-2 z-10 rounded-md bg-forest/70 px-1.5 py-0.5 font-raleway text-[10px] font-semibold text-white backdrop-blur-sm"
              >
                📚 Catalogue
              </span>
            )}
          </>
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
