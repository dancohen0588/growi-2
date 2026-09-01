import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Image } from 'expo-image'
import { Camera, ChevronLeft } from 'lucide-react-native'
import {
  PLANT_LOCATIONS,
  PLANT_LOCATION_LABELS,
  SUN_EXPOSURES,
  SUN_EXPOSURE_LABELS,
  plantLocationSchema,
  sunExposureSchema,
  type PlantCatalog,
  type SunExposure,
} from '@growi/shared'

import { CONFIDENCE } from '@/components/identify/IdentifyResult'
import { IdentifyLoading } from '@/components/identify/IdentifyLoading'
import { CatalogSearch } from '@/components/plants/CatalogSearch'
import { PlantScanner, type IdentifiedPlant } from '@/components/plants/PlantScanner'
import { Button } from '@/components/ui/Button'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import type { Photo } from '@/lib/photo'
import { useCatalogEntryLookup } from '@/lib/queries/catalog'
import { useAddPlant } from '@/lib/queries/gardens'
import { useUploadPhoto } from '@/lib/queries/uploads'

const LOCATION_OPTIONS = PLANT_LOCATIONS.map((value) => ({
  value,
  label: PLANT_LOCATION_LABELS[value],
}))

const SUN_OPTIONS = SUN_EXPOSURES.map((value) => ({
  value,
  label: SUN_EXPOSURE_LABELS[value],
}))

/**
 * Quatre temps : on cherche l'espèce au catalogue ou on la fait reconnaître en
 * photo, puis on confirme son emplacement — ou l'on saisit tout à la main si
 * elle n'y figure pas.
 */
type Step = 'search' | 'scan' | 'confirm' | 'manual'

/**
 * Dépose la photo qui a servi à la reconnaissance et rend son URL.
 *
 * C'est *sa* plante sur la photo : elle vaut mieux que l'image du catalogue.
 * Un envoi qui échoue ne doit pour autant pas empêcher l'ajout — mieux vaut
 * une fiche sans photo que pas de fiche — on le dit et on continue.
 */
function usePlantPhotoUrl() {
  const uploadPhoto = useUploadPhoto()
  const toast = useToast()

  return async (photo: Photo | null): Promise<string | null> => {
    if (!photo) return null
    try {
      return (await uploadPhoto.mutateAsync({ photo, kind: 'plant' })).url
    } catch {
      toast("La photo n'a pas pu être envoyée ; la plante est ajoutée sans elle.", 'error')
      return null
    }
  }
}

/** Rappel de ce que la photo a donné, en tête des deux formulaires. */
function IdentifiedBanner({
  identified,
  photo,
  onRetake,
}: {
  identified: IdentifiedPlant
  photo: Photo | null
  onRetake: () => void
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      {photo ? (
        <View className="h-14 w-14 overflow-hidden rounded-lg bg-sand-dark">
          <Image
            source={photo.uri}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      <View className="flex-1 gap-1">
        <Text className="font-raleway text-caption text-muted-foreground">
          Reconnue sur ta photo
        </Text>
        <View className={`self-start rounded-full px-2 py-0.5 ${CONFIDENCE[identified.confidence].tone}`}>
          <Text className="font-raleway-medium text-caption text-forest">
            {CONFIDENCE[identified.confidence].label}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRetake}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Reprendre une photo"
      >
        <Text className="font-raleway-semibold text-secondary text-forest">Reprendre</Text>
      </Pressable>
    </View>
  )
}

// ─── Étape « confirmer » : la fiche catalogue préremplit tout le reste ─────

const confirmSchema = z.object({
  customName: z.string().max(50, 'Nom trop long (50 caractères max.)').optional(),
  location: plantLocationSchema,
})

type ConfirmValues = z.infer<typeof confirmSchema>

function ConfirmStep({
  plant,
  gardenId,
  identified,
  photo,
  onBack,
  onRetake,
  onDone,
}: {
  plant: PlantCatalog
  gardenId: string
  /** Présent quand l'espèce vient d'une reconnaissance photo. */
  identified: IdentifiedPlant | null
  photo: Photo | null
  onBack: () => void
  onRetake: () => void
  onDone: () => void
}) {
  const addPlant = useAddPlant(gardenId)
  const uploadPhoto = usePlantPhotoUrl()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      customName: '',
      // Une plante d'intérieur strict n'a pas à être proposée dehors.
      location: plant.indoor && !plant.outdoor ? 'INDOOR' : 'OUTDOOR',
    },
  })

  const sun = SUN_EXPOSURE_LABELS[plant.sunExposure as SunExposure] ?? plant.sunExposure

  const onSubmit = async (values: ConfirmValues) => {
    setFormError(null)
    try {
      const photoUrl = await uploadPhoto(photo)
      // Arrosage, exposition et emoji sont hérités de la fiche par le serveur.
      await addPlant.mutateAsync({
        catalogPlantId: plant.id,
        customName: values.customName || undefined,
        location: values.location,
        photoUrl,
      })
      onDone()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
      {identified ? (
        <IdentifiedBanner identified={identified} photo={photo} onRetake={onRetake} />
      ) : null}

      <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
        <Text className="text-3xl">{plant.emoji ?? '🌿'}</Text>
        <View className="flex-1">
          <Text className="font-poppins text-body text-forest">{plant.commonName}</Text>
          <Text className="font-raleway text-caption text-muted-foreground italic">
            {plant.scientificName}
          </Text>
        </View>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
          <Text className="font-raleway-semibold text-secondary text-forest">Changer</Text>
        </Pressable>
      </View>

      <View className="rounded-lg bg-sand-dark/50 p-3 gap-1">
        <Text className="font-raleway-medium text-secondary text-forest">
          Growi préremplit pour toi
        </Text>
        <Text className="font-raleway text-secondary text-muted-foreground">
          💧 Arrosage tous les {plant.wateringFreqDays} jours · ☀️ {sun}
        </Text>
        <Text className="font-raleway text-caption text-muted-foreground">
          Tu pourras ajuster ces réglages depuis la fiche de la plante.
        </Text>
      </View>

      <Controller
        control={control}
        name="location"
        render={({ field: { onChange, value } }) => (
          <OptionGroup
            label="Où vit-elle ?"
            options={LOCATION_OPTIONS}
            value={value}
            onChange={onChange}
            error={errors.location?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="customName"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Petit nom"
            placeholder={`Facultatif — sinon « ${plant.commonName} »`}
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.customName?.message}
            autoCapitalize="sentences"
            returnKeyType="done"
            editable={!isSubmitting}
          />
        )}
      />

      {formError ? (
        <View className="rounded-lg border border-destructive bg-card p-3">
          <Text className="font-raleway text-secondary text-destructive">{formError}</Text>
        </View>
      ) : null}

      <Button
        label="Ajouter au jardin"
        size="lg"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </ScrollView>
  )
}

