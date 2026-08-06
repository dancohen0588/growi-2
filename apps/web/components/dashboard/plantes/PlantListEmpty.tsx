import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PlantListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-lime/10">
        <Leaf size={40} className="text-lime" aria-hidden />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="font-poppins font-semibold text-xl text-forest">
          Ton jardin t&apos;attend ! 🌱
        </h2>
        <p className="font-raleway text-forest/60 leading-relaxed">
          Tu n&apos;as pas encore de plantes. Ajoute ta première plante pour commencer
          à suivre son entretien et recevoir des conseils personnalisés.
        </p>
      </div>
      <Button variant="primary" asChild>
        <Link href="/dashboard/plantes/nouveau">+ Ajouter une plante</Link>
      </Button>
    </div>
  )
}
