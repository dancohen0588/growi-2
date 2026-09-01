import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Camera, ImageIcon, Leaf, RefreshCw, ScanSearch, Sparkles } from 'lucide-react-native'
import type { IdentifySuccess } from '@growi/shared'

import { IdentifyLoading } from '@/components/identify/IdentifyLoading'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useIdentifyPlant } from '@/lib/queries/identify'

/** Une identification aboutie, telle que la renvoie `POST /api/v1/identify`. */
export type IdentifiedPlant = IdentifySuccess & {
  encyclopediaSlug: string | null
  encyclopediaName: string | null
}

export interface PlantScannerProps {
  photo: Photo | null
  onPhotoChange: (photo: Photo | null) => void
  /** Espèce reconnue : à l'appelant de décider de la suite du parcours. */
  onIdentified: (result: IdentifiedPlant, photo: Photo) => void
  /** Repli quand la photo ne donne rien : la recherche au catalogue. */
  onGiveUp: () => void
}

/**
 * Reconnaissance d'une plante par photo, pour le parcours d'ajout.
 *
 * L'écran Identifier fait la même chose puis ajoute la plante au jardin le
 * plus récent ; ici le jardin est déjà connu, et le résultat sert seulement à
 * préremplir le formulaire d'ajout. D'où ce composant, qui s'arrête au
 * résultat et laisse l'appelant enchaîner.
 */
export function PlantScanner({
  photo,
  onPhotoChange,
  onIdentified,
  onGiveUp,
}: PlantScannerProps) {
  const toast = useToast()
  const identify = useIdentifyPlant()

  /**
   * Une permission refusée n'est pas une panne : on explique, et on propose
   * d'ouvrir les réglages plutôt que d'afficher une erreur technique.
   */
  const choosePhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (!picked) return

      identify.reset()
      onPhotoChange(picked)
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

  const retake = () => {
    identify.reset()
    onPhotoChange(null)
  }

  const analyse = () => {
    if (!photo) return

    identify.mutate(photo.dataUrl, {
      // Une espèce non reconnue est un résultat, pas une panne : elle est
      // rendue ci-dessous, seule la requête en échec passe par le toast.
      onSuccess: (result) => {
        if (result.identified) onIdentified(result, photo)
      },
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  if (identify.isPending) return <IdentifyLoading />

  // L'échec d'analyse est le seul résultat que ce composant affiche : un
  // succès a déjà fait basculer l'appelant vers l'étape suivante.
  if (identify.data && !identify.data.identified) {
    return (
      <View className="items-center gap-3 rounded-2xl bg-card p-6">
        <ScanSearch size={32} color="hsl(139 20% 40%)" />
        <Text className="font-poppins text-section text-forest text-center">
          Cette plante n'a pas pu être identifiée
        </Text>
        <Text className="font-raleway text-secondary text-muted-foreground text-center">
          {identify.data.reason}
        </Text>
        <View className="mt-1 w-full gap-2">
          <Button
            label="Reprendre une photo"
            onPress={retake}
            icon={<RefreshCw size={18} color="#1E5631" />}
          />
          <Button label="Chercher au catalogue" variant="outline" onPress={onGiveUp} />
        </View>
      </View>
    )
  }

  if (photo) {
    return (
      <View className="gap-3">
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
          label="Reconnaître cette plante"
          size="lg"
          onPress={analyse}
          icon={<Sparkles size={20} color="#1E5631" />}
        />
        <Button label="Reprendre une photo" variant="outline" onPress={retake} />
      </View>
    )
  }

  return (
    <View className="items-center gap-4 rounded-2xl bg-card p-6">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-lime/30">
        <Leaf size={28} color="#1E5631" />
      </View>
      <Text className="font-poppins text-section text-forest text-center">
        Quelle est cette plante ?
      </Text>
      <Text className="font-raleway text-secondary text-muted-foreground text-center">
        Cadre la feuille ou la fleur de près, en pleine lumière : le résultat n'en sera que
        meilleur.
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

      <Pressable onPress={onGiveUp} hitSlop={8} accessibilityRole="button">
        <Text className="font-raleway-semibold text-secondary text-forest underline">
          Ou chercher au catalogue
        </Text>
      </Pressable>
    </View>
  )
}
