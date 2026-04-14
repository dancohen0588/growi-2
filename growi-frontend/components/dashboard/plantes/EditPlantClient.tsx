'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { useToast } from '@/components/ui/toast'
import { type Plant } from '@/lib/plant-types'
import type { PlantFormValues } from '@/lib/plant-schemas'
import { PlantForm } from './PlantForm'

interface EditPlantClientProps {
  plant: Plant
}

export function EditPlantClient({ plant }: EditPlantClientProps) {
  const { updatePlant } = usePlants()
  const { toast } = useToast()
  const router = useRouter()

  async function handleSubmit(data: PlantFormValues) {
    await updatePlant(plant.id, data)
    toast(`✅ Ta plante a bien été mise à jour.`)
    router.push(`/dashboard/plantes/${plant.id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane">
        <ol className="flex items-center gap-1.5 font-raleway text-xs text-forest/50">
          <li>
            <Link href="/dashboard/plantes" className="hover:text-forest transition-colors">
              Mes plantes
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight size={12} />
          </li>
          <li>
            <Link
              href={`/dashboard/plantes/${plant.id}`}
              className="hover:text-forest transition-colors"
            >
              {plant.name}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight size={12} />
          </li>
          <li aria-current="page" className="text-forest font-medium">
            Modifier
          </li>
        </ol>
      </nav>

      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Modifier {plant.emoji} {plant.name}
        </h1>
        <p className="font-raleway text-sm text-forest/60 mt-1">
          Mets à jour les informations de ta plante.
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-card p-6">
        <PlantForm
          defaultValues={plant}
          onSubmit={handleSubmit}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  )
}
