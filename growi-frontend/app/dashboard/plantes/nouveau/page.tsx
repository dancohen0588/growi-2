// app/dashboard/plantes/nouveau/page.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { useToast } from '@/components/ui/toast'
import { PlantForm } from '@/components/dashboard/plantes/PlantForm'
import type { PlantFormValues } from '@/lib/plant-schemas'

export default function NouvelleePlantePage() {
  const { addPlant } = usePlants()
  const { toast } = useToast()
  const router = useRouter()

  async function handleSubmit(data: PlantFormValues) {
    const newPlant = addPlant(data)
    toast(`🌿 ${data.name} a bien été ajoutée à ton jardin !`)
    router.push(`/dashboard/plantes/${newPlant.id}`)
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 font-raleway text-xs text-forest/50">
        <Link href="/dashboard" className="hover:text-forest transition-colors">
          Tableau de bord
        </Link>
        <ChevronRight size={12} aria-hidden />
        <Link href="/dashboard/plantes" className="hover:text-forest transition-colors">
          Mes plantes
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span aria-current="page" className="text-forest font-medium">
          Ajouter une plante
        </span>
      </nav>

      {/* Heading */}
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
          Ajoute une nouvelle plante 🌱
        </h1>
        <p className="font-raleway text-forest/60 mt-1">
          Renseigne les informations de ta plante pour recevoir des conseils personnalisés.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-card p-6 md:p-8">
        <PlantForm onSubmit={handleSubmit} submitLabel="Ajouter la plante" />
      </div>
    </div>
  )
}
