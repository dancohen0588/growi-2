import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authErrorMessage, useSession } from '@/store/session'

export default function LoginScreen() {
  const signIn = useSession((s) => s.signIn)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // La redirection est portée par le layout : dès que la session passe à
  // « authenticated », (auth) renvoie vers les onglets.
  const onSubmit = async (values: LoginInput) => {
    setFormError(null)
    try {
      await signIn(values)
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
              Bon retour dans ton jardin.
            </Text>
          </View>

          <View className="gap-4">
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
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  revealable
                  autoComplete="current-password"
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
            label="Se connecter"
            size="lg"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />

          <View className="flex-row justify-center gap-1">
            <Text className="font-raleway text-secondary text-muted-foreground">
              Pas encore de compte ?
            </Text>
            <Link
              href="/(auth)/register"
              className="font-raleway-semibold text-secondary text-forest"
            >
              Créer mon compte
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
