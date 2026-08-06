import type { Metadata } from 'next'
import { searchCatalog } from '@/lib/actions/catalog.actions'
import { CatalogueClient } from '@/components/dashboard/catalogue/CatalogueClient'

export const metadata: Metadata = {
  title: 'Catalogue de plantes',
}

export default async function CataloguePage() {
  const plants = await searchCatalog('')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
          Catalogue 🌱
        </h1>
        <p className="font-raleway text-forest/60 mt-1">
          {plants.length} espèces disponibles — recherchez et ajoutez à vos plantes.
        </p>
      </div>
      <CatalogueClient initialPlants={plants} />
    </div>
  )
}
