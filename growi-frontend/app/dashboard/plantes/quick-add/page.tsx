import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { addPlantToMyGarden } from '@/lib/actions/plant.actions'

export const dynamic = 'force-dynamic'

export default async function QuickAddPlantPage({
  searchParams,
}: {
  searchParams: { catalogId?: string }
}) {
  const catalogId = searchParams.catalogId
  if (!catalogId) redirect('/dashboard/plantes')

  const cat = await prisma.plantCatalog.findUnique({
    where: { id: catalogId },
    select: { indoor: true, outdoor: true },
  })

  const location: 'INDOOR' | 'OUTDOOR' =
    cat?.indoor && !cat?.outdoor ? 'INDOOR' : 'OUTDOOR'

  await addPlantToMyGarden({ catalogPlantId: catalogId, location })

  redirect('/dashboard/plantes')
}
