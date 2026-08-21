import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ChevronRight, Search } from 'lucide-react-native'
import {
  HEALTH_STATUS_LABELS,
  type HealthStatus,
  type PlantInstanceWithRelations,
} from '@growi/shared'

import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useAllPlants } from '@/lib/queries/plants'

function displayName(plant: PlantInstanceWithRelations): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  HEALTHY: 'bg-lime',
  WARNING: 'bg-sun',
  CRITICAL: 'bg-destructive',
}

function PlantRow({
  plant,
  onPress,
}: {
  plant: PlantInstanceWithRelations
  onPress: () => void
}) {
  const photo = plant.photoUrl ?? plant.catalogPlant?.imageUrl
  const health = (plant.healthStatus as HealthStatus) ?? 'HEALTHY'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Fiche de ${displayName(plant)}`}
      className="flex-row items-center gap-3 rounded-xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-sand-dark">
        {photo ? (
          <Image
            source={photo}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text className="text-2xl">{plant.emoji ?? plant.catalogPlant?.emoji ?? '🌿'}</Text>
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="font-poppins text-body text-forest" numberOfLines={1}>
          {displayName(plant)}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className={`h-2 w-2 rounded-full ${HEALTH_TONE[health]}`} />
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
            {HEALTH_STATUS_LABELS[health]}
            {plant.lastWateredAt ? ` · arrosée ${formatLogDate(plant.lastWateredAt)}` : ''}
          </Text>
        </View>
      </View>

      <ChevronRight size={18} color="hsl(139 20% 40%)" />
    </Pressable>
  )
}

/**
 * Toutes les plantes, à plat.
 *
 * L'onglet Mon jardin range par jardin ; celui-ci répond à l'autre question,
 * « où en est mon basilic ? », quand on ne sait plus où il vit.
 */
export default function MesPlantesScreen() {
  const router = useRouter()
  const plants = useAllPlants()
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await plants.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [plants])

  // Recherche locale : la liste tient en mémoire, inutile d'interroger le
  // serveur à chaque lettre.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || !plants.data) return plants.data ?? []

    return plants.data.filter((plant) =>
      [plant.customName, plant.catalogPlant?.commonName, plant.catalogPlant?.scientificName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    )
  }, [plants.data, query])

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="px-4 pb-8 pt-2 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="gap-0.5">
          <Text className="font-poppins-bold text-screen text-forest">Mes plantes</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            {plants.data
              ? `${plants.data.length} plante${plants.data.length > 1 ? 's' : ''} dans tes jardins`
              : 'Toutes tes plantes, tous jardins confondus.'}
          </Text>
        </View>

        {plants.isPending ? (
          <ListSkeleton count={5} />
        ) : plants.isError ? (
          <ErrorState message={errorMessage(plants.error)} onRetry={() => void plants.refetch()} />
        ) : plants.data.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Aucune plante pour l'instant"
            message="Ajoute ta première plante depuis un jardin, et elle apparaîtra ici."
            cta={{ label: 'Voir mes jardins', onPress: () => router.push('/(tabs)/jardins') }}
          />
        ) : (
          <>
            {/* La recherche n'a d'intérêt qu'à partir d'une certaine liste. */}
            {plants.data.length > 6 ? (
              <Input
                placeholder="Chercher une plante…"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            ) : null}

            {filtered.length === 0 ? (
              <View className="items-center gap-2 py-8">
                <Search size={28} color="hsl(139 20% 40%)" />
                <Text className="font-raleway text-body text-muted-foreground text-center">
                  Aucune plante ne porte ce nom.
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {filtered.map((plant) => (
                  <PlantRow
                    key={plant.id}
                    plant={plant}
                    onPress={() => router.push(`/(tabs)/plantes/${plant.id}`)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
