import { useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Camera, ImageIcon, X } from 'lucide-react-native'
import {
  CARE_LOG_TYPES,
  CARE_LOG_TYPE_LABELS,
  HARVEST_UNITS,
  HEALTH_STATUSES,
  HEALTH_STATUS_LABELS,
  type CareLogType,
  type CreateCareLogInput,
  type HarvestUnit,
  type HealthStatus,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useUploadPhoto } from '@/lib/queries/uploads'

const TYPE_OPTIONS = CARE_LOG_TYPES.map((value) => ({
  value,
  label: CARE_LOG_TYPE_LABELS[value],
}))

const STATUS_OPTIONS = HEALTH_STATUSES.map((value) => ({
  value,
  label: HEALTH_STATUS_LABELS[value],
}))

const UNIT_OPTIONS = HARVEST_UNITS.map((value) => ({ value, label: value }))

export interface CareLogSheetProps {
  visible: boolean
  /** Geste présélectionné à l'ouverture. */
  initialType?: CareLogType
  currentHealth: HealthStatus
  submitting: boolean
  onClose: () => void
  onSubmit: (input: CreateCareLogInput) => void
}

/**
 * Saisie détaillée d'un geste.
 *
 * Les trois gestes quotidiens ont leur bouton direct sur la fiche ; tout le
 * reste passe par cette feuille — un tap de plus pour ce qu'on fait trois fois
 * par an, plutôt que huit boutons en permanence à l'écran.
 */
export function CareLogSheet({
  visible,
  initialType = 'other',
  currentHealth,
  submitting,
  onClose,
  onSubmit,
}: CareLogSheetProps) {
  const [type, setType] = useState<CareLogType>(initialType)
  const [note, setNote] = useState('')
  const [productUsed, setProductUsed] = useState('')
  const [status, setStatus] = useState<HealthStatus>(currentHealth)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<HarvestUnit>('g')
  const [photo, setPhoto] = useState<Photo | null>(null)

  const uploadPhoto = useUploadPhoto()

  const isHarvest = type === 'harvest'
  const isHealth = type === 'health'
  // Le produit n'a de sens que là où l'on en applique un.
  const showProduct = type === 'fertilizing' || type === 'treatment' || type === 'repotting'

  const quantityValue = Number(quantity.replace(',', '.'))
  const quantityInvalid = quantity.length > 0 && !(quantityValue > 0)

  /**
   * Choisit une photo pour ce geste.
   *
   * Elle n'est déposée qu'à l'enregistrement : abandonner la feuille ne doit
   * rien laisser dans le stockage.
   */
  const choosePhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (picked) setPhoto(picked)
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        Alert.alert('Autorisation nécessaire', error.message, [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ])
        return
      }
      Alert.alert('Photo indisponible', String(error))
    }
  }

  const submit = async () => {
    // Une photo qui ne part pas ne doit pas emporter le geste avec elle.
    let photoUrl: string | undefined
    if (photo) {
      try {
        photoUrl = (await uploadPhoto.mutateAsync({ photo, kind: 'care-log' })).url
      } catch {
        Alert.alert(
          'Photo non envoyée',
          "Le geste va être enregistré sans la photo. Tu pourras réessayer plus tard.",
        )
      }
    }

    onSubmit({
      type,
      note: note.trim() || undefined,
      productUsed: showProduct && productUsed.trim() ? productUsed.trim() : undefined,
      status: isHealth ? status : undefined,
      quantity: isHarvest && quantityValue > 0 ? quantityValue : undefined,
      unit: isHarvest && quantityValue > 0 ? unit : undefined,
      photoUrl,
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-sand"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
          >
            <Text className="font-raleway text-body text-muted-foreground">Annuler</Text>
          </Pressable>
          <Text className="font-poppins text-section text-forest">Noter un geste</Text>
          <View className="w-16" />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          <OptionGroup label="Quel geste ?" options={TYPE_OPTIONS} value={type} onChange={setType} />

          {isHealth ? (
            <OptionGroup
              label="Comment se porte-t-elle ?"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
          ) : null}

          {isHarvest ? (
            <>
              <Input
                label="Quantité"
                placeholder="1,2"
                value={quantity}
                onChangeText={setQuantity}
                error={quantityInvalid ? 'Indique une quantité positive' : undefined}
                keyboardType="decimal-pad"
                returnKeyType="next"
                editable={!submitting}
              />
              <OptionGroup label="Unité" options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
            </>
          ) : null}

          {showProduct ? (
            <Input
              label="Produit employé"
              placeholder="Marc de café, purin d'ortie, terreau…"
              value={productUsed}
              onChangeText={setProductUsed}
              returnKeyType="next"
              editable={!submitting}
            />
          ) : null}

          <Input
            label="Note"
            placeholder="Facultatif"
            value={note}
            onChangeText={setNote}
            multiline
            returnKeyType="done"
            editable={!submitting}
          />

          {/* Une photo vaut mieux qu'une description pour une feuille tachée
              ou une récolte : facultative, jamais imposée. */}
          <View className="gap-1.5">
            <Text className="font-raleway-medium text-secondary text-forest">Photo</Text>

            {photo ? (
              <View className="h-40 w-full overflow-hidden rounded-xl bg-sand-dark">
                <Image source={{ uri: photo.uri }} className="h-full w-full" resizeMode="cover" />
                <Pressable
                  onPress={() => setPhoto(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer la photo"
                  className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-forest/80"
                >
                  <X size={16} color="#F9F7E8" />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Photo"
                    variant="outline"
                    onPress={() => void choosePhoto('camera')}
                    icon={<Camera size={18} color="#1E5631" />}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    label="Galerie"
                    variant="outline"
                    onPress={() => void choosePhoto('library')}
                    icon={<ImageIcon size={18} color="#1E5631" />}
                  />
                </View>
              </View>
            )}
          </View>

          <Button
            label="Enregistrer"
            size="lg"
            loading={submitting || uploadPhoto.isPending}
            disabled={quantityInvalid}
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}
