import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ChevronLeft, Droplets, Pencil, Plus, Scissors, Sprout } from 'lucide-react-native'
import {
  HEALTH_STATUS_LABELS,
  PLANT_LOCATION_LABELS,
  SUN_EXPOSURE_LABELS,
  type CreateCareLogInput,
  type GardenAction,
  type HealthStatus,
  type PlantInstanceWithRelations,
  type PlantLocation,
  type SunExposure,
} from '@growi/shared'

import { CareHistory } from '@/components/plants/CareHistory'
import { CareLogSheet } from '@/components/plants/CareLogSheet'
import { TaskRow } from '@/components/planning/TaskRow'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, usePlantActions } from '@/lib/queries/planning'
import { useAddCareLog, usePlant, usePlantLogs } from '@/lib/queries/plants'

function displayName(plant: PlantInstanceWithRelations): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  HEALTHY: 'bg-lime',
  WARNING: 'bg-sun',
  CRITICAL: 'bg-destructive',
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="font-raleway text-secondary text-muted-foreground">{label}</Text>
      <Text className="font-raleway-medium text-secondary text-forest">{value}</Text>
    </View>
  )
}

/** Bouton d'action rapide : icône au-dessus du libellé, colonne égale. */
function QuickAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={[
        'flex-1 items-center justify-center gap-1 rounded-xl bg-card py-3',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
      style={({ pressed }) => (pressed && !disabled ? { transform: [{ scale: 0.97 }] } : null)}
    >
      {icon}
      <Text className="font-raleway-medium text-caption text-forest text-center">{label}</Text>
    </Pressable>
  )
}

export interface PlantDetailProps {
  plantId: string
  /** Ouvre l'édition dans la pile courante — chaque onglet a la sienne. */
  onEdit: () => void
}

/**
 * Fiche d'une plante.
 *
 * Partagée par les onglets Calendrier, Mes plantes et Mon jardin : chacun a sa pile de
 * navigation, pour que le retour ramène là d'où l'on vient, mais l'écran doit
 * rester le même.
 */
