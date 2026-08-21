import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import {
  HEALTH_STATUS_LABELS,
  PLANT_LOCATION_LABELS,
  type HealthStatus,
  type PlantInstanceWithRelations,
  type PlantLocation,
} from '@growi/shared'

/**
 * Carte d'une plante, reprise de la grille du web (`PlantCard`) : photo en
 * 4/3, état de santé en pastille, nom et nom scientifique, emplacement, puis
 * la jauge d'arrosage. Mêmes informations, même ordre.
 */

/** Emojis d'emplacement, identiques à ceux du web. */
const LOCATION_ICON: Record<PlantLocation, string> = {
  INDOOR: '🏠',
  OUTDOOR: '🌳',
  BALCONY: '🌇',
  GREENHOUSE: '🏡',
}

const HEALTH_STYLE: Record<HealthStatus, { icon: string; tone: string }> = {
  HEALTHY: { icon: '✅', tone: 'text-forest' },
  WARNING: { icon: '⚠️', tone: 'text-forest' },
  CRITICAL: { icon: '🚨', tone: 'text-destructive' },
}

/** Part du cycle d'arrosage écoulée, de 0 à 100. Sans arrosage connu : 100. */
export function wateringProgress(plant: PlantInstanceWithRelations, now = Date.now()): number {
  const freq = plant.wateringFreqDays ?? plant.catalogPlant?.wateringFreqDays
  if (!freq) return 0
  if (!plant.lastWateredAt) return 100

  const elapsed = (now - new Date(plant.lastWateredAt).getTime()) / 86_400_000
  return Math.min(100, Math.round((elapsed / freq) * 100))
}

/** Jours restants avant le prochain arrosage ; négatif s'il est en retard. */
function daysUntilWatering(plant: PlantInstanceWithRelations, now = Date.now()): number | null {
  const freq = plant.wateringFreqDays ?? plant.catalogPlant?.wateringFreqDays
  if (!freq || !plant.lastWateredAt) return null

  const next = new Date(plant.lastWateredAt).getTime() + freq * 86_400_000
  return Math.ceil((next - now) / 86_400_000)
}

function barTone(progress: number): string {
  if (progress < 50) return 'bg-lime'
  if (progress < 80) return 'bg-sun'
  return 'bg-destructive'
}

function displayName(plant: PlantInstanceWithRelations): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

export function PlantGridCard({
  plant,
  onPress,
}: {
  plant: PlantInstanceWithRelations
  onPress: () => void
}) {
  const health = (plant.healthStatus as HealthStatus) ?? 'HEALTHY'
  const location = plant.location as PlantLocation
  const catalogPhoto = plant.catalogPlant?.imageUrl ?? null
  const photo = plant.photoUrl ?? catalogPhoto
  const fromCatalog = !plant.photoUrl && catalogPhoto != null

  const progress = wateringProgress(plant)
  const days = daysUntilWatering(plant)
  const late = days != null && days < 0
  const dueToday = days === 0

  const wateringLabel =
    days == null
      ? 'Arrosage à renseigner'
      : late
        ? `En retard de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''} !`
        : dueToday
          ? "À arroser aujourd'hui !"
          : `Prochain arrosage dans ${days} jour${days > 1 ? 's' : ''}`

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Voir la fiche de ${displayName(plant)}`}
      className="flex-1 gap-2 rounded-2xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      {/* Le 4/3 est posé en style : React Native le gère nativement, sans
          dépendre du support des valeurs arbitraires par NativeWind. */}
      <View
        className="w-full items-center justify-center overflow-hidden rounded-xl bg-sand-dark"
        style={{ aspectRatio: 4 / 3 }}
      >
        {photo ? (
          <Image
            source={photo}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text className="text-4xl">{plant.emoji ?? plant.catalogPlant?.emoji ?? '🌿'}</Text>
        )}

        {fromCatalog ? (
          <View className="absolute left-2 top-2 rounded-md bg-forest/70 px-1.5 py-0.5">
            <Text className="font-raleway-semibold text-caption text-sand">📚 Catalogue</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-start gap-1">
        <View className="flex-1">
          <Text className="font-poppins text-secondary text-forest" numberOfLines={1}>
            {displayName(plant)}
          </Text>
          {plant.catalogPlant?.scientificName ? (
            <Text
              className="font-raleway text-caption text-muted-foreground italic"
              numberOfLines={1}
            >
              {plant.catalogPlant.scientificName}
            </Text>
          ) : null}
        </View>

        <Text
          className={`font-raleway-semibold text-caption ${HEALTH_STYLE[health].tone}`}
          accessibilityLabel={HEALTH_STATUS_LABELS[health]}
        >
          {HEALTH_STYLE[health].icon}
        </Text>
      </View>

      <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
        {LOCATION_ICON[location] ?? '🌿'} {plant.zone?.name ?? PLANT_LOCATION_LABELS[location]}
      </Text>

      <View className="gap-1">
        <View
          className="h-1.5 w-full overflow-hidden rounded-full bg-sand-dark"
          accessibilityRole="progressbar"
          accessibilityValue={{ now: progress, min: 0, max: 100 }}
        >
          <View className={`h-full rounded-full ${barTone(progress)}`} style={{ width: `${progress}%` }} />
        </View>
        <Text
          className={[
            'font-raleway text-caption',
            late || dueToday ? 'text-destructive' : 'text-muted-foreground',
          ].join(' ')}
          numberOfLines={1}
        >
          {wateringLabel}
        </Text>
      </View>
    </Pressable>
  )
}
