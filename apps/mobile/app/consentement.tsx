import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { analytics } from '@/lib/analytics/posthog'
import { WEB_BASE_URL } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { hasSeenOnboarding } from '@/lib/onboarding-storage'
import { useUpdateProfile } from '@/lib/queries/me'
import { useSession } from '@/store/session'

/**
 * La question du consentement à la mesure d'usage — posée une fois par
 * compte, avant les onglets (`app/(tabs)/_layout.tsx` y renvoie tant que la
 * réponse manque). Route racine, comme l'onboarding, et sans geste de retour :
 * il n'y a rien derrière où revenir.
 *
 * Les deux réponses ont **le même poids** — même variante, même taille, même
 * largeur — et aucune n'est pré-choisie : un « non » plus discret que le
 * « oui » vaudrait consentement forcé. Elles sont en bas, sous le pouce.
 *
 * Le choix est d'abord enregistré sur le compte, puis appliqué : un oui qui
 * n'aurait pas atteint le serveur démarrerait une mesure que le compte ignore.
 */
export default function ConsentementScreen() {
  const toast = useToast()
  const updateProfile = useUpdateProfile()
  const setAnalyticsConsent = useSession((s) => s.setAnalyticsConsent)
  const [pending, setPending] = useState<boolean | null>(null)

  const choose = async (choice: boolean) => {
    setPending(choice)
    try {
      await updateProfile.mutateAsync({ analyticsConsent: choice })
      setAnalyticsConsent(choice)

      // La présentation a eu lieu avant qu'on puisse mesurer quoi que ce soit :
      // sa propriété de personne est reposée maintenant, sans quoi la tuile
      // « onboarding terminé » resterait vide pour tous les nouveaux comptes.
      if (choice && (await hasSeenOnboarding())) {
        analytics().setPersonProperties({ onboarding_completed: true })
      }

      router.replace('/(tabs)/accueil')
    } catch (error) {
      toast(errorMessage(error), 'error')
      setPending(null)
    }
  }

  const openDetails = () =>
    void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/confidentialite#mesure-d-usage`, {
      toolbarColor: '#F9F7E8',
      controlsColor: '#1E5631',
    })

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center gap-4 px-4 py-6"
      >
        <Text className="text-5xl" accessibilityElementsHidden importantForAccessibility="no">
          🌱
        </Text>
        <Text accessibilityRole="header" className="font-poppins-bold text-screen text-forest">
          Aider à améliorer Growi ?
        </Text>
        <Text className="font-raleway text-body text-forest">
          Pour savoir quelles fonctions servent vraiment, Growi peut mesurer les écrans que tu
          ouvres et les gestes que tu fais dans l’app — jamais tes photos, tes messages ni ton
          jardin. Tu peux changer d’avis à tout moment depuis ton profil.
        </Text>
        <Pressable
          onPress={openDetails}
          accessibilityRole="link"
          hitSlop={12}
          className="min-h-11 justify-center self-start"
        >
          <Text className="font-raleway-semibold text-sm text-forest underline">
            Voir ce qui est mesuré
          </Text>
        </Pressable>
      </ScrollView>

      <View className="gap-3 px-4 pb-4 pt-2">
        <Button
          label="Oui, j’aide"
          variant="outline"
          size="lg"
          loading={pending === true}
          disabled={pending !== null}
          onPress={() => void choose(true)}
        />
        <Button
          label="Non merci"
          variant="outline"
          size="lg"
          loading={pending === false}
          disabled={pending !== null}
          onPress={() => void choose(false)}
        />
      </View>
    </SafeAreaView>
  )
}
