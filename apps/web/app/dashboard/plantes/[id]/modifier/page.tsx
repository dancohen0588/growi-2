// app/dashboard/plantes/[id]/modifier/page.tsx
'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { usePlants } from '@/lib/plants-context'
import { useToast } from '@/components/ui/toast'
import { PlantForm } from '@/components/dashboard/plantes/PlantForm'
import type { PlantFormValues } from '@/lib/plant-schemas'

interface PageProps {
  params: { id: string }
}

export default function ModifierPlantePage({ params }: PageProps) {
  const { plants, updatePlant } = usePlants()
  const { toast } = useToast()
  const router = useRouter()

  const plant = plants.find(p => p.id === params.id)
  if (!plant) return notFound()
  // plant is defined past this point — TS can't infer notFound() as never
  const plantId = plant.id

  async function handleSubmit(data: PlantFormValues) {
    // Attendre l'écriture avant d'annoncer le succès : la page félicitait
    // l'utilisateur sans savoir si quoi que ce soit avait été enregistré.
    try {
      await updatePlant(plantId, data)
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "La plante n'a pas pu être mise à jour.",
      )
      return
    }

    toast(`✅ Ta plante a bien été mise à jour.`)
    router.push(`/dashboard/plantes/${plantId}`)
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
        <Link
          href={`/dashboard/plantes/${plant.id}`}
          className="hover:text-forest transition-colors"
        >
          {plant.name}
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span aria-current="page" className="text-forest font-medium">
          Modifier
        </span>
      </nav>

      {/* Heading */}
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
          Modifier {plant.emoji} {plant.name}
        </h1>
        <p className="font-raleway text-forest/60 mt-1">
          Mets à jour les informations de ta plante.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-card p-6 md:p-8">
        {/* `manual` : on modifie une plante existante, il n'y a rien à
            rechercher dans le catalogue. Sans ce mode, l'écran s'ouvrait sur
            « Trouve ta plante » et le formulaire restait invisible. */}
        <PlantForm
          defaultValues={plant}
          mode="manual"
          onSubmit={handleSubmit}
          submitLabel="Enregistrer les modifications"
        />
      </div>
    </div>
  )
}
