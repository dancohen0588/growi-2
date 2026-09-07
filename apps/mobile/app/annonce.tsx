import { useState } from 'react'
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
import { useRouter } from 'expo-router'
import { Camera, ImagePlus, MapPin, X } from 'lucide-react-native'
import type { ListingCategory, ListingKind } from '@growi/shared'
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABELS,
  LISTING_DESCRIPTION_MAX_LENGTH,
  LISTING_KINDS,
  LISTING_KIND_LABELS,
  LISTING_QUANTITY_MAX_LENGTH,
  LISTING_TITLE_MAX_LENGTH,
  LISTING_WANTS_MAX_LENGTH,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useCreateListing } from '@/lib/queries/community'
import { useUploadPhoto } from '@/lib/queries/uploads'

/**
 * Écran 8 — publier une annonce.
 *
 * Modale déclarée à la racine, comme « Publier » : on y arrive de la bourse,
 * de « Mes annonces » et de l'état vide de la bourse. Un navigateur d'onglets
 * ne sait pas présenter une modale.
 *
 * La photo est **facultative** ici, contrairement aux publications : « Je
 * cherche des boutures de figuier » n'a rien à montrer.
 */

const KIND_OPTIONS = LISTING_KINDS.map((value) => ({
  value,
  label: LISTING_KIND_LABELS[value],
}))

const CATEGORY_OPTIONS = LISTING_CATEGORIES.map((value) => ({
  value,
  label: LISTING_CATEGORY_LABELS[value],
}))

export default function NouvelleAnnonceScreen() {
  const router = useRouter()
  const toast = useToast()

  const upload = useUploadPhoto()
  const createListing = useCreateListing()

  const [kind, setKind] = useState<ListingKind>('give')
  const [category, setCategory] = useState<ListingCategory>('seeds')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [wants, setWants] = useState('')
  const [photo, setPhoto] = useState<Photo | null>(null)

  const addPhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (picked) setPhoto(picked)
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
      // La photo part d'abord : l'annonce ne se crée qu'une fois son URL
      // connue, ce qui évite une annonce amputée de son image.
      const uploaded = photo
        ? await upload.mutateAsync({ photo, kind: 'listing' })
        : null

      const listing = await createListing.mutateAsync({
        kind,
        category,
        title: title.trim(),
        description: description.trim() || null,
        photoUrl: uploaded?.url ?? null,
        quantity: quantity.trim() || null,
        // La contrepartie n'a de sens que sur un échange.
        wants: kind === 'swap' ? wants.trim() || null : null,
      })

      toast('Annonce publiée 🌻')
      router.replace(`/(tabs)/communaute/bourse/${listing.id}`)
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const busy = upload.isPending || createListing.isPending
  const canPublish = title.trim().length > 0 && !busy

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
          <Text className="font-poppins-bold text-screen text-forest">Nouvelle annonce</Text>
          {/* Espace symétrique, pour que le titre reste centré. */}
          <View className="w-16" />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          <OptionGroup label="Type d’annonce" options={KIND_OPTIONS} value={kind} onChange={setKind} />

          <OptionGroup
            label="Catégorie"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
          />

          <Input
            label="Titre"
            placeholder="Graines de tomate cœur de bœuf"
            value={title}
            onChangeText={setTitle}
            maxLength={LISTING_TITLE_MAX_LENGTH}
            returnKeyType="next"
            hint={`${title.length}/${LISTING_TITLE_MAX_LENGTH}`}
          />

          <Input
            label="Quantité (facultatif)"
            placeholder="~30 graines"
            value={quantity}
            onChangeText={setQuantity}
            maxLength={LISTING_QUANTITY_MAX_LENGTH}
            returnKeyType="next"
          />

          {kind === 'swap' ? (
            <Input
              label="En échange de (facultatif)"
              placeholder="Des boutures de romarin, ou ce qui te fait plaisir"
              value={wants}
              onChangeText={setWants}
              maxLength={LISTING_WANTS_MAX_LENGTH}
              returnKeyType="next"
            />
          ) : null}

          <View className="gap-1.5">
            <Text className="font-raleway-medium text-secondary text-forest">
              Description (facultatif)
            </Text>
            <View className="min-h-[96px] rounded-lg border border-input bg-card px-4 py-3">
              <TextInput
                className="font-raleway text-body text-forest"
                placeholder="Récoltées cet été, variété ancienne, très productives…"
                placeholderTextColor="hsl(139 20% 40%)"
                value={description}
                onChangeText={setDescription}
                maxLength={LISTING_DESCRIPTION_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Description de l’annonce"
              />
            </View>
          </View>

          <View className="gap-3">
            <Text className="font-raleway-medium text-secondary text-forest">
              Photo (facultatif)
            </Text>

            {photo ? (
              <View className="h-40 overflow-hidden rounded-xl bg-sand-dark">
                <Image
                  source={photo.uri}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
                <Pressable
                  onPress={() => setPhoto(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer la photo"
                  className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-forest/80"
                >
                  <X size={18} color="#F9F7E8" />
                </Pressable>
              </View>
            ) : (
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
            )}
          </View>

          <View className="flex-row items-start gap-2 rounded-xl bg-card p-4">
            <MapPin size={18} color="hsl(139 20% 40%)" />
            <Text className="flex-1 font-raleway text-caption text-muted-foreground">
              Visible par les jardiniers autour de toi, à ~1 km près. L’annonce expire dans 60
              jours — tu pourras la prolonger. Growi ne gère aucun paiement.
            </Text>
          </View>

          <Button
            label="Publier l’annonce"
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
