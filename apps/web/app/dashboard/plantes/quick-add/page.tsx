import { redirect } from 'next/navigation'
import { getCatalogDefaultLocation } from '@/lib/services/plant.service'
import { addPlantToMyGarden } from '@/lib/actions/plant.actions'

export const dynamic = 'force-dynamic'

export default async function QuickAddPlantPage({
  searchParams,
}: {
  searchParams: { catalogId?: string }
}) {
  const catalogId = searchParams.catalogId
  if (!catalogId) redirect('/dashboard/plantes')

  const location = await getCatalogDefaultLocation(catalogId)

  await addPlantToMyGarden({ catalogPlantId: catalogId, location })

  redirect('/dashboard/plantes')
}
