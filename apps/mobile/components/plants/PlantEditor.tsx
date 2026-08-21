import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react-native'
import {
  PLANT_LOCATIONS,
  PLANT_LOCATION_LABELS,
  SUN_EXPOSURES,
  SUN_EXPOSURE_LABELS,
  plantLocationSchema,
  sunExposureSchema,
  type PlantInstanceWithRelations,
  type PlantLocation,
  type SunExposure,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useDeletePlant, usePlant, useUpdatePlant } from '@/lib/queries/plants'

const LOCATION_OPTIONS = PLANT_LOCATIONS.map((value) => ({
  value,
  label: PLANT_LOCATION_LABELS[value],
}))

const SUN_OPTIONS = SUN_EXPOSURES.map((value) => ({
  value,
  label: SUN_EXPOSURE_LABELS[value],
}))

const formSchema = z.object({
  customName: z.string().max(50, 'Nom trop long (50 caractères max.)').optional(),
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
  notes: z.string().max(1000, 'Note trop longue (1000 caractères max.)').optional(),
})

type FormValues = z.infer<typeof formSchema>

function displayName(plant: PlantInstanceWithRelations): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

/** Monté une fois la plante chargée, pour que les valeurs par défaut soient justes. */
function PlantForm({ plant }: { plant: PlantInstanceWithRelations }) {
  const router = useRouter()
  const updatePlant = useUpdatePlant(plant.id)
  const deletePlant = useDeletePlant()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customName: plant.customName ?? '',
      emoji: plant.emoji ?? plant.catalogPlant?.emoji ?? '🌿',
      location: (plant.location as PlantLocation) ?? 'OUTDOOR',
      sunExposure: (plant.sunExposure as SunExposure | null) ?? undefined,
      wateringFreqDays: plant.wateringFreqDays ? String(plant.wateringFreqDays) : '',
      notes: plant.notes ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await updatePlant.mutateAsync({
        // `null` efface ; `undefined` laisserait la valeur inchangée.
        customName: values.customName || null,
        emoji: values.emoji || undefined,
        location: values.location,
        sunExposure: values.sunExposure,
        wateringFreqDays: values.wateringFreqDays ? Number(values.wateringFreqDays) : undefined,
        notes: values.notes || null,
      })
      router.back()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  const confirmDelete = () => {
    const name = displayName(plant)
    Alert.alert(
      `Supprimer ${name} ?`,
      "Sa fiche et tout son historique d'entretien seront définitivement supprimés.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlant.mutateAsync(plant.id)
              router.back()
            } catch (error) {
              Alert.alert('Suppression impossible', errorMessage(error))
            }
          },
        },
      ],
    )
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-5" keyboardShouldPersistTaps="handled">
      {plant.catalogPlant ? (
        <View className="rounded-lg bg-sand-dark/50 p-3 gap-0.5">
          <Text className="font-raleway-medium text-secondary text-forest">
            {plant.catalogPlant.commonName}
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground italic">
            {plant.catalogPlant.scientificName}
          </Text>
        </View>
      ) : null}

      <Controller
        control={control}
        name="customName"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Petit nom"
            placeholder={plant.catalogPlant?.commonName ?? 'Ma plante'}
            value={value ?? ''}
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
            returnKeyType="next"
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Notes"
            placeholder="Bouturée en mai, sensible au gel…"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.notes?.message}
            multiline
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
        label="Enregistrer"
        size="lg"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />

      {/* Action destructive isolée en bas, loin du bouton d'enregistrement. */}
      <View className="mt-2 border-t border-border pt-5">
        <Button
          label="Supprimer cette plante"
          variant="destructive"
          loading={deletePlant.isPending}
          onPress={confirmDelete}
          icon={<Trash2 size={20} color="#F9F7E8" />}
        />
      </View>
    </ScrollView>
  )
}

/**
 * Édition d'une plante, partagée par les piles de chaque onglet —
 * `router.back()` referme la modale quelle que soit la pile.
 */
export function PlantEditor({ plantId }: { plantId: string }) {
  const router = useRouter()
  const plant = usePlant(plantId)

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
            accessibilityLabel="Fermer"
          >
            <Text className="font-raleway text-body text-muted-foreground">Fermer</Text>
          </Pressable>
          <Text className="font-poppins text-section text-forest" numberOfLines={1}>
            {plant.data ? displayName(plant.data) : 'Ma plante'}
          </Text>
          <View className="w-16" />
        </View>

        {plant.isPending ? (
          <View className="px-4">
            <ListSkeleton count={3} />
          </View>
        ) : plant.isError ? (
          <ErrorState message={errorMessage(plant.error)} onRetry={() => void plant.refetch()} />
        ) : (
          <PlantForm plant={plant.data} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
