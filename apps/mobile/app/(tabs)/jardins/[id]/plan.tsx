import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Monitor } from 'lucide-react-native'

import { GardenPlanView } from '@/components/garden/GardenPlanView'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useGarden, useGardenPlan } from '@/lib/queries/gardens'

/**
 * Le plan en grand — le seul endroit de l'app où on peut le pincer pour zoomer.
 *
 * Lecture seule, comme partout : l'éditeur demande un pointeur précis et une
 * surface qu'un téléphone n'a pas. La mention en bas le rappelle ici aussi,
 * puisqu'on peut arriver sur cet écran par un lien sans passer par la fiche.
 */
export default function GardenPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const garden = useGarden(id)
  const plan = useGardenPlan(id)

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center gap-2 px-2 pb-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retour au jardin"
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>

        <View className="flex-1">
          <Text className="font-poppins text-body text-forest" numberOfLines={1}>
            Plan du jardin
          </Text>
          {garden.data ? (
            <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
              {garden.data.name}
            </Text>
          ) : null}
        </View>
      </View>

      {plan.isPending ? (
        <View className="flex-1 px-4 pt-2">
          <ListSkeleton count={3} />
        </View>
      ) : plan.isError ? (
        <ErrorState message={errorMessage(plan.error)} onRetry={() => void plan.refetch()} />
      ) : (
        <GardenPlanView plan={plan.data} interactive />
      )}

      <View className="flex-row items-center gap-2 px-4 py-3">
        <Monitor size={16} color="hsl(139 20% 40%)" />
        <Text className="flex-1 font-raleway text-caption text-muted-foreground">
          Consultation seule — le plan se modifie depuis un ordinateur, sur growi.app
        </Text>
      </View>
    </SafeAreaView>
  )
}
