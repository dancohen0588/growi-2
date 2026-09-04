import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as WebBrowser from 'expo-web-browser'
import { ChevronRight, ExternalLink, LocateFixed, LogOut, Map, Sparkles } from 'lucide-react-native'
import type { UpdateAlertConfigInput, UserProfile } from '@growi/shared'

import { PushSection } from '@/components/profil/PushSection'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { WEB_BASE_URL } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useProfile, useUpdateAlerts, useUpdateProfile } from '@/lib/queries/me'
import { useSession } from '@/store/session'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="font-poppins text-section text-forest">{children}</Text>
}

/** Ouvre une page du site dans le navigateur intégré, sans quitter l'app. */
async function openWeb(path: string) {
  await WebBrowser.openBrowserAsync(`${WEB_BASE_URL}${path}`, {
    toolbarColor: '#F9F7E8',
    controlsColor: '#1E5631',
  })
}

/** Monté une fois le profil chargé, pour que les champs partent des bonnes valeurs. */
function ProfilContent({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const toast = useToast()
  const updateProfile = useUpdateProfile()
  const updateAlerts = useUpdateAlerts()
  const signOut = useSession((s) => s.signOut)

  const [city, setCity] = useState(profile.city ?? '')
  const [locating, setLocating] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const alerts = profile.alertConfig
  const hasCoordinates = profile.latitude != null && profile.longitude != null

  // `both` couvre le jour où l'email s'ajoutera : le push y est compris.
  const pushEnabled = alerts.channel === 'push' || alerts.channel === 'both'

  const saveCity = async () => {
    const trimmed = city.trim()
    if (trimmed === (profile.city ?? '')) return

    try {
      // `null` efface la ville ; une chaîne vide serait stockée telle quelle.
      await updateProfile.mutateAsync({ city: trimmed || null })
      toast('Ville enregistrée 📍')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  /**
   * Récupère la position et en déduit la ville.
   *
   * Ce sont les coordonnées qui comptent : sans elles, la météo reste muette
   * et le moteur travaille sur un temps neutre. La ville n'est que l'étiquette
   * qu'on affiche à côté.
   */
  const useMyLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Localisation refusée',
          'Tu peux l\'autoriser dans les réglages de ton téléphone, ou saisir ta ville à la main.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
          ],
        )
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const [place] = await Location.reverseGeocodeAsync(position.coords)
      const found = place?.city ?? place?.subregion ?? place?.region ?? null

      await updateProfile.mutateAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: found,
      })

      setCity(found ?? '')
      toast(found ? `Position enregistrée — ${found} 📍` : 'Position enregistrée 📍')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setLocating(false)
    }
  }

  const saveAlerts = (patch: UpdateAlertConfigInput) => {
    updateAlerts.mutate(patch, { onError: (error) => toast(errorMessage(error), 'error') })
  }

  const confirmSignOut = () => {
    Alert.alert('Se déconnecter', 'Tu devras saisir de nouveau ton mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await signOut()
          } finally {
            setSigningOut(false)
          }
        },
      },
    ])
  }

  return (
    <ScrollView contentContainerClassName="px-4 pb-8 gap-6" keyboardShouldPersistTaps="handled">
      {/* Identité */}
      <View className="rounded-xl bg-card p-4 gap-0.5">
        <Text className="font-poppins text-section text-forest">
          {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Jardinier'}
        </Text>
        <Text className="font-raleway text-secondary text-muted-foreground">{profile.email}</Text>
      </View>

      {/* Localisation */}
      <View className="gap-3">
        <SectionTitle>Ma localisation</SectionTitle>
        <Text className="font-raleway text-secondary text-muted-foreground">
          Elle sert à la météo de ton jardin et aux alertes gel ou canicule.
        </Text>

        <Input
          label="Ville"
          placeholder="Nantes"
          value={city}
          onChangeText={setCity}
          onBlur={() => void saveCity()}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void saveCity()}
          editable={!updateProfile.isPending}
          hint={
            hasCoordinates
              ? 'Position enregistrée : la météo est active.'
              : 'Sans position, la météo et ses alertes restent indisponibles.'
          }
        />

        <Button
          label="Utiliser ma position"
          variant="outline"
          loading={locating}
          onPress={() => void useMyLocation()}
          icon={<LocateFixed size={20} color="#1E5631" />}
        />
      </View>

      {/* Notifications */}
      <View className="gap-3">
        <SectionTitle>Mes notifications</SectionTitle>
        <PushSection
          enabled={pushEnabled}
          onChange={(value) => saveAlerts({ channel: value ? 'push' : 'none' })}
        />
      </View>

      {/* Alertes */}
      <View className="gap-1">
        <SectionTitle>Mes alertes</SectionTitle>
        <Text className="font-raleway text-secondary text-muted-foreground mb-1">
          Ce dont Growi doit te prévenir.
        </Text>

        <View className="rounded-xl bg-card px-4">
          <Toggle
            label="Gel"
            hint={`En dessous de ${alerts.frostThreshold} °C`}
            value={alerts.frostAlert}
            onChange={(v) => saveAlerts({ frostAlert: v })}
          />
          <Toggle
            label="Canicule"
            hint="Fortes chaleurs annoncées"
            value={alerts.heatAlert}
            onChange={(v) => saveAlerts({ heatAlert: v })}
          />
          <Toggle
            label="Rappels d'arrosage"
            value={alerts.wateringReminder}
            onChange={(v) => saveAlerts({ wateringReminder: v })}
          />
          <Toggle
            label="Semis et récoltes"
            hint="Aux périodes propices"
            value={alerts.seedingAlerts}
            onChange={(v) => saveAlerts({ seedingAlerts: v })}
          />
        </View>
      </View>

      {/* Vers le web */}
      <View className="gap-3">
        <SectionTitle>Sur le site</SectionTitle>
        <Pressable
          onPress={() => void openWeb('/dashboard/jardin')}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-xl bg-card p-4"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        >
          <Map size={22} color="#1E5631" />
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">Plan de mon jardin</Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              Le tracé des zones se fait au grand écran.
            </Text>
          </View>
          <ExternalLink size={18} color="hsl(139 20% 40%)" />
        </Pressable>
      </View>

      {/* À propos */}
      <View className="gap-3">
        <SectionTitle>À propos</SectionTitle>
        <Pressable
          onPress={() => router.push('/onboarding?from=profil')}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-xl bg-card p-4"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        >
          <Sparkles size={22} color="#1E5631" />
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">
              Revoir la présentation
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              Ce que Growi sait faire, en cinq écrans.
            </Text>
          </View>
          <ChevronRight size={18} color="hsl(139 20% 40%)" />
        </Pressable>
      </View>

      {/* Compte */}
      <View className="gap-3">
        <Button
          label="Se déconnecter"
          variant="outline"
          loading={signingOut}
          onPress={confirmSignOut}
          icon={<LogOut size={20} color="#1E5631" />}
        />

        <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2">
          <Pressable onPress={() => void openWeb('/mentions-legales')} hitSlop={8}>
            <Text className="font-raleway text-caption text-muted-foreground underline">
              Mentions légales
            </Text>
          </Pressable>
          <Pressable onPress={() => void openWeb('/confidentialite')} hitSlop={8}>
            <Text className="font-raleway text-caption text-muted-foreground underline">
              Confidentialité
            </Text>
          </Pressable>
          <Pressable onPress={() => void openWeb('/cgu')} hitSlop={8}>
            <Text className="font-raleway text-caption text-muted-foreground underline">
              CGU
            </Text>
          </Pressable>
          <Pressable onPress={() => void openWeb('/contact')} hitSlop={8}>
            <Text className="font-raleway text-caption text-muted-foreground underline">
              Nous contacter
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  )
}

export default function ProfilScreen() {
  const profile = useProfile()
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-sand">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modale : un bouton de fermeture explicite, pas seulement le geste. */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="font-poppins-bold text-screen text-forest">Profil</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text className="font-raleway text-body text-muted-foreground">Fermer</Text>
          </Pressable>
        </View>

        {profile.isPending ? (
          <View className="px-4">
            <ListSkeleton count={3} />
          </View>
        ) : profile.isError ? (
          <ErrorState
            message={errorMessage(profile.error)}
            onRetry={() => void profile.refetch()}
          />
        ) : (
          <ProfilContent profile={profile.data} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
