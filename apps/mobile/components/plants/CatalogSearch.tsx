import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Search } from 'lucide-react-native'
import {
  PLANT_CATEGORY_LABELS,
  WATERING_DIFFICULTY_LABELS,
  type PlantCatalog,
  type PlantCategory,
  type WateringDifficulty,
} from '@growi/shared'

import { Input } from '@/components/ui/Input'
import { CATALOG_MIN_QUERY_LENGTH, useCatalogSearch } from '@/lib/queries/catalog'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { errorMessage } from '@/lib/errors'

const DIFFICULTY_DOT: Record<WateringDifficulty, string> = {
  EASY: '🟢',
  MEDIUM: '🟡',
  DEMANDING: '🔴',
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-md bg-sand px-1.5 py-0.5">
      <Text className="font-raleway-medium text-caption text-muted-foreground">{children}</Text>
    </View>
  )
}

/** Vignette de la fiche : photo si elle existe, emoji sinon. */
function Thumb({ plant }: { plant: PlantCatalog }) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(plant.imageUrl) && !failed

  return (
    <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-sand-dark">
      {showImage ? (
        <Image
          source={plant.imageUrl}
          onError={() => setFailed(true)}
          contentFit="cover"
          transition={150}
          // Le fond sand-dark de la vignette sert de placeholder pendant le chargement.
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text className="text-3xl">{plant.emoji ?? '🌿'}</Text>
      )}
    </View>
  )
}

function ResultRow({ plant, onSelect }: { plant: PlantCatalog; onSelect: () => void }) {
  const category = PLANT_CATEGORY_LABELS[plant.category as PlantCategory] ?? plant.category
  const difficulty = plant.wateringDifficulty as WateringDifficulty

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`Choisir ${plant.commonName}`}
      className="flex-row gap-3 rounded-xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <Thumb plant={plant} />

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-poppins text-body text-forest flex-shrink" numberOfLines={1}>
            {plant.commonName}
          </Text>
          {plant.toxic ? (
            <View className="rounded-full bg-destructive/10 px-1.5 py-0.5">
              <Text className="font-raleway-medium text-caption text-destructive">Toxique</Text>
            </View>
          ) : null}
        </View>

        <Text className="font-raleway text-caption text-muted-foreground italic" numberOfLines={1}>
          {plant.scientificName}
        </Text>

        <View className="mt-1 flex-row flex-wrap gap-1.5">
          <Tag>{category}</Tag>
          <Tag>💧 {plant.wateringFreqDays} j</Tag>
          <Tag>
            {DIFFICULTY_DOT[difficulty] ?? ''} {WATERING_DIFFICULTY_LABELS[difficulty] ?? ''}
          </Tag>
        </View>
      </View>
    </Pressable>
  )
}

export interface CatalogSearchProps {
  onSelect: (plant: PlantCatalog) => void
  /** Bascule vers la saisie libre, quand l'espèce n'est pas au catalogue. */
  onManualEntry: () => void
}

export function CatalogSearch({ onSelect, onManualEntry }: CatalogSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query)
  const { data, isFetching, isError, error } = useCatalogSearch(debouncedQuery)

  const tooShort = debouncedQuery.trim().length < CATALOG_MIN_QUERY_LENGTH
  const noResult = !tooShort && !isFetching && data?.length === 0

  return (
    <View className="gap-4">
      <Input
        label="Quelle plante ajoutes-tu ?"
        placeholder="Basilic, rosier, tomate…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        hint="Cherche dans le catalogue Growi pour préremplir arrosage et exposition."
      />

      {tooShort ? (
        <View className="items-center gap-2 py-6">
          <Search size={28} color="hsl(139 20% 40%)" />
          <Text className="font-raleway text-secondary text-muted-foreground text-center">
            Saisis au moins deux lettres pour lancer la recherche.
          </Text>
          <Pressable onPress={onManualEntry} hitSlop={8} accessibilityRole="button">
            <Text className="font-raleway-semibold text-secondary text-forest underline">
              Ou saisir ma plante à la main
            </Text>
          </Pressable>
        </View>
      ) : isError ? (
        <View className="rounded-lg border border-destructive bg-card p-3">
          <Text className="font-raleway text-secondary text-destructive">
            {errorMessage(error)}
          </Text>
        </View>
      ) : isFetching && !data ? (
        <View className="items-center py-6">
          <ActivityIndicator color="#1E5631" />
        </View>
      ) : noResult ? (
        <View className="items-center gap-2 py-6">
          <Text className="text-3xl">🔍</Text>
          <Text className="font-raleway text-body text-forest text-center">
            Aucune plante trouvée au catalogue.
          </Text>
          <Pressable onPress={onManualEntry} hitSlop={8} accessibilityRole="button">
            <Text className="font-raleway-semibold text-secondary text-forest underline">
              L'ajouter à la main →
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2">
          {data?.map((plant) => (
            <ResultRow key={plant.id} plant={plant} onSelect={() => onSelect(plant)} />
          ))}
          <Pressable
            onPress={onManualEntry}
            hitSlop={8}
            accessibilityRole="button"
            className="items-center py-2"
          >
            <Text className="font-raleway text-secondary text-muted-foreground">
              Ma plante n'est pas dans la liste
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
