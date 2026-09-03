import { NewPlantForm } from '@/components/dashboard/plantes/NewPlantForm'
import { getCatalogPlantBySlug } from '@/lib/services/plant.service'

export const dynamic = 'force-dynamic'

/**
 * `?plant=<slug>` arrive de la page publique `/identifier`, via l'inscription :
 * le visiteur a identifié une plante avant d'avoir un compte, on lui évite de
 * la rechercher une seconde fois. Un slug inconnu ne casse rien — le
 * formulaire s'ouvre vide, comme d'habitude.
 */
export default async function NouvellePlantePage({
  searchParams,
}: {
  searchParams: { plant?: string }
}) {
  const slug = searchParams.plant
  const initialCatalogPlant = slug ? await getCatalogPlantBySlug(slug) : null

  return <NewPlantForm initialCatalogPlant={initialCatalogPlant} />
}
