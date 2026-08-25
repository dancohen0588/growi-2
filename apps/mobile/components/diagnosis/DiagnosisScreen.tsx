import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import {
  Camera,
  Check,
  ChevronLeft,
  ImageIcon,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react-native'
import {
  HEALTH_STATUS_LABELS,
  type DiagnoseApiResponse,
  type DiagnosisSuccess,
} from '@growi/shared'

import { DiagnosisResult } from '@/components/diagnosis/DiagnosisResult'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useApplyDiagnosis, useDiagnosePlant } from '@/lib/queries/diagnosis'
import { usePlant } from '@/lib/queries/plants'

/** Les mêmes étapes que sur le web : photo, analyse, résultat. */
const LOADING_MESSAGES = [
  'Lecture de la photo…',
  'Croisement avec la fiche de ta plante…',
  'Prise en compte de la météo locale…',
  'Rédaction du diagnostic…',
]

function LoadingStep() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % LOADING_MESSAGES.length), 2200)
    return () => clearInterval(timer)
  }, [])

  return (
    <View className="items-center gap-3 py-16">
      <ActivityIndicator size="large" color="#1E5631" />
      <Text className="font-raleway text-body text-muted-foreground text-center">
        {LOADING_MESSAGES[index]}
      </Text>
    </View>
  )
}

/**
 * Diagnostic d'une plante, en trois temps : choix de la photo, analyse,
 * résultat.
 *
 * L'écran est poussé depuis la fiche plutôt qu'ouvert en modale : le résultat
 * se lit longuement, et le geste de retour doit ramener à la fiche.
 */
export function DiagnosisScreen({ plantId }: { plantId: string }) {
  const router = useRouter()
  const toast = useToast()

  const plant = usePlant(plantId)
  const diagnose = useDiagnosePlant(plantId)
  const applyStatus = useApplyDiagnosis(plantId)

  const [photo, setPhoto] = useState<Photo | null>(null)
  const [response, setResponse] = useState<DiagnoseApiResponse | null>(null)
  const [applied, setApplied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const reset = () => {
    setPhoto(null)
    setResponse(null)
    setApplied(false)
    setDismissed(false)
    diagnose.reset()
  }

  /**
   * Une permission refusée n'est pas une panne : on explique et on propose
   * d'ouvrir les réglages, plutôt que d'afficher une erreur technique.
   */
  const choosePhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (!picked) return

      setPhoto(picked)
      setResponse(null)
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

  const analyse = (body: { imageBase64: string } | { useExistingPhoto: true }) => {
    diagnose.mutate(body, {
      onSuccess: setResponse,
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  const apply = () => {
    if (!response?.diagnosed || !response.diagnosisId) return

    applyStatus.mutate(response.diagnosisId, {
      onSuccess: () => {
        setApplied(true)
        toast('État de la plante mis à jour 🌿')
      },
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  if (plant.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
        <View className="px-4 pt-4">
          <ListSkeleton count={3} />
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

  const existingPhoto = plant.data.photoUrl
  const result = response?.diagnosed ? (response as DiagnosisSuccess) : null
  const failureReason = response && !response.diagnosed ? response.reason : null
  // On ne propose la mise à jour que si elle change vraiment l'état enregistré.
  const suggestsChange = result != null && result.status !== response?.currentHealthStatus

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={28} color="#1E5631" />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-section text-forest" numberOfLines={1}>
          Diagnostic
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-8 gap-5" showsVerticalScrollIndicator={false}>
        {diagnose.isPending ? (
          <LoadingStep />
        ) : response ? (
          result ? (
            <>
              <DiagnosisResult result={result} photoUri={photo?.uri ?? response.photoUrl} />

              {applied ? (
                <View className="flex-row items-center gap-2 rounded-xl bg-lime/30 p-4">
                  <Check size={18} color="#1E5631" />
                  <Text className="flex-1 font-raleway text-secondary text-forest">
                    L&apos;état de ta plante est maintenant «&nbsp;
                    {HEALTH_STATUS_LABELS[result.status]}&nbsp;».
                  </Text>
                </View>
              ) : suggestsChange && !dismissed ? (
                <View className="gap-3 rounded-2xl bg-card p-4">
                  <Text className="font-raleway text-secondary text-forest">
                    Mettre à jour l&apos;état de ta plante en «&nbsp;
                    {HEALTH_STATUS_LABELS[result.status]}&nbsp;»&nbsp;? Le geste sera noté dans
                    son journal.
                  </Text>
                  <Button
                    label="Mettre à jour"
                    size="lg"
                    loading={applyStatus.isPending}
                    onPress={apply}
                    icon={<Check size={20} color="#1E5631" />}
                  />
                  <Button
                    label="Ignorer"
                    variant="outline"
                    disabled={applyStatus.isPending}
                    onPress={() => setDismissed(true)}
                    icon={<X size={18} color="#1E5631" />}
                  />
                </View>
              ) : null}

              <Button
                label="Refaire un diagnostic"
                variant="outline"
                onPress={reset}
                icon={<RefreshCw size={18} color="#1E5631" />}
              />
            </>
          ) : (
            /* ── Analyse impossible ─────────────────────────────────────── */
            <View className="items-center gap-3 rounded-2xl bg-card p-6">
              <ScanSearch size={32} color="hsl(139 20% 40%)" />
              <Text className="font-poppins text-section text-forest text-center">
                Diagnostic impossible
              </Text>
              <Text className="font-raleway text-secondary text-muted-foreground text-center">
                {failureReason}
              </Text>
              <View className="mt-1 w-full">
                <Button
                  label="Réessayer"
                  onPress={reset}
                  icon={<RefreshCw size={18} color="#1E5631" />}
                />
              </View>
            </View>
          )
        ) : photo ? (
          /* ── Photo prête, en attente d'analyse ──────────────────────── */
          <>
            <View className="h-64 w-full overflow-hidden rounded-2xl bg-sand-dark">
              <Image
                source={photo.uri}
                contentFit="cover"
                transition={150}
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            </View>

            <Button
              label="Analyser cette photo"
              size="lg"
              onPress={() => analyse({ imageBase64: photo.dataUrl })}
              icon={<Sparkles size={20} color="#1E5631" />}
            />
            <Button label="Changer de photo" variant="outline" onPress={reset} />
          </>
        ) : (
          /* ── Point de départ ────────────────────────────────────────── */
          <View className="items-center gap-4 rounded-2xl bg-card p-6">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-lime/30">
              <Stethoscope size={28} color="#1E5631" />
            </View>
            <Text className="font-poppins text-section text-forest text-center">
              Comment va ta plante&nbsp;?
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground text-center">
              Une photo nette, en pleine lumière, feuilles bien visibles. L&apos;analyse tient
              compte de sa fiche, de son jardin et de la météo de chez toi.
            </Text>

            <View className="mt-1 w-full gap-2">
              <Button
                label="Prendre une photo"
                size="lg"
                onPress={() => void choosePhoto('camera')}
                icon={<Camera size={20} color="#1E5631" />}
              />
              <Button
                label="Choisir dans la galerie"
                variant="outline"
                onPress={() => void choosePhoto('library')}
                icon={<ImageIcon size={20} color="#1E5631" />}
              />
              {existingPhoto ? (
                <Button
                  label="Utiliser la photo de la fiche"
                  variant="ghost"
                  onPress={() => analyse({ useExistingPhoto: true })}
                  icon={<ScanSearch size={18} color="#1E5631" />}
                />
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
