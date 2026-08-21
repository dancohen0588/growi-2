import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { GARDEN_TYPE_LABELS, type GardenType, type GardenWithStats } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { useGardens } from '@/lib/queries/gardens'
import { errorMessage } from '@/lib/errors'

function plantCountLabel(count: number | undefined): string {
  if (!count) return 'Aucune plante pour l’instant'
  return count === 1 ? '1 plante' : `${count} plantes`
}

function GardenCard({ garden, onPress }: { garden: GardenWithStats; onPress: () => void }) {
  const typeLabel = GARDEN_TYPE_LABELS[garden.type as GardenType] ?? garden.type

  return (
    <Card onPress={onPress} accessibilityLabel={`Jardin ${garden.name}, ${typeLabel}`}>
      <View className="gap-1">
        <CardTitle>{garden.name}</CardTitle>
        <Text className="font-raleway text-secondary text-muted-foreground">
          {typeLabel} · {plantCountLabel(garden.plantCount)}
        </Text>
      </View>
    </Card>
  )
}

export default function JardinsScreen() {
  const router = useRouter()
  const { data: gardens, isPending, isError, error, refetch } = useGardens()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const goToNew = () => router.push('/(tabs)/jardins/nouveau')

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-2">
        <Text className="font-poppins-bold text-screen text-forest mb-4">Mes jardins</Text>

        <ScrollView
          contentContainerClassName="pb-4 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
          }
        >
          {isPending ? (
            <ListSkeleton />
          ) : isError ? (
            <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
          ) : gardens.length === 0 ? (
            <EmptyState
              emoji="🌱"
              title="Ton premier jardin t’attend"
              message="Crée un jardin pour y ranger tes plantes et recevoir des conseils adaptés."
              cta={{ label: 'Créer un jardin', onPress: goToNew }}
            />
          ) : (
            gardens.map((garden) => (
              <GardenCard
                key={garden.id}
                garden={garden}
                onPress={() => router.push(`/(tabs)/jardins/${garden.id}`)}
              />
            ))
          )}
        </ScrollView>

        {/* Action principale en bas, dans la zone du pouce. */}
        {gardens && gardens.length > 0 ? (
          <View className="pb-4 pt-2">
            <Button
              label="Créer un jardin"
              onPress={goToNew}
              icon={<Plus size={20} color="#1E5631" />}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}
