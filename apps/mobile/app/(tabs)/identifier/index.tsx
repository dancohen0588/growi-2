import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import {
  ArrowRight,
  Camera,
  Check,
  ImageIcon,
  Leaf,
  Plus,
  RefreshCw,
  ScanSearch,
  Sparkles,
} from 'lucide-react-native'
import type { IdentifyApiResponse } from '@growi/shared'

import { IdentifyResult } from '@/components/identify/IdentifyResult'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useAddIdentifiedPlant, useIdentifyPlant } from '@/lib/queries/identify'
import { useUploadPhoto } from '@/lib/queries/uploads'

/** Les mêmes étapes que sur le web : photo, analyse, résultat. */
const LOADING_MESSAGES = [
  'Analyse de la photo en cours…',
  "Identification de l'espèce…",
  "Consultation de l'encyclopédie…",
  'Rédaction de la fiche…',
]

/** Fait défiler les messages pour que l'attente reste habitée. */
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

export default function IdentifierScreen() {
  const router = useRouter()
  const toast = useToast()

  const [photo, setPhoto] = useState<Photo | null>(null)
  const [result, setResult] = useState<IdentifyApiResponse | null>(null)
  const [addedPlantId, setAddedPlantId] = useState<string | null>(null)

  const identify = useIdentifyPlant()
  const addPlant = useAddIdentifiedPlant()
  const uploadPhoto = useUploadPhoto()

  const reset = () => {
    setPhoto(null)
    setResult(null)
    setAddedPlantId(null)
    identify.reset()
  }

  /**
   * Une permission refusée n'est pas une panne : on explique, et on propose
   * d'ouvrir les réglages plutôt que d'afficher une erreur technique.
   */
  const choosePhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (!picked) return

      setPhoto(picked)
      setResult(null)
      setAddedPlantId(null)
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

  const analyse = () => {
    if (!photo) return

    identify.mutate(photo.dataUrl, {
      onSuccess: setResult,
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  /**
   * Ajoute la plante, avec la photo qui vient de servir à l'identifier.
   *
   * C'est *sa* plante sur la photo : elle vaut mieux que l'image générique du
   * catalogue. Si le dépôt échoue, on ajoute quand même la plante — mieux
   * vaut une fiche sans photo que pas de fiche — en le disant.
   */
  const addToMyPlants = async () => {
    if (!result?.identified) return

    let photoUrl: string | null = null
    if (photo) {
      try {
        photoUrl = (await uploadPhoto.mutateAsync({ photo, kind: 'plant' })).url
      } catch {
        toast("La photo n'a pas pu être envoyée ; la plante est ajoutée sans elle.", 'error')
      }
    }

    addPlant.mutate(
      {
        commonName: result.commonName,
        scientificName: result.scientificName,
        emoji: result.emoji,
        encyclopediaSlug: result.encyclopediaSlug,
        photoUrl,
      },
      {
        onSuccess: (plant) => {
          setAddedPlantId(plant.id)
          toast('Plante ajoutée à ton jardin 🌱')
        },
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerClassName="px-4 pb-8 pt-2 gap-5">
        <View className="gap-0.5">
          <Text className="font-poppins-bold text-screen text-forest">Identifier</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            Prends ou choisis une photo — l'IA fait le reste en quelques secondes.
          </Text>
        </View>

        {identify.isPending ? (
          <LoadingStep />
        ) : result ? (
          /* ── Résultat ─────────────────────────────────────────────── */
          result.identified ? (
            <>
              <IdentifyResult result={result} photoUri={photo?.uri ?? ''} />

              {addedPlantId ? (
                <Button
                  label="Voir sa fiche"
                  onPress={() =>
                    router.push(`/(tabs)/identifier/plantes/${addedPlantId}`)
                  }
                  icon={<Check size={20} color="#1E5631" />}
                />
              ) : (
                <Button
                  label="Ajouter à mes plantes"
                  size="lg"
                  loading={addPlant.isPending || uploadPhoto.isPending}
                  onPress={() => void addToMyPlants()}
                  icon={<Plus size={20} color="#1E5631" />}
                />
              )}

              <Button
                label="Identifier une autre plante"
                variant="outline"
                onPress={reset}
                icon={<RefreshCw size={18} color="#1E5631" />}
              />
            </>
          ) : (
            /* ── Espèce non reconnue ────────────────────────────────── */
            <View className="items-center gap-3 rounded-2xl bg-card p-6">
              <ScanSearch size={32} color="hsl(139 20% 40%)" />
              <Text className="font-poppins text-section text-forest text-center">
                Cette plante n'a pas pu être identifiée
              </Text>
              <Text className="font-raleway text-secondary text-muted-foreground text-center">
                {result.reason}
              </Text>
              <View className="mt-1 w-full">
                <Button
                  label="Réessayer avec une autre photo"
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
              onPress={analyse}
              icon={<Sparkles size={20} color="#1E5631" />}
            />
            <Button label="Changer de photo" variant="outline" onPress={reset} />
          </>
        ) : (
          /* ── Point de départ ────────────────────────────────────────── */
          <View className="items-center gap-4 rounded-2xl bg-card p-6">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-lime/30">
              <Leaf size={28} color="#1E5631" />
            </View>
            <Text className="font-poppins text-section text-forest text-center">
              Quelle est cette plante ?
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground text-center">
              Cadre la feuille ou la fleur de près, en pleine lumière : le résultat n'en sera
              que meilleur.
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
            </View>
          </View>
        )}

        {/* L'encyclopédie complète vit sur le web ; on ne la promet pas ici. */}
        {result?.identified && result.encyclopediaSlug ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-card p-3">
            <ArrowRight size={16} color="hsl(139 20% 40%)" />
            <Text className="flex-1 font-raleway text-caption text-muted-foreground">
              Cette espèce figure au catalogue Growi : la plante ajoutée hérite de ses besoins
              en eau et en lumière.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}
