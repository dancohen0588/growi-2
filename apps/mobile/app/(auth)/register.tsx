import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/**
 * Écran d'inscription — mise en page et champs.
 * Branché sur `POST /api/v1/auth/register` à l'étape 4.2.
 */
export default function RegisterScreen() {
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
            <Input
              label="Prénom"
              placeholder="Julie"
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
            />
            <Input
              label="Email"
              placeholder="julie@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
            <Input
              label="Mot de passe"
              placeholder="8 caractères minimum"
              secureTextEntry
              revealable
              autoComplete="new-password"
              returnKeyType="done"
              hint="Au moins 8 caractères."
            />
          </View>

          <Button label="Créer mon compte" size="lg" />

          <View className="flex-row justify-center gap-1">
            <Text className="font-raleway text-secondary text-muted-foreground">
              Déjà inscrit ?
            </Text>
            <Link href="/(auth)/login" className="font-raleway-semibold text-secondary text-forest">
              Se connecter
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
