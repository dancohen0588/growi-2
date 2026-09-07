import { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Camera, ImagePlus, MapPin, X } from 'lucide-react-native'
import { POST_BODY_MAX_LENGTH, POST_MAX_PHOTOS } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, preparePhotoFromUrl, takePhoto, type Photo } from '@/lib/photo'
import { useCreatePost } from '@/lib/queries/community'
import { usePlant } from '@/lib/queries/plants'
import { useUploadPhoto } from '@/lib/queries/uploads'

/**
 * Écran 7 — publier.
 *
 * Modale déclarée au niveau `(tabs)`, et non dans la pile Accueil : on y
 * navigue par chemin absolu depuis n'importe où, notamment depuis la fiche
 * plante, qui vit dans quatre piles différentes.
 *
 * Ouverte avec `?plantInstanceId=`, elle propose la photo de la plante et son
 * nom. La photo est **copiée** — pas référencée : supprimer la plante ou
 * changer sa photo ne doit pas vider une publication que d'autres ont
 * commentée.
 */

/** Une vignette de la bande de photos, avec sa croix de retrait. */
function PhotoThumb({ photo, onRemove }: { photo: Photo; onRemove: () => void }) {
  return (
    <View className="h-24 w-24 overflow-hidden rounded-lg bg-sand-dark">
      <Image
        source={photo.uri}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Retirer cette photo"
        className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-forest/80"
      >
        <X size={16} color="#F9F7E8" />
      </Pressable>
    </View>
  )
}

export default function PublierScreen() {
  const router = useRouter()
  const toast = useToast()
  const { plantInstanceId } = useLocalSearchParams<{ plantInstanceId?: string }>()

  const plant = usePlant(plantInstanceId ?? '')
  const upload = useUploadPhoto()
  const createPost = useCreatePost()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [body, setBody] = useState('')
  const [prefilling, setPrefilling] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // Ouverte depuis une fiche plante : on part de sa photo. Une seule fois —
  // l'utilisateur doit pouvoir la retirer sans qu'elle revienne.
  useEffect(() => {
    const photoUrl = plant.data?.photoUrl
    if (!photoUrl || prefilled) return

    setPrefilled(true)
    setPrefilling(true)
    preparePhotoFromUrl(photoUrl)
      .then((copy) => setPhotos([copy]))
      // Une photo de plante illisible n'empêche pas de publier : on en choisit
      // simplement une autre.
      .catch(() => undefined)
      .finally(() => setPrefilling(false))
  }, [plant.data?.photoUrl, prefilled])

  const addPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= POST_MAX_PHOTOS) return

    try {
      const photo = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (photo) setPhotos((current) => [...current, photo])
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        // Une permission refusée est un choix, pas une panne.
        Alert.alert('Accès refusé', error.message, [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ])
        return
      }
      toast(errorMessage(error), 'error')
    }
  }

  const publish = async () => {
    try {
      // Les photos partent d'abord : la publication ne se crée qu'une fois les
      // URLs connues, ce qui évite une publication amputée d'une image.
      const uploaded = await Promise.all(
        photos.map((photo) => upload.mutateAsync({ photo, kind: 'post' })),
      )

      await createPost.mutateAsync({
        body: body.trim(),
        photos: uploaded.map((result) => result.url),
        plantInstanceId: plantInstanceId ?? null,
      })

      toast('Publié 🌱')
      router.back()
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const busy = prefilling || upload.isPending || createPost.isPending
  const canPublish = photos.length > 0 && !busy

  return (
    <SafeAreaView className="flex-1 bg-sand">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
          >
            <Text className="font-raleway text-body text-muted-foreground">Annuler</Text>
          </Pressable>
          <Text className="font-poppins-bold text-screen text-forest">Publier</Text>
          {/* Espace symétrique, pour que le titre reste centré. */}
          <View className="w-16" />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              {photos.map((photo, index) => (
                <PhotoThumb
                  key={`${photo.uri}-${index}`}
                  photo={photo}
                  onRemove={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                />
              ))}
            </View>

            {photos.length < POST_MAX_PHOTOS ? (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Appareil photo"
                    variant="outline"
                    disabled={busy}
                    onPress={() => void addPhoto('camera')}
                    icon={<Camera size={20} color="#1E5631" />}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Galerie"
                    variant="outline"
                    disabled={busy}
                    onPress={() => void addPhoto('library')}
                    icon={<ImagePlus size={20} color="#1E5631" />}
                  />
                </View>
              </View>
            ) : null}

            <Text className="font-raleway text-caption text-muted-foreground">
              {photos.length}/{POST_MAX_PHOTOS} photo{photos.length > 1 ? 's' : ''} · au moins une
              est nécessaire.
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="font-raleway-medium text-secondary text-forest">
              Ce que tu veux en dire
            </Text>
            <View className="min-h-[112px] rounded-lg border border-input bg-card px-4 py-3">
              <TextInput
                className="font-raleway text-body text-forest"
                placeholder="Mon monstera a doublé de taille cet été…"
                placeholderTextColor="hsl(139 20% 40%)"
                value={body}
                onChangeText={setBody}
                maxLength={POST_BODY_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Texte de la publication"
              />
            </View>
            <Text className="font-raleway text-caption text-muted-foreground">
              {body.length}/{POST_BODY_MAX_LENGTH}
            </Text>
          </View>

          {plant.data ? (
            <View className="rounded-xl bg-card p-4">
              <Text className="font-raleway text-secondary text-forest">
                Publiée avec{' '}
                <Text className="font-raleway-medium">
                  {plant.data.customName ?? plant.data.catalogPlant?.commonName ?? 'ta plante'}
                </Text>
                .
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-start gap-2 rounded-xl bg-card p-4">
            <MapPin size={18} color="hsl(139 20% 40%)" />
            <Text className="flex-1 font-raleway text-caption text-muted-foreground">
              Visible par les jardiniers autour de toi, à ~1 km près. Ton adresse exacte n’est
              jamais partagée.
            </Text>
          </View>

          <Button
            label="Publier"
            size="lg"
            loading={busy}
            disabled={!canPublish}
            onPress={() => void publish()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
