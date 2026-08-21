import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft } from 'lucide-react-native'
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

import { CatalogSearch } from '@/components/plants/CatalogSearch'
import { Button } from '@/components/ui/Button'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { errorMessage } from '@/lib/errors'
import { useAddPlant } from '@/lib/queries/gardens'

const LOCATION_OPTIONS = PLANT_LOCATIONS.map((value) => ({
  value,
  label: PLANT_LOCATION_LABELS[value],
}))

const SUN_OPTIONS = SUN_EXPOSURES.map((value) => ({
  value,
  label: SUN_EXPOSURE_LABELS[value],
}))

/**
 * Trois temps : on cherche l'espèce au catalogue, on confirme son emplacement,
 * ou l'on saisit tout à la main si elle n'y figure pas.
 */
type Step = 'search' | 'confirm' | 'manual'

// ─── Étape « confirmer » : la fiche catalogue préremplit tout le reste ─────

const confirmSchema = z.object({
  customName: z.string().max(50, 'Nom trop long (50 caractères max.)').optional(),
  location: plantLocationSchema,
})

type ConfirmValues = z.infer<typeof confirmSchema>

function ConfirmStep({
  plant,
  gardenId,
  onBack,
  onDone,
}: {
  plant: PlantCatalog
  gardenId: string
  onBack: () => void
  onDone: () => void
}) {
  const addPlant = useAddPlant(gardenId)
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
      // Arrosage, exposition et emoji sont hérités de la fiche par le serveur.
      await addPlant.mutateAsync({
        catalogPlantId: plant.id,
        customName: values.customName || undefined,
        location: values.location,
      })
      onDone()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
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
  onBack,
  onDone,
}: {
  gardenId: string
  initialName: string
  onBack: () => void
  onDone: () => void
}) {
  const addPlant = useAddPlant(gardenId)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ManualValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      customName: initialName,
      emoji: '🌿',
      location: 'OUTDOOR',
      sunExposure: undefined,
      wateringFreqDays: '',
    },
  })

  const onSubmit = async (values: ManualValues) => {
    setFormError(null)
    try {
      await addPlant.mutateAsync({
        customName: values.customName,
        emoji: values.emoji || undefined,
        location: values.location,
        sunExposure: values.sunExposure,
        wateringFreqDays: values.wateringFreqDays ? Number(values.wateringFreqDays) : undefined,
      })
      onDone()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
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

  const [step, setStep] = useState<Step>('search')
  const [selected, setSelected] = useState<PlantCatalog | null>(null)

  const title =
    step === 'search' ? 'Ajouter une plante' : step === 'confirm' ? 'Confirmer' : 'Saisie libre'

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
            contentContainerClassName="px-4 pb-8"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <CatalogSearch
              onSelect={(plant) => {
                setSelected(plant)
                setStep('confirm')
              }}
              onManualEntry={() => setStep('manual')}
            />
          </ScrollView>
        ) : step === 'confirm' && selected ? (
          <ConfirmStep
            plant={selected}
            gardenId={id}
            onBack={() => setStep('search')}
            onDone={() => router.back()}
          />
        ) : (
          <ManualStep
            gardenId={id}
            initialName=""
            onBack={() => setStep('search')}
            onDone={() => router.back()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
