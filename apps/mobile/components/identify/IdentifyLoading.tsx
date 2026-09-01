import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

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
    <View className="items-center gap-3 py-16">
      <ActivityIndicator size="large" color="#1E5631" />
      <Text className="font-raleway text-body text-muted-foreground text-center">
        {LOADING_MESSAGES[index]}
      </Text>
    </View>
  )
}
