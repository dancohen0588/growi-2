import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { UserCircle2 } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { greeting } from '@/lib/dates'
import { useSession } from '@/store/session'

/**
 * Accueil — écran à concevoir, sur le web comme ici.
 *
 * Il annonce ce qu'il fera et renvoie vers ce qui existe déjà, plutôt que de
 * laisser un blanc. L'accès au profil s'y trouve en attendant : la barre
 * d'onglets est prise par les cinq destinations du jardin.
 */
export default function AccueilScreen() {
  const router = useRouter()
  const firstName = useSession((s) => s.user?.firstName)

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-2">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 font-poppins-bold text-screen text-forest">
            {greeting()}
            {firstName ? `, ${firstName}` : ''} 👋
          </Text>

          <Pressable
            onPress={() => router.push('/(tabs)/accueil/profil')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
          >
            <UserCircle2 size={28} color="#1E5631" />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-5xl">🌻</Text>
          <Text className="font-raleway text-body text-muted-foreground text-center max-w-xs">
            Ton tableau de bord arrive ici : l'état de tes jardins d'un coup d'œil, et ce qui
            demande ton attention.
          </Text>

          <View className="mt-2 w-full max-w-xs gap-2">
            <Button
              label="Voir mes gestes du jour"
              onPress={() => router.push('/(tabs)/calendrier')}
            />
            <Button
              label="Mes jardins"
              variant="outline"
              onPress={() => router.push('/(tabs)/jardins')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
