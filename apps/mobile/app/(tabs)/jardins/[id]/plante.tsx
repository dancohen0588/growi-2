import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  PLANT_LOCATIONS,
  PLANT_LOCATION_LABELS,
  SUN_EXPOSURES,
  SUN_EXPOSURE_LABELS,
  plantLocationSchema,
  sunExposureSchema,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { errorMessage } from '@/lib/errors'
import { useAddPlant } from '@/lib/queries/gardens'

/**
 * Saisie libre plutôt que recherche dans le catalogue : l'API v1 n'expose pas
 * encore d'endpoint de recherche d'espèces. La plante sera reliée au catalogue
 * plus tard, notamment via l'identification photo (phase 6).
 */
const formSchema = z.object({
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

type FormValues = z.infer<typeof formSchema>

const LOCATION_OPTIONS = PLANT_LOCATIONS.map((value) => ({
  value,
  label: PLANT_LOCATION_LABELS[value],
}))

const SUN_OPTIONS = SUN_EXPOSURES.map((value) => ({
  value,
  label: SUN_EXPOSURE_LABELS[value],
}))

export default function AjouterPlanteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const addPlant = useAddPlant(id)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customName: '',
      emoji: '',
      location: 'OUTDOOR',
      sunExposure: undefined,
      wateringFreqDays: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await addPlant.mutateAsync({
        customName: values.customName,
        emoji: values.emoji || undefined,
        location: values.location,
        sunExposure: values.sunExposure,
        wateringFreqDays: values.wateringFreqDays
          ? Number(values.wateringFreqDays)
          : undefined,
      })
      router.back()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

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
          <Text className="font-poppins text-section text-forest">Nouvelle plante</Text>
          <View className="w-16" />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
        >
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
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Emoji"
                placeholder="🌿"
                hint="Pour la reconnaître d'un coup d'œil dans la liste."
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.emoji?.message}
                returnKeyType="next"
                editable={!isSubmitting}
              />
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
            label="Ajouter la plante"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
