import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LogOut } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { useSession } from '@/store/session'

export default function ProfilScreen() {
  const user = useSession((s) => s.user)
  const signOut = useSession((s) => s.signOut)
  const [signingOut, setSigningOut] = useState(false)

  // Se déconnecter efface des données locales : on demande confirmation,
  // comme pour toute action difficile à annuler.
  const confirmSignOut = () => {
    Alert.alert('Se déconnecter', 'Tu devras saisir de nouveau ton mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await signOut()
          } finally {
            setSigningOut(false)
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-2 gap-6">
        <Text className="font-poppins-bold text-screen text-forest">Profil</Text>

        <Card>
          <CardTitle>{user?.firstName ?? 'Jardinier'}</CardTitle>
          <CardDescription>{user?.email ?? ''}</CardDescription>
        </Card>

        <View className="gap-2">
          <Text className="font-raleway text-secondary text-muted-foreground">
            La localisation, les préférences de rappels et le plan de ton jardin arrivent
            bientôt ici.
          </Text>
        </View>

        {/* Action en bas de l'écran, dans la zone du pouce. */}
        <View className="flex-1 justify-end pb-4">
          <Button
            label="Se déconnecter"
            variant="outline"
            loading={signingOut}
            onPress={confirmSignOut}
            icon={<LogOut size={20} color="#1E5631" />}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
