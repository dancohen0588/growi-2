'use client'

import { IdentifyFlow } from '@/components/identify/IdentifyFlow'
import { AddIdentifiedPlantButton } from '@/components/identify/AddIdentifiedPlantButton'

/**
 * Le parcours lui-même vit dans `components/identify/IdentifyFlow` : la page
 * publique `/identifier` s'en sert aussi. Seule change l'action proposée une
 * fois la plante reconnue — ici, l'ajouter à son jardin.
 */
export default function IdentifierPage() {
  return (
    <IdentifyFlow
      title="Identifier une plante"
      intro="Photographie une plante — l'IA l'identifie et te livre sa fiche."
      renderActions={(plant) => <AddIdentifiedPlantButton plant={plant} />}
    />
  )
}