export function PlantDetail({ plantId, onEdit }: PlantDetailProps) {
  const router = useRouter()
  const toast = useToast()

  const plant = usePlant(plantId)
  const logs = usePlantLogs(plantId)
  const actions = usePlantActions(plantId)
  const addLog = useAddCareLog(plantId)
  const markDone = useMarkActionDone()

  const [refreshing, setRefreshing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([plant.refetch(), logs.refetch(), actions.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [plant, logs, actions])

  // Geste rapide : la fiche se met à jour aussitôt, le toast confirme,
  // et l'échec éventuel remet l'affichage dans son état précédent.
  const logCare = (input: CreateCareLogInput, confirmation: string) => {
    addLog.mutate(input, {
      onSuccess: () => toast(confirmation),
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  const completeTask = (gardenId: string, action: GardenAction) => {
    markDone.mutate(
      { actionId: action.id, gardenId, actionType: action.type, plantId },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  if (plant.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
        <View className="px-4 pt-4">
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    )
  }

  if (plant.isError) {
    return (
      <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
        <ErrorState message={errorMessage(plant.error)} onRetry={() => void plant.refetch()} />
      </SafeAreaView>
    )
  }

  const data = plant.data
  const health = (data.healthStatus as HealthStatus) ?? 'HEALTHY'
  const imageUrl = data.photoUrl ?? data.catalogPlant?.imageUrl
  const emoji = data.emoji ?? data.catalogPlant?.emoji ?? '🌿'
  const wateringFreq = data.wateringFreqDays ?? data.catalogPlant?.wateringFreqDays
  const sun = (data.sunExposure ?? data.catalogPlant?.sunExposure) as SunExposure | undefined
  // Sans jardin, aucune tâche à valider : le planning raisonne par jardin.
  const gardenId = data.gardenId ?? null
  const todo = gardenId ? (actions.data ?? []) : []

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={28} color="#1E5631" />
        </Pressable>
        <Pressable
          onPress={onEdit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Modifier la plante"
        >
          <Pencil size={22} color="#1E5631" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        {/* En-tête : photo si elle existe, emoji en repli */}
        <View className="items-center gap-3">
          <View className="h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-sand-dark">
            {imageUrl ? (
              <Image
                source={imageUrl}
                contentFit="cover"
                transition={150}
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text className="text-6xl">{emoji}</Text>
            )}
          </View>

          <View className="items-center gap-1">
            <Text className="font-poppins-bold text-screen text-forest text-center">
              {displayName(data)}
            </Text>
            {data.catalogPlant ? (
              <Text className="font-raleway text-secondary text-muted-foreground italic">
                {data.catalogPlant.scientificName}
              </Text>
            ) : null}

            <View className={`mt-1 rounded-full px-3 py-1 ${HEALTH_TONE[health]}`}>
              <Text
                className={[
                  'font-raleway-medium text-caption',
                  health === 'CRITICAL' ? 'text-sand' : 'text-forest',
                ].join(' ')}
              >
                {HEALTH_STATUS_LABELS[health]}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions rapides, à portée du pouce et juste sous l'identité */}
        <View className="flex-row gap-2">
          <QuickAction
            icon={<Droplets size={22} color="#1E5631" />}
            label="J'ai arrosé"
            disabled={addLog.isPending}
            onPress={() => logCare({ type: 'watering' }, 'Arrosage enregistré 💧')}
          />
          <QuickAction
            icon={<Scissors size={22} color="#1E5631" />}
            label="J'ai taillé"
            disabled={addLog.isPending}
            onPress={() => logCare({ type: 'pruning' }, 'Taille enregistrée ✂️')}
          />
          <QuickAction
            icon={<Sprout size={22} color="#1E5631" />}
            label="J'ai fertilisé"
            disabled={addLog.isPending}
            onPress={() => logCare({ type: 'fertilizing' }, 'Fertilisation enregistrée 🌱')}
          />
          {/* Récolte, traitement, rempotage, semis, note de santé : un tap de
              plus pour ce qui se fait quelques fois par an. */}
          <QuickAction
            icon={<Plus size={22} color="#1E5631" />}
            label="Autre geste"
            disabled={addLog.isPending}
            onPress={() => setSheetOpen(true)}
          />
        </View>

        {/* Ce que le moteur conseille aujourd'hui pour cette plante, validable
            sans repasser par le calendrier. */}
        {todo.length > 0 && gardenId ? (
          <View className="gap-2">
            <Text className="font-poppins text-section text-forest">Actions à faire</Text>
            {todo.map((action) => (
              <TaskRow
                key={action.id}
                action={action}
                showPlantName={false}
                onDone={() => completeTask(gardenId, action)}
              />
            ))}
          </View>
        ) : null}

        {/* Entretien */}
        <View className="rounded-xl bg-card px-4 py-2">
          <InfoRow
            label="Dernier arrosage"
            value={data.lastWateredAt ? formatLogDate(data.lastWateredAt) : 'Jamais'}
          />
          {wateringFreq ? (
            <InfoRow label="Fréquence" value={`Tous les ${wateringFreq} jours`} />
          ) : null}
          {sun ? <InfoRow label="Exposition" value={SUN_EXPOSURE_LABELS[sun] ?? sun} /> : null}
          <InfoRow
            label="Emplacement"
            value={PLANT_LOCATION_LABELS[data.location as PlantLocation] ?? data.location}
          />
          {data.zone ? <InfoRow label="Zone" value={data.zone.name} /> : null}
          {data.lastPrunedAt ? (
            <InfoRow label="Dernière taille" value={formatLogDate(data.lastPrunedAt)} />
          ) : null}
          {data.lastFertilizedAt ? (
            <InfoRow
              label="Dernière fertilisation"
              value={formatLogDate(data.lastFertilizedAt)}
            />
          ) : null}
        </View>

        {data.notes ? (
          <View className="rounded-xl bg-card p-4 gap-1">
            <Text className="font-raleway-medium text-secondary text-forest">Mes notes</Text>
            <Text className="font-raleway text-body text-muted-foreground">{data.notes}</Text>
          </View>
        ) : null}

        {/* Historique */}
        <View className="gap-2">
          <Text className="font-poppins text-section text-forest">Historique</Text>

          {logs.isPending ? (
            <ListSkeleton count={2} />
          ) : logs.isError ? (
            <ErrorState message={errorMessage(logs.error)} onRetry={() => void logs.refetch()} />
          ) : (
            <CareHistory logs={logs.data} />
          )}
        </View>
      </ScrollView>

      <CareLogSheet
        visible={sheetOpen}
        currentHealth={health}
        submitting={addLog.isPending}
        onClose={() => setSheetOpen(false)}
        onSubmit={(input) => {
          setSheetOpen(false)
          logCare(input, 'Geste enregistré 🌿')
        }}
      />
    </SafeAreaView>
  )
}
