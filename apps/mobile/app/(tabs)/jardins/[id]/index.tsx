import { useCallback, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react-native'
import {
  GARDEN_TYPE_LABELS,
  PLANT_LOCATION_LABELS,
  type GardenType,
  type PlantInstanceWithRelations,
  type PlantLocation,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useDeleteGarden, useGarden, useGardenPlants } from '@/lib/queries/gardens'

function plantName(plant: PlantInstanceWithRelations): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

// Non cliquable pour l'instant : la fiche plante arrive à l'étape suivante, et
// une carte qui semble tactile sans mener nulle part est pire qu'une carte inerte.
function PlantCard({ plant }: { plant: PlantInstanceWithRelations }) {
  const location = PLANT_LOCATION_LABELS[plant.location as PlantLocation] ?? plant.location
  const emoji = plant.emoji ?? plant.catalogPlant?.emoji ?? '🌿'

  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Text className="text-3xl">{emoji}</Text>
        <View className="flex-1 gap-0.5">
          <CardTitle>{plantName(plant)}</CardTitle>
          <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
            {plant.catalogPlant?.scientificName ?? location}
          </Text>
        </View>
      </View>
    </Card>
  )
}

export default function JardinDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const garden = useGarden(id)
  const plants = useGardenPlants(id)
  const deleteGarden = useDeleteGarden()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([garden.refetch(), plants.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [garden, plants])

  // Suppression en cascade côté serveur : on prévient de ce qui sera perdu.
  const confirmDelete = () => {
    const count = plants.data?.length ?? 0
    Alert.alert(
      'Supprimer ce jardin ?',
      count > 0
        ? `Ses ${count} plante${count > 1 ? 's' : ''} et leur historique d'entretien seront supprimés. Cette action est définitive.`
        : 'Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGarden.mutateAsync(id)
              router.back()
            } catch (error) {
              Alert.alert('Suppression impossible', errorMessage(error))
            }
          },
        },
      ],
    )
  }

  const typeLabel = garden.data
    ? (GARDEN_TYPE_LABELS[garden.data.type as GardenType] ?? garden.data.type)
    : ''

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-1">
        {/* En-tête : retour à gauche, actions secondaires à droite. */}
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour aux jardins"
          >
            <ChevronLeft size={28} color="#1E5631" />
          </Pressable>

          <View className="flex-row gap-4">
            <Pressable
              onPress={() => router.push(`/(tabs)/jardins/${id}/modifier`)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Modifier le jardin"
            >
              <Pencil size={22} color="#1E5631" />
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Supprimer le jardin"
            >
              <Trash2 size={22} color="hsl(0 84% 60%)" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-4 gap-3"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
          }
        >
          {garden.isPending ? (
            <ListSkeleton count={1} />
          ) : garden.isError ? (
            <ErrorState
              message={errorMessage(garden.error)}
              onRetry={() => void garden.refetch()}
            />
          ) : (
            <View className="gap-1 mb-2">
              <Text className="font-poppins-bold text-screen text-forest">
                {garden.data.name}
              </Text>
              <Text className="font-raleway text-secondary text-muted-foreground">
                {typeLabel}
                {garden.data.surfaceM2 ? ` · ${garden.data.surfaceM2} m²` : ''}
              </Text>
              {garden.data.description ? (
                <Text className="font-raleway text-body text-forest mt-1">
                  {garden.data.description}
                </Text>
              ) : null}
            </View>
          )}

          {plants.isPending ? (
            <ListSkeleton />
          ) : plants.isError ? (
            <ErrorState
              message={errorMessage(plants.error)}
              onRetry={() => void plants.refetch()}
            />
          ) : plants.data.length === 0 ? (
            <EmptyState
              emoji="🌿"
              title="Ce jardin est encore vide"
              message="Ajoute ta première plante pour suivre son arrosage et son entretien."
              cta={{
                label: 'Ajouter une plante',
                onPress: () => router.push(`/(tabs)/jardins/${id}/plante`),
              }}
            />
          ) : (
            plants.data.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))
          )}
        </ScrollView>

        {plants.data && plants.data.length > 0 ? (
          <View className="px-4 pb-4 pt-2">
            <Button
              label="Ajouter une plante"
              onPress={() => router.push(`/(tabs)/jardins/${id}/plante`)}
              icon={<Plus size={20} color="#1E5631" />}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}
