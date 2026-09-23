import { Text } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

import { WEB_BASE_URL } from '@/lib/api'

/**
 * Mention d'acceptation des CGU et de la politique, sous les boutons qui
 * créent un compte.
 *
 * Pas de case à cocher (spec 13, D8) : la loi française ne l'exige pas, la
 * mention suffit, et la trace est écrite côté serveur à la création
 * (`termsAcceptedAt`, `termsVersion`). Les textes s'ouvrent dans le navigateur
 * intégré, comme les autres pages du site depuis le profil.
 */
export function TermsNotice({ lead }: { lead: string }) {
  return (
    <Text className="text-center font-raleway text-secondary text-muted-foreground">
      {lead} tu acceptes les{' '}
      <Text
        accessibilityRole="link"
        className="font-raleway-semibold text-forest underline"
        onPress={() => void openLegal('/cgu')}
      >
        CGU
      </Text>{' '}
      et la{' '}
      <Text
        accessibilityRole="link"
        className="font-raleway-semibold text-forest underline"
        onPress={() => void openLegal('/confidentialite')}
      >
        politique de confidentialité
      </Text>
      .
    </Text>
  )
}

async function openLegal(path: string) {
  await WebBrowser.openBrowserAsync(`${WEB_BASE_URL}${path}`, {
    toolbarColor: '#F9F7E8',
    controlsColor: '#1E5631',
  })
}
