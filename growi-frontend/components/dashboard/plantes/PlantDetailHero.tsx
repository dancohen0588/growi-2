'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Plant, locationConfig } from '@/lib/mock-plants'
import { PlantHealthBadge } from './PlantHealthBadge'
import { PlantWateringBar } from './PlantWateringBar'
import { PlantDeleteDialog } from './PlantDeleteDialog'
import { usePlants } from '@/lib/plants-context'
import { useToast } from '@/components/ui/toast'

interface PlantDetailHeroProps {
  plant: Plant
}

export function PlantDetailHero({ plant }: PlantDetailHeroProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { deletePlant } = usePlants()
  const { toast } = useToast()
  const router = useRouter()
  const locationInfo = locationConfig[plant.location]

  function handleDelete() {
    deletePlant(plant.id)
    toast(`🌿 ${plant.name} a bien été supprimée.`)
    router.push('/dashboard/plantes')
  }

  const dateAddedFormatted = new Date(plant.dateAdded).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Photo / emoji */}
        <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-lime/20 to-forest/10 flex items-center justify-center">
          {plant.photoUrl ? (
            <Image
              src={plant.photoUrl}
              alt={plant.name}
              width={500}
              height={500}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-8xl" role="img" aria-label={plant.name}>
              {plant.emoji}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {/* Category badge */}
          <span className="inline-flex w-fit items-center rounded-full bg-lime/20 px-3 py-1 font-raleway text-xs font-semibold text-forest capitalize">
            {plant.category}
          </span>

          {/* Name */}
          <div>
            <h1 className="font-poppins font-bold text-3xl text-forest flex items-center gap-2">
              <span aria-hidden>{plant.emoji}</span>
              {plant.name}
            </h1>
            {plant.scientificName && (
              <p className="font-raleway italic text-forest/50 mt-1">{plant.scientificName}</p>
            )}
          </div>

          {/* Health */}
          <div className="flex items-center gap-2">
            <PlantHealthBadge status={plant.healthStatus} />
            {plant.healthNote && (
              <p className="font-raleway text-sm text-forest/70">{plant.healthNote}</p>
            )}
          </div>

          {/* Quick info */}
          <ul className="space-y-2 font-raleway text-sm text-forest/70">
            {plant.zone && (
              <li className="flex items-center gap-2">
                <span aria-hidden>{locationInfo.icon}</span>
                <span>
                  <strong className="text-forest">Zone :</strong> {plant.zone}
                </span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              <span>
                <strong className="text-forest">Ajoutée le :</strong> {dateAddedFormatted}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>💧</span>
              <span>
                <strong className="text-forest">Arrosage :</strong> tous les {plant.wateringFrequencyDays} jour{plant.wateringFrequencyDays > 1 ? 's' : ''}
              </span>
            </li>
          </ul>

          {/* Watering bar — large */}
          <div className="bg-sand rounded-xl p-4">
            <p className="font-raleway text-xs text-forest/60 mb-2 uppercase tracking-wide font-semibold">
              Prochain arrosage
            </p>
            <PlantWateringBar plant={plant} showLabel />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/plantes/${plant.id}/modifier`}>
                <Pencil size={14} aria-hidden />
                Modifier
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      <PlantDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        plantName={plant.name}
        onConfirm={handleDelete}
      />
    </>
  )
}
