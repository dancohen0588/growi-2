import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { isApiError } from '@growi/api-client'
import { DELETE_ACCOUNT_CONFIRMATION, type UserProfile } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useProfile } from '@/lib/queries/me'
import { useSession } from '@/store/session'

/**
 * Suppression du compte — modale déclarée à la racine, ouverte depuis le
 * profil.
 *
 * Deux verrous, comme sur le web : taper le mot exact, et prouver sa présence
 * — le mot de passe pour un compte qui en a un ; pour un compte Apple/Google,
 * une connexion de moins de dix minutes, que le serveur lit dans le jeton.
 * Faute de quoi il répond 401 : on déconnecte alors, pour que la reconnexion
 * produise le jeton qu'il attend.
 */
export default function SupprimerCompteScreen() {
  const profile = useProfile()

  return (
    <SafeAreaView className="flex-1 bg-sand">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Annuler"
          className="min-h-11 justify-center"
        >
          <Text className="font-raleway text-body text-muted-foreground">Annuler</Text>
        </Pressable>
        <Text className="font-poppins-bold text-section text-forest">Supprimer mon compte</Text>
        {/* Espace symétrique, pour que le titre reste centré. */}
        <View className="w-16" />
      </View>

      {profile.isPending ? (
        <View className="px-4">
          <ListSkeleton count={2} />
        </View>
      ) : profile.isError ? (
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      ) : (
        <DeleteForm profile={profile.data} />
      )}
    </SafeAreaView>
  )
}

function DeleteForm({ profile }: { profile: UserProfile }) {
  const toast = useToast()
  const signOut = useSession((s) => s.signOut)
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready =
    confirmation.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRMATION &&
    (!profile.hasPassword || password.length > 0)

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)

    try {
      await api.me.delete({
        confirmation: DELETE_ACCOUNT_CONFIRMATION,
        ...(profile.hasPassword ? { password } : {}),
      })
    } catch (err) {
      setBusy(false)

      if (isApiError(err) && err.isUnauthorized) {
        if (profile.hasPassword) {
          // Mot de passe faux : on reste, le champ est à corriger.
          setError(err.message || 'Mot de passe incorrect.')
          return
        }
        // Compte Apple/Google connecté depuis trop longtemps : il faut une
        // connexion fraîche, qu'on ne peut obtenir qu'en repassant par elle.
        toast('Reconnecte-toi pour supprimer ton compte.', 'error')
        await signOut()
        router.replace('/(auth)/login')
        return
      }

      setError(isApiError(err) && err.status === 403 ? err.message : errorMessage(err))
      return
    }

    // Le compte n'existe plus : la déconnexion efface les jetons et l'identité
    // de l'appareil, sans attendre du serveur ce qu'il ne peut plus rendre.
    await signOut()
    toast('Ton compte a été supprimé.')
    router.replace('/(auth)/login')
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-raleway text-body text-forest">
          Tes jardins, tes plantes, tes photos, tes publications, tes annonces et tes
          commentaires seront effacés{' '}
          <Text className="font-raleway-semibold">immédiatement et définitivement</Text>. Rien ne
          pourra être récupéré.
        </Text>

        <Input
          label={`Tape ${DELETE_ACCOUNT_CONFIRMATION} pour confirmer`}
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType={profile.hasPassword ? 'next' : 'done'}
          editable={!busy}
        />

        {profile.hasPassword ? (
          <Input
            label="Ton mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            revealable
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            editable={!busy}
          />
        ) : (
          <Text className="font-raleway text-secondary text-muted-foreground">
            Ton compte est relié à Apple ou Google : si tu t’es connecté il y a plus de dix
            minutes, on te demandera de te reconnecter d’abord.
          </Text>
        )}

        {error ? (
          <View className="rounded-lg border border-destructive bg-card p-3" accessibilityRole="alert">
            <Text className="font-raleway text-secondary text-destructive">{error}</Text>
          </View>
        ) : null}

        <Button
          label="Supprimer définitivement"
          variant="destructive"
          size="lg"
          loading={busy}
          disabled={!ready}
          onPress={() => void submit()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
