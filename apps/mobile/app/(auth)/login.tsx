import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/**
 * Écran de connexion — mise en page et champs.
 * La validation, l'appel à l'API et le stockage des jetons arrivent à
 * l'étape 4.2.
 */
export default function LoginScreen() {
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
              placeholder="••••••••"
              secureTextEntry
              revealable
              autoComplete="current-password"
              returnKeyType="done"
            />
          </View>

          {/* Action principale en bas de la zone de contenu, à portée du pouce. */}
          <Button label="Se connecter" size="lg" />

          <View className="flex-row justify-center gap-1">
            <Text className="font-raleway text-secondary text-muted-foreground">
              Pas encore de compte ?
            </Text>
            <Link href="/(auth)/register" className="font-raleway-semibold text-secondary text-forest">
              Créer mon compte
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
