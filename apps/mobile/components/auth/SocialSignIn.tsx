import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import type { SocialProvider } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { isAppleSignInAvailable, isGoogleSignInAvailable } from '@/lib/social-auth'
import { authErrorMessage, useSession } from '@/store/session'

export interface SocialSignInProps {
  /** Remonte le message à afficher — l'écran porte déjà un emplacement d'erreur. */
  onError: (message: string) => void
  /** Vidé au début de chaque tentative, pour ne pas laisser une erreur périmée. */
  onStart?: () => void
}

/**
 * Connexion par Apple et Google, partagée par les écrans de connexion et
 * d'inscription — c'est le même geste : le premier passage crée le compte.
 *
 * Chaque bouton ne s'affiche que là où il fonctionne : celui d'Apple sur iOS
 * seulement, celui de Google si le build porte un identifiant client. Un
 * bouton qui échouerait à coup sûr vaut moins que pas de bouton.
 */
export function SocialSignIn({ onError, onStart }: SocialSignInProps) {
  const signInWith = useSession((s) => s.signInWith)
  const [appleReady, setAppleReady] = useState(false)
  const [pending, setPending] = useState<SocialProvider | null>(null)

  const googleReady = isGoogleSignInAvailable()

  useEffect(() => {
    let active = true
    void isAppleSignInAvailable().then((available) => {
      if (active) setAppleReady(available)
    })
    return () => {
      active = false
    }
  }, [])

  if (!appleReady && !googleReady) return null

  const start = async (provider: SocialProvider) => {
    onStart?.()
    setPending(provider)
    try {
      await signInWith(provider)
      // Un renoncement ne dit rien : la feuille s'est simplement refermée.
    } catch (error) {
      onError(authErrorMessage(error))
    } finally {
      setPending(null)
    }
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="font-raleway text-caption text-muted-foreground">ou</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <View className="gap-3">
        {appleReady ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            // Apple impose son propre bouton, y compris sa hauteur minimale de
            // 44 pt : la nôtre s'aligne dessus plutôt que l'inverse.
            style={{ height: 44, width: '100%' }}
            onPress={() => void start('apple')}
          />
        ) : null}

        {googleReady ? (
          <Button
            label="Continuer avec Google"
            variant="outline"
            loading={pending === 'google'}
            disabled={pending !== null}
            onPress={() => void start('google')}
          />
        ) : null}
      </View>
    </View>
  )
}
