import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import {
  Camera,
  ChevronLeft,
  Droplets,
  MessageCircle,
  Pencil,
  Plus,
  Scissors,
  Sprout,
  Stethoscope,
} from 'lucide-react-native'
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

import { actionChatQuery } from '@/components/chat/links'
import { DiagnosisHistoryList } from '@/components/diagnosis/DiagnosisHistoryList'
import { CareHistory } from '@/components/plants/CareHistory'
import { CareLogSheet } from '@/components/plants/CareLogSheet'
import { TaskRow } from '@/components/planning/TaskRow'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto } from '@/lib/photo'
import { useDiagnoses } from '@/lib/queries/diagnosis'
import { useMarkActionDone, usePlantActions } from '@/lib/queries/planning'
import { useAddCareLog, usePlant, usePlantLogs, useUpdatePlant } from '@/lib/queries/plants'
import { useUploadPhoto } from '@/lib/queries/uploads'

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
  /** Ouvre le diagnostic dans la pile courante, même raison. */
  onDiagnose: () => void
  /**
   * Ouvre le fil de discussion. Reçoit la chaîne de requête à coller au
   * chemin — l'ancrage change d'un point d'entrée à l'autre.
   */
  onChat: (query: string) => void
}

/**
 * Fiche d'une plante.
 *
 * Partagée par les onglets Calendrier, Mes plantes et Mon jardin : chacun a sa pile de
 * navigation, pour que le retour ramène là d'où l'on vient, mais l'écran doit
 * rester le même.
 */
export function PlantDetail({ plantId, onEdit, onDiagnose, onChat }: PlantDetailProps) {
  const router = useRouter()
  const toast = useToast()

  const plant = usePlant(plantId)
  const logs = usePlantLogs(plantId)
  const actions = usePlantActions(plantId)
  const diagnoses = useDiagnoses(plantId)
  const addLog = useAddCareLog(plantId)
  const markDone = useMarkActionDone()
  const updatePlant = useUpdatePlant(plantId)
  const uploadPhoto = useUploadPhoto()

  const [refreshing, setRefreshing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([plant.refetch(), logs.refetch(), actions.refetch(), diagnoses.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [plant, logs, actions, diagnoses])

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
      { actionId: action.id, gardenId, actionType: action.type, plantId, taskId: action.taskId },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  /**
   * Remplace la photo de la plante.
   *
   * Deux temps : le fichier part au stockage, puis son URL est écrite sur la
   * plante. Le second échoue rarement, mais s'il échoue la photo déposée
   * reste orpheline — sans conséquence, elle n'est référencée nulle part.
   */
  const changePhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (!picked) return

      const { url } = await uploadPhoto.mutateAsync({ photo: picked, kind: 'plant' })
      await updatePlant.mutateAsync({ photoUrl: url })
      toast('Photo mise à jour 📸')
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        Alert.alert('Autorisation nécessaire', error.message, [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ])
        return
      }
      toast(errorMessage(error), 'error')
    }
  }

  const removePhoto = async () => {
    try {
      // `null` efface ; le fichier est supprimé du stockage par le serveur.
      await updatePlant.mutateAsync({ photoUrl: null })
      toast('Photo retirée')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const openPhotoMenu = (hasOwnPhoto: boolean) => {
    Alert.alert('Photo de la plante', 'Comment veux-tu procéder ?', [
      { text: 'Prendre une photo', onPress: () => void changePhoto('camera') },
      { text: 'Choisir dans la galerie', onPress: () => void changePhoto('library') },
      ...(hasOwnPhoto
        ? [
            {
              text: 'Retirer la photo',
              style: 'destructive' as const,
              onPress: () => void removePhoto(),
            },
          ]
        : []),
      { text: 'Annuler', style: 'cancel' as const },
    ])
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
  const busyWithPhoto = uploadPhoto.isPending || updatePlant.isPending
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
        {/* En-tête : la photo de l'utilisateur si elle existe, celle du
            catalogue à défaut, l'emoji en dernier recours. Toujours tactile —
            c'est le seul endroit d'où l'on change la photo. */}
        <View className="items-center gap-3">
          <Pressable
            onPress={() => openPhotoMenu(data.photoUrl != null)}
            disabled={busyWithPhoto}
            accessibilityRole="button"
            accessibilityLabel={data.photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
            className="h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-sand-dark"
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          >
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

            {busyWithPhoto ? (
              <View className="absolute inset-0 items-center justify-center bg-forest/40">
                <ActivityIndicator color="#F9F7E8" />
              </View>
            ) : (
              <View className="absolute bottom-1 right-1 h-8 w-8 items-center justify-center rounded-full border-2 border-sand bg-lime">
                <Camera size={16} color="#1E5631" />
              </View>
            )}
          </Pressable>

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

        {/* Diagnostic et discussion ouvrent chacun un écran, là où les gestes
            rapides s'exécutent sur-le-champ. Le diagnostic part d'une photo,
            la discussion d'une question : deux entrées, pas une. */}
        <View className="gap-2">
          <Button
            label="Diagnostiquer ma plante"
            size="lg"
            onPress={onDiagnose}
            icon={<Stethoscope size={20} color="#1E5631" />}
          />
          <Button
            label="Poser une question"
            variant="outline"
            onPress={() => onChat('?kind=plant')}
            icon={<MessageCircle size={20} color="#1E5631" />}
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
                onAsk={() => onChat(actionChatQuery(action))}
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

        {/* Diagnostics passés — rien ne s'affiche tant qu'il n'y en a pas. */}
        {diagnoses.data ? (
          <DiagnosisHistoryList plantId={plantId} items={diagnoses.data} onChat={onChat} />
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
