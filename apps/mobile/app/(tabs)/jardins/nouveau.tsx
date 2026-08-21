import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GARDEN_TYPES, GARDEN_TYPE_LABELS, createGardenSchema } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { errorMessage } from '@/lib/errors'
import { useCreateGarden } from '@/lib/queries/gardens'

/**
 * La surface est saisie au clavier, donc sous forme de texte : le schéma du
 * formulaire la convertit avant de rejoindre le contrat de l'API.
 */
const formSchema = createGardenSchema.omit({ surfaceM2: true }).extend({
  surfaceM2: z
    .string()
    .optional()
    .refine((v) => !v || Number(v.replace(',', '.')) > 0, 'Indique une surface positive'),
})

type FormValues = z.infer<typeof formSchema>

const TYPE_OPTIONS = GARDEN_TYPES.map((value) => ({
  value,
  label: GARDEN_TYPE_LABELS[value],
}))

export default function NouveauJardinScreen() {
  const router = useRouter()
  const createGarden = useCreateGarden()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', type: 'OUTDOOR', description: '', surfaceM2: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await createGarden.mutateAsync({
        name: values.name,
        type: values.type,
        description: values.description || undefined,
        surfaceM2: values.surfaceM2 ? Number(values.surfaceM2.replace(',', '.')) : undefined,
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
          <Text className="font-poppins text-section text-forest">Nouveau jardin</Text>
          {/* Contrepoids invisible, pour que le titre reste centré. */}
          <View className="w-16" />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 gap-5"
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nom"
                placeholder="Mon potager"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                autoCapitalize="sentences"
                returnKeyType="next"
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={control}
            name="type"
            render={({ field: { onChange, value } }) => (
              <OptionGroup
                label="Type"
                options={TYPE_OPTIONS}
                value={value}
                onChange={onChange}
                error={errors.type?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="surfaceM2"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Surface (m²)"
                placeholder="Facultatif"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.surfaceM2?.message}
                keyboardType="decimal-pad"
                returnKeyType="next"
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Description"
                placeholder="Facultatif"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.description?.message}
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
            label="Créer le jardin"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
