import { Alert, Pressable, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { ChevronRight, ShieldBan, Users } from 'lucide-react-native'
import type { CommunityAlertConfig, UpdateAlertConfigInput } from '@growi/shared'
import { COMMUNITY_RADII_KM, COMMUNITY_RADIUS_LABELS } from '@growi/shared'

import { OptionGroup } from '@/components/ui/OptionGroup'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { useCommunitySettings, useUpdateCommunitySettings } from '@/lib/queries/community'

/**
 * Écran 12 — réglages de la communauté, dans l'onglet Profil.
 *
 * Tant que le profil public n'est pas activé, cette section se réduit à une
 * invitation : afficher un rayon et des interrupteurs pour quelque chose qui
 * n'existe pas encore ne dirait rien à personne.
 */

export interface CommunitySectionProps {
  /** Préférences de notification du compte (`alertConfig.community`). */
  alerts: CommunityAlertConfig
  onAlertsChange: (patch: UpdateAlertConfigInput) => void
}

const RADIUS_OPTIONS = COMMUNITY_RADII_KM.map((km) => ({
  value: String(km),
  label: COMMUNITY_RADIUS_LABELS[km],
}))

export function CommunitySection({ alerts, onAlertsChange }: CommunitySectionProps) {
  const router = useRouter()
  const toast = useToast()
  const settings = useCommunitySettings()
  const update = useUpdateCommunitySettings()

  /**
   * Le profil est une **modale native** : une destination ouverte par-dessus se
   * monte *derrière* elle, et la modale reste là — c'est ce qui arrivait à
   * « Comptes bloqués », comme à « Revoir la présentation ». On referme
   * d'abord ; la modale glisse vers le bas en découvrant l'écran demandé.
   *
   * Les trois destinations d'ici vivent de toute façon dans l'onglet
   * Communauté : on quitte le profil dans tous les cas.
   */
  const leaveProfile = (href: Href) => {
    router.back()
    router.navigate(href)
  }

  // Tant que les réglages ne sont pas lus, on n'affiche rien plutôt qu'un état
  // qui se corrigerait sous les yeux de l'utilisateur — comme PushSection.
  if (settings.isPending || settings.isError) return null

  const { data } = settings

  if (!data.enabled) {
    return (
      <Pressable
        onPress={() => leaveProfile('/(tabs)/communaute/activer')}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-xl bg-card p-4"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
      >
        <Users size={22} color="#1E5631" />
        <View className="flex-1">
          <Text className="font-raleway-medium text-body text-forest">
            Rejoindre la communauté
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground">
            Échange avec les jardiniers autour de chez toi. Ton adresse reste privée.
          </Text>
        </View>
        <ChevronRight size={18} color="hsl(139 20% 40%)" />
      </Pressable>
    )
  }

  const setRadius = (value: string) => {
    const radiusKm = Number(value) as (typeof COMMUNITY_RADII_KM)[number]
    update.mutate(
      { radiusKm },
      { onError: (error) => toast(errorMessage(error), 'error') },
    )
  }

  const confirmDisable = () => {
    Alert.alert(
      'Quitter la communauté ?',
      'Ton profil et tes publications ne seront plus visibles. Rien n’est supprimé : tu peux revenir quand tu veux.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await update.mutateAsync({ enabled: false })
              toast('Tu as quitté la communauté')
            } catch (error) {
              toast(errorMessage(error), 'error')
            }
          },
        },
      ],
    )
  }

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => leaveProfile('/(tabs)/communaute/activer')}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-xl bg-card p-4"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
      >
        <Users size={22} color="#1E5631" />
        <View className="flex-1">
          <Text className="font-raleway-medium text-body text-forest">{data.handle}</Text>
          <Text className="font-raleway text-caption text-muted-foreground">
            {data.followerCount} abonné{data.followerCount > 1 ? 's' : ''} ·{' '}
            {data.followingCount} abonnement{data.followingCount > 1 ? 's' : ''}
          </Text>
        </View>
        <ChevronRight size={18} color="hsl(139 20% 40%)" />
      </Pressable>

      <View className="rounded-xl bg-card p-4 gap-2">
        <OptionGroup
          label="Autour de moi"
          options={RADIUS_OPTIONS}
          value={String(data.radiusKm)}
          onChange={setRadius}
        />
        <Text className="font-raleway text-caption text-muted-foreground">
          La distance jusqu’à laquelle tu vois les publications et les annonces.
        </Text>
      </View>

      <View className="rounded-xl bg-card px-4">
        <Toggle
          label="Commentaires"
          hint="Quand quelqu’un réagit à une de tes publications"
          value={alerts.comments}
          onChange={(v) => onAlertsChange({ community: { ...alerts, comments: v } })}
        />
        <Toggle
          label="Messages"
          hint="Les échanges autour de tes annonces"
          value={alerts.messages}
          onChange={(v) => onAlertsChange({ community: { ...alerts, messages: v } })}
        />
        <Toggle
          label="Nouveaux abonnés"
          value={alerts.follows}
          onChange={(v) => onAlertsChange({ community: { ...alerts, follows: v } })}
        />
      </View>

      <Pressable
        onPress={() => leaveProfile('/(tabs)/communaute/bloques')}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-xl bg-card p-4"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
      >
        <ShieldBan size={22} color="#1E5631" />
        <Text className="flex-1 font-raleway-medium text-body text-forest">Comptes bloqués</Text>
        <ChevronRight size={18} color="hsl(139 20% 40%)" />
      </Pressable>

      <Pressable onPress={confirmDisable} hitSlop={8} className="self-start py-2">
        <Text className="font-raleway text-caption text-muted-foreground underline">
          Quitter la communauté
        </Text>
      </Pressable>
    </View>
  )
}
