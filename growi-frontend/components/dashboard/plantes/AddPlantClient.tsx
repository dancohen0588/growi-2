'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { useToast } from '@/components/ui/toast'
import type { PlantFormValues } from '@/lib/plant-schemas'
import { PlantForm } from './PlantForm'

export function AddPlantClient() {
  const { addPlant } = usePlants()
  const { toast } = useToast()
  const router = useRouter()

  async function handleSubmit(data: PlantFormValues) {
    const newPlant = await addPlant(data)
    toast(`🌿 ${data.name} a bien été ajoutée !`)
    if (newPlant) {
      router.push(`/dashboard/plantes/${newPlant.id}`)
    } else {
      router.push('/dashboard/plantes')
    }
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
          <li aria-current="page" className="text-forest font-medium">
            Nouvelle plante
          </li>
        </ol>
      </nav>

      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">
          Ajouter une plante 🌱
        </h1>
        <p className="font-raleway text-sm text-forest/60 mt-1">
          Renseigne les informations de ta plante pour commencer à suivre son entretien.
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-card p-6">
        <PlantForm onSubmit={handleSubmit} submitLabel="Ajouter la plante" />
      </div>
    </div>
  )
}
