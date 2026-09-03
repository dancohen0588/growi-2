'use client'

import { IdentifyFlow } from '@/components/identify/IdentifyFlow'
import { IdentifiedPlantCta } from '@/components/identify/IdentifiedPlantCta'

/**
 * `renderActions` est une fonction : elle ne peut pas franchir la frontière
 * d'un Server Component. La page reste serveur pour porter ses métadonnées, et
 * la composition se fait ici.
 */
export function PublicIdentify() {
  return (
    <IdentifyFlow
      title="Identifier une plante en photo"
      intro="Prends ou choisis une photo — l'IA reconnaît l'espèce et te donne ses besoins. Gratuit, sans compte."
      renderActions={(plant) => <IdentifiedPlantCta plant={plant} />}
    />
  )
}
