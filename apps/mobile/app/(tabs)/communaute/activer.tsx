import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Check, Eye, EyeOff, X } from 'lucide-react-native'
import type { CommunitySettings } from '@growi/shared'
import { BIO_MAX_LENGTH, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import {
  useCommunitySettings,
  useHandleAvailability,
  useUpdateCommunitySettings,
} from '@/lib/queries/community'
import { useDebouncedValue } from '@/lib/use-debounced-value'

/**
 * Écran 11 — activer (ou modifier) son profil public.
 *
 * L'opt-in est explicite, et cet écran est le seul endroit où on l'explique :
 * ce qui devient visible des autres jardiniers, et ce qui n'en sort jamais.
 * Le même écran sert ensuite à changer de pseudo ou de présentation.
 */

/** Une ligne du récapitulatif « visible / privé ». */
function VisibilityRow({ visible, text }: { visible: boolean; text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      {visible ? (
        <Eye size={18} color="#1E5631" />
      ) : (
        <EyeOff size={18} color="hsl(139 20% 40%)" />
      )}
      <Text
        className={[
          'flex-1 font-raleway text-secondary',
          visible ? 'text-forest' : 'text-muted-foreground',
        ].join(' ')}
      >
        {text}
      </Text>
    </View>
  )
}

/** Monté une fois les réglages chargés, pour partir des bonnes valeurs. */
function ActiverContent({ settings }: { settings: CommunitySettings }) {
  const router = useRouter()
  const toast = useToast()
  const update = useUpdateCommunitySettings()

  const [handle, setHandle] = useState(settings.handle ?? '')
  const [bio, setBio] = useState(settings.bio ?? '')

  const debouncedHandle = useDebouncedValue(handle)
  const availability = useHandleAvailability(debouncedHandle)

  const normalized = handle.trim().toLowerCase()
  const unchanged = normalized === (settings.handle ?? '')
  const tooShort = normalized.length > 0 && normalized.length < HANDLE_MIN_LENGTH

  // Tant que la vérification court sur une valeur périmée, on ne dit rien :
  // afficher « déjà pris » sous un pseudo qu'on vient de corriger est pire que
  // de ne rien afficher.
  const checked =
    availability.data && availability.data.handle === normalized ? availability.data : null

  const handleError = tooShort
    ? `Au moins ${HANDLE_MIN_LENGTH} caractères`
    : checked && !checked.available
      ? checked.reason ?? 'Ce pseudo n’est pas disponible'
      : undefined

  const canSubmit =
    normalized.length >= HANDLE_MIN_LENGTH && (unchanged || checked?.available === true)

  const submit = async () => {
    try {
      await update.mutateAsync({
        enabled: true,
        handle: normalized,
        // `null` efface la présentation ; une chaîne vide serait stockée telle quelle.
        bio: bio.trim() || null,
      })
      toast(settings.enabled ? 'Profil mis à jour 🌱' : 'Te voilà dans la communauté 🌱')
      router.back()
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  // Sans position, ni fil local ni distance : le profil serait activé et
  // invisible. On le dit avant de faire saisir un pseudo pour rien.
  if (!settings.hasLocation) {
    return (
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <View className="rounded-xl bg-card p-4 gap-2">
          <Text className="font-poppins text-section text-forest">
            Où se trouve ton jardin ?
          </Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            La communauté est locale : elle montre les jardiniers autour de toi. Indique la ville
            de ton jardin pour la rejoindre — ton adresse exacte, elle, n’est jamais partagée.
          </Text>
        </View>

        <Button
          label="Indiquer ma ville"
          onPress={() => router.replace('/(tabs)/accueil/profil')}
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-8 gap-6"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="font-raleway text-secondary text-muted-foreground">
        Choisis un pseudo : c’est sous ce nom que les jardiniers du coin te verront. Ton prénom et
        ton nom restent privés.
      </Text>

      <View className="gap-3">
        <Input
          label="Pseudo"
          placeholder="pierre_potager"
          value={handle}
          onChangeText={(value) => setHandle(value.toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={HANDLE_MAX_LENGTH}
          returnKeyType="next"
          error={handleError}
          hint="Lettres sans accent, chiffres et « _ »."
        />

        {checked?.available && !unchanged ? (
          <View className="flex-row items-center gap-2">
            <Check size={16} color="#1E5631" />
            <Text className="font-raleway text-caption text-forest">
              « {checked.handle} » est libre
            </Text>
          </View>
        ) : null}

        <Input
          label="Présentation (facultatif)"
          placeholder="Potager de 100 m², beaucoup de tomates."
          value={bio}
          onChangeText={setBio}
          maxLength={BIO_MAX_LENGTH}
          multiline
          returnKeyType="done"
          hint={`${bio.length}/${BIO_MAX_LENGTH}`}
        />
      </View>

      <View className="rounded-xl bg-card p-4 gap-3">
        <Text className="font-poppins text-section text-forest">Ce que les autres voient</Text>
        <VisibilityRow visible text="Ton pseudo et ta présentation" />
        <VisibilityRow visible text={`Ta ville${settings.city ? ` — ${settings.city}` : ''}`} />
        <VisibilityRow visible text="Une distance approximative, arrondie au kilomètre" />
        <VisibilityRow visible={false} text="Ton nom, ton email, ton adresse" />
        <VisibilityRow visible={false} text="Tes jardins, tes plantes et ton journal" />
      </View>

      {/* Action principale en bas : zone du pouce. */}
      <Button
        label={settings.enabled ? 'Enregistrer' : 'Activer mon profil'}
        size="lg"
        loading={update.isPending}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />
    </ScrollView>
  )
}

export default function ActiverCommunauteScreen() {
  const router = useRouter()
  const settings = useCommunitySettings()

  return (
    <SafeAreaView className="flex-1 bg-sand">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modale : une fermeture explicite, pas seulement le geste. */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="font-poppins-bold text-screen text-forest">Profil public</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <X size={24} color="hsl(139 20% 40%)" />
          </Pressable>
        </View>

        {settings.isPending ? (
          <View className="px-4">
            <ListSkeleton count={3} />
          </View>
        ) : settings.isError ? (
          <ErrorState
            message={errorMessage(settings.error)}
            onRetry={() => void settings.refetch()}
          />
        ) : (
          <ActiverContent settings={settings.data} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
