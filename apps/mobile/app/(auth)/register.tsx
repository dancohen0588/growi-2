import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mobileRegisterSchema, type MobileRegisterInput } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authErrorMessage, useSession } from '@/store/session'

type RegisterFormValues = Omit<MobileRegisterInput, 'deviceInfo'>

export default function RegisterScreen() {
  const signUp = useSession((s) => s.signUp)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    // L'appareil est renseigné par le store : ce n'est pas une saisie utilisateur.
    resolver: zodResolver(mobileRegisterSchema.omit({ deviceInfo: true })),
    defaultValues: { firstName: '', email: '', password: '' },
  })

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null)
    try {
      await signUp(values)
    } catch (error) {
      setFormError(authErrorMessage(error))
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-sand">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-4 py-8 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="font-poppins-bold text-2xl text-forest">Growi 🌱</Text>
            <Text className="font-poppins-bold text-screen text-forest">
              Ton jardin commence ici.
            </Text>
          </View>

          <View className="gap-4">
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Prénom"
                  placeholder="Julie"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.firstName?.message}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  returnKeyType="next"
                  editable={!isSubmitting}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="julie@exemple.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!isSubmitting}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Mot de passe"
                  placeholder="8 caractères minimum"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  hint="Au moins 8 caractères."
                  secureTextEntry
                  revealable
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  editable={!isSubmitting}
                />
              )}
            />
          </View>

          {formError ? (
            <View className="rounded-lg border border-destructive bg-card p-3">
              <Text className="font-raleway text-secondary text-destructive">{formError}</Text>
            </View>
          ) : null}

          <Button
            label="Créer mon compte"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="flex-row justify-center gap-1">
            <Text className="font-raleway text-secondary text-muted-foreground">
              Déjà inscrit ?
            </Text>
            <Link
              href="/(auth)/login"
              className="font-raleway-semibold text-secondary text-forest"
            >
              Se connecter
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
