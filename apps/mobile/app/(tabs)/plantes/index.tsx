import { useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import type {
  HealthStatus,
  PlantInstanceWithRelations,
  PlantLocation,
} from '@growi/shared'

import { PlantGridCard, wateringProgress } from '@/components/plants/PlantGridCard'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useAllPlants } from '@/lib/queries/plants'

/** Filtres du web, mêmes libellés et mêmes emojis. */
const LOCATION_FILTERS: { value: 'all' | PlantLocation; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'INDOOR', label: '🏠 Intérieur' },
  { value: 'OUTDOOR', label: '🌳 Extérieur' },
  { value: 'BALCONY', label: '🌇 Balcon' },
  { value: 'GREENHOUSE', label: '🏡 Serre' },
]

const HEALTH_FILTERS: { value: 'all' | HealthStatus; label: string }[] = [
  { value: 'all', label: 'Tous états' },
  { value: 'HEALTHY', label: '✅ Bonne santé' },
  { value: 'WARNING', label: '⚠️ À surveiller' },
  { value: 'CRITICAL', label: '🚨 En danger' },
]

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={[
              'rounded-full px-3 py-1.5',
              active ? 'bg-forest' : 'border border-border bg-card',
            ].join(' ')}
          >
            <Text
              className={[
                'font-raleway-medium text-caption',
                active ? 'text-sand' : 'text-forest',
              ].join(' ')}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/**
 * Mes plantes — la grille du web, portée au téléphone.
 *
 * Deux colonnes plutôt que trois, mêmes cartes et mêmes filtres : on doit
 * reconnaître l'écran en passant de l'un à l'autre.
 */
export default function MesPlantesScreen() {
  const router = useRouter()
  const plants = useAllPlants()

  const [location, setLocation] = useState<'all' | PlantLocation>('all')
  const [health, setHealth] = useState<'all' | HealthStatus>('all')
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await plants.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [plants])

  const all: PlantInstanceWithRelations[] = plants.data ?? []

  const filtered = useMemo(
    () =>
      all.filter(
        (plant) =>
          (location === 'all' || plant.location === location) &&
          (health === 'all' || (plant.healthStatus ?? 'HEALTHY') === health),
      ),
    [all, location, health],
  )

  // Comme sur le web : une plante dont le cycle est écoulé demande de l'eau.
  const overdue = useMemo(() => all.filter((p) => wateringProgress(p) >= 100).length, [all])

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="pb-8 pt-2 gap-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="gap-0.5 px-4">
          <Text className="font-poppins-bold text-screen text-forest">Mes plantes 🌿</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            {all.length > 0
              ? `${all.length} plante${all.length > 1 ? 's' : ''} dans tes jardins`
              : 'Toutes tes plantes, tous jardins confondus.'}
          </Text>
        </View>

        {plants.isPending ? (
          <View className="px-4">
            <ListSkeleton count={4} />
          </View>
        ) : plants.isError ? (
          <ErrorState message={errorMessage(plants.error)} onRetry={() => void plants.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Aucune plante pour l'instant"
            message="Ajoute ta première plante depuis un jardin, et elle apparaîtra ici."
            cta={{ label: 'Voir mes jardins', onPress: () => router.push('/(tabs)/jardins') }}
          />
        ) : (
          <>
            {overdue > 0 ? (
              <View className="mx-4 flex-row items-center gap-3 rounded-xl border border-destructive bg-card px-4 py-3">
                <Text className="text-xl">💧</Text>
                <Text className="flex-1 font-raleway text-secondary text-destructive">
                  <Text className="font-raleway-semibold">
                    {overdue} plante{overdue > 1 ? 's' : ''}
                  </Text>{' '}
                  {overdue > 1 ? 'doivent' : 'doit'} être arrosée{overdue > 1 ? 's' : ''}{' '}
                  maintenant !
                </Text>
              </View>
            ) : null}

            <View className="gap-2">
              <FilterRow
                label="Filtrer par emplacement"
                options={LOCATION_FILTERS}
                value={location}
                onChange={setLocation}
              />
              <FilterRow
                label="Filtrer par santé"
                options={HEALTH_FILTERS}
                value={health}
                onChange={setHealth}
              />
            </View>

            {filtered.length === 0 ? (
              <Text className="px-4 py-10 text-center font-raleway text-secondary text-muted-foreground">
                Aucune plante dans cette catégorie.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-3 px-4">
                {filtered.map((plant) => (
                  <View key={plant.id} className="w-[47%] flex-grow">
                    <PlantGridCard
                      plant={plant}
                      onPress={() => router.push(`/(tabs)/plantes/${plant.id}`)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
