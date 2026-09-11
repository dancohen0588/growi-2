import { Alert, Pressable, Text } from 'react-native'
import Constants from 'expo-constants'
import * as Sentry from '@sentry/react-native'

import { useToast } from '@/components/ui/Toast'
import { isPreviewBuild, resolveBuildNumber } from '@/lib/observability/sentry'

/**
 * Ligne de version, en pied de l'écran Profil.
 *
 * Elle a d'abord une raison bête : quand un testeur écrit « ça plante quand
 * j'ouvre le calendrier », la première question est « sur quel build ? ». Sans
 * ce numéro, personne ne sait y répondre.
 *
 * Elle porte aussi, **dans les seuls builds preview**, la vérification de la
 * chaîne Sentry : cinq secondes d'appui envoient un message, puis proposent un
 * crash volontaire. Cinq secondes parce que personne ne le fait par accident,
 * et parce que rien à l'écran n'invite à essayer. Ces deux gestes disparaissent
 * à la fin de la Friends & Family.
 */
export function VersionRow() {
  const toast = useToast()

  const version = Constants.expoConfig?.version ?? '0.0.0'
  const label = `Growi ${version} (${resolveBuildNumber()})`

  if (!isPreviewBuild()) {
    return (
      <Text className="text-center font-raleway text-caption text-muted-foreground">{label}</Text>
    )
  }

  const runCheck = () => {
    Sentry.captureMessage('test sentry mobile')
    toast('Message envoyé à Sentry 📡')

    Alert.alert(
      'Provoquer un crash ?',
      "L'app va se fermer. C'est volontaire : ça vérifie que les crashs remontent bien, et que la pile est lisible.",
      [
        { text: 'Non merci', style: 'cancel' },
        {
          text: 'Faire planter',
          style: 'destructive',
          onPress: () => {
            // Levée hors du cycle de rendu : une exception jetée depuis un
            // gestionnaire d'événement serait interceptée par l'enveloppe
            // React, et ne testerait pas le gestionnaire global.
            setTimeout(() => {
              throw new Error('Crash volontaire — vérification de la chaîne Sentry mobile')
            }, 0)
          },
        },
      ],
    )
  }

  return (
    <Pressable
      onLongPress={runCheck}
      delayLongPress={5000}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Appui long de cinq secondes : vérification de la remontée d'erreurs.`}
    >
      <Text className="text-center font-raleway text-caption text-muted-foreground">{label}</Text>
    </Pressable>
  )
}