// ─── Étape « saisie libre » ────────────────────────────────────────────────

const manualSchema = z.object({
  customName: z
    .string()
    .min(1, 'Donne un nom à ta plante')
    .max(50, 'Nom trop long (50 caractères max.)'),
  emoji: z.string().max(4).optional(),
  location: plantLocationSchema,
  sunExposure: sunExposureSchema.optional(),
  wateringFreqDays: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365),
      'Indique un nombre de jours entre 1 et 365',
    ),
})

type ManualValues = z.infer<typeof manualSchema>

function ManualStep({
  gardenId,
  initialName,
  initialEmoji,
  identified,
  photo,
  onBack,
  onRetake,
  onDone,
}: {
  gardenId: string
  initialName: string
  initialEmoji: string
  /** Espèce reconnue en photo, mais absente du catalogue Growi. */
  identified: IdentifiedPlant | null
  photo: Photo | null
  onBack: () => void
  onRetake: () => void
  onDone: () => void
}) {
  const addPlant = useAddPlant(gardenId)
  const uploadPhoto = usePlantPhotoUrl()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ManualValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      customName: initialName,
      emoji: initialEmoji,
      location: 'OUTDOOR',
      sunExposure: undefined,
      wateringFreqDays: '',
    },
  })

  const onSubmit = async (values: ManualValues) => {
    setFormError(null)
    try {
      const photoUrl = await uploadPhoto(photo)
      await addPlant.mutateAsync({
        customName: values.customName,
        emoji: values.emoji || undefined,
        location: values.location,
        sunExposure: values.sunExposure,
        wateringFreqDays: values.wateringFreqDays ? Number(values.wateringFreqDays) : undefined,
        photoUrl,
      })
      onDone()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
      {identified ? (
        <>
          <IdentifiedBanner identified={identified} photo={photo} onRetake={onRetake} />
          <View className="rounded-lg bg-sand-dark/50 p-3 gap-1">
            <Text className="font-raleway-medium text-secondary text-forest">
              {identified.commonName} n'est pas encore au catalogue Growi
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              💧 {identified.careGuide.watering}
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              ☀️ {identified.careGuide.light}
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              Reporte ce qui te paraît juste dans les réglages ci-dessous.
            </Text>
          </View>
        </>
      ) : (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          className="flex-row items-center gap-1"
        >
          <ChevronLeft size={18} color="#1E5631" />
          <Text className="font-raleway text-secondary text-forest">
            Revenir à la recherche
          </Text>
        </Pressable>
      )}

      <Controller
        control={control}
        name="customName"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Nom"
            placeholder="Basilic, rosier du fond…"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.customName?.message}
            autoCapitalize="sentences"
            returnKeyType="next"
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="emoji"
        render={({ field: { onChange, value } }) => (
          <EmojiPicker label="Symbole" value={value} onChange={onChange} />
        )}
      />

      <Controller
        control={control}
        name="location"
        render={({ field: { onChange, value } }) => (
          <OptionGroup
            label="Où vit-elle ?"
            options={LOCATION_OPTIONS}
            value={value}
            onChange={onChange}
            error={errors.location?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="sunExposure"
        render={({ field: { onChange, value } }) => (
          <OptionGroup
            label="Exposition"
            options={SUN_OPTIONS}
            value={value}
            onChange={onChange}
            error={errors.sunExposure?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="wateringFreqDays"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Arrosage tous les… (jours)"
            placeholder="Facultatif"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.wateringFreqDays?.message}
            keyboardType="number-pad"
            returnKeyType="done"
            editable={!isSubmitting}
          />
        )}
      />

      {formError ? (
        <View className="rounded-lg border border-destructive bg-card p-3">
          <Text className="font-raleway text-secondary text-destructive">{formError}</Text>
        </View>
      ) : null}

      <Button
        label="Ajouter au jardin"
        size="lg"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </ScrollView>
  )
}

// ─── Écran ─────────────────────────────────────────────────────────────────

export default function AjouterPlanteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const lookupCatalogEntry = useCatalogEntryLookup()

  const [step, setStep] = useState<Step>('search')
  const [selected, setSelected] = useState<PlantCatalog | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [identified, setIdentified] = useState<IdentifiedPlant | null>(null)
  const [matching, setMatching] = useState(false)

  /**
   * Enchaîne sur le formulaire d'ajout, préremplie par ce que la photo a donné.
   *
   * Reliée au catalogue quand l'espèce y figure — arrosage et exposition sont
   * alors ceux de la fiche — et en saisie libre sinon, où le nom, l'emoji et le
   * guide d'entretien du modèle sont tout ce dont on dispose.
   */
  const onIdentified = async (result: IdentifiedPlant, taken: Photo) => {
    setIdentified(result)
    setPhoto(taken)
    setMatching(true)
    try {
      const entry = result.encyclopediaSlug
        ? await lookupCatalogEntry(
            result.encyclopediaSlug,
            result.encyclopediaName ?? result.scientificName,
          )
        : null
      setSelected(entry)
      setStep(entry ? 'confirm' : 'manual')
    } finally {
      setMatching(false)
    }
  }

  /** Retour à la recherche : la photo et son résultat n'ont plus cours. */
  const backToSearch = () => {
    setIdentified(null)
    setPhoto(null)
    setSelected(null)
    setStep('search')
  }

  const retake = () => {
    setIdentified(null)
    setPhoto(null)
    setSelected(null)
    setStep('scan')
  }

  const title =
    step === 'search'
      ? 'Ajouter une plante'
      : step === 'scan'
        ? 'Reconnaître'
        : step === 'confirm'
          ? 'Confirmer'
          : 'Saisie libre'

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
          <Text className="font-poppins text-section text-forest">{title}</Text>
          <View className="w-16" />
        </View>

        {step === 'search' ? (
          <ScrollView
            contentContainerClassName="px-4 pb-8 gap-4"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* La photo d'abord : c'est le chemin le plus court quand on ne
                sait pas nommer sa plante — le cas le plus fréquent. */}
            <Button
              label="Reconnaître par photo"
              onPress={() => setStep('scan')}
              icon={<Camera size={20} color="#1E5631" />}
            />

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="font-raleway text-caption text-muted-foreground">
                ou cherche par son nom
              </Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <CatalogSearch
              onSelect={(plant) => {
                setSelected(plant)
                setStep('confirm')
              }}
              onManualEntry={() => setStep('manual')}
            />
          </ScrollView>
        ) : step === 'scan' ? (
          <ScrollView contentContainerClassName="px-4 pb-8" keyboardShouldPersistTaps="handled">
            {matching ? (
              <IdentifyLoading />
            ) : (
              <PlantScanner
                photo={photo}
                onPhotoChange={setPhoto}
                onIdentified={(result, taken) => void onIdentified(result, taken)}
                onGiveUp={backToSearch}
              />
            )}
          </ScrollView>
        ) : step === 'confirm' && selected ? (
          <ConfirmStep
            plant={selected}
            gardenId={id}
            identified={identified}
            photo={photo}
            onBack={backToSearch}
            onRetake={retake}
            onDone={() => router.back()}
          />
        ) : (
          <ManualStep
            gardenId={id}
            initialName={identified?.commonName ?? ''}
            initialEmoji={identified?.emoji || '🌿'}
            identified={identified}
            photo={photo}
            onBack={backToSearch}
            onRetake={retake}
            onDone={() => router.back()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
