import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { GrowiLoader } from '@/components/ui/GrowiLoader'

/** Les mêmes étapes que sur le web : photo, analyse, résultat. */
const LOADING_MESSAGES = [
  'Analyse de la photo en cours…',
  "Identification de l'espèce…",
  "Consultation de l'encyclopédie…",
  'Rédaction de la fiche…',
]

/**
 * Attente de l'identification.
 *
 * Fait défiler les messages pour que l'attente reste habitée : l'appel au
 * modèle prend plusieurs secondes, un spinner seul les fait paraître longues.
 */
export function IdentifyLoading() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LOADING_MESSAGES.length), 2200)
    return () => clearInterval(timer)
  }, [])

  return (
    <View className="items-center gap-4 py-16" accessibilityLiveRegion="polite">
      <GrowiLoader motion="pousse" size={88} label={null} />
      <Text className="font-raleway text-body text-muted-foreground text-center">
        {LOADING_MESSAGES[index]}
      </Text>
    </View>
  )
}
