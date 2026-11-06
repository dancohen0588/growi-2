import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { isApiError } from '@growi/api-client'
import { ChevronRight, Gift, Lightbulb } from 'lucide-react-native'
import { SAP_GIFT_REASON_PHRASES, sapGiftReasonSchema, type Quartier } from '@growi/shared'

import { CommunityDisabled } from '@/components/community/CommunityDisabled'
import { CommunityHeader } from '@/components/community/CommunityHeader'
import { ChallengeCard } from '@/components/quartier/ChallengeCard'
import { quartierPlace } from '@/components/quartier/actions'
import { SapDrop } from '@/components/sap/SapDrop'
import { SapProgressBar } from '@/components/sap/SapProgressBar'
import { CARD_SHADOW } from '@/components/ui/Card'
import { ErrorState, Pulse, Skeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useQuartier } from '@/lib/queries/community'

/**
 * « Ton quartier » — la sève du quartier (maquette 5 de « Growi — La Sève »).
 *
 * Le défi de la semaine, ce qui a circulé, les Secrets qui marchent ici et
 * tes mercis. Rien n'y classe personne : tout est compté ensemble, et les
 * gouttes nommées ne sont que les tiennes (décision du 06/11/2026).
 */
export default function QuartierScreen() {
  const quartier = useQuartier()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await quartier.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [quartier])

  const disabled = quartier.isError && isApiError(quartier.error) && quartier.error.status === 403

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <CommunityHeader title="Ton quartier" parent="/(tabs)/communaute" />

      {quartier.isPending ? (
        <QuartierSkeleton />
      ) : disabled ? (
        <CommunityDisabled />
      ) : quartier.isError ? (
        <ErrorState message={errorMessage(quartier.error)} onRetry={() => void quartier.refetch()} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-7 px-4 pb-10 pt-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />}
        >
          <Scope quartier={quartier.data} />
          {quartier.data.challenge ? <ChallengeCard challenge={quartier.data.challenge} /> : null}
          <Circulation quartier={quartier.data} />
          <SecretsHere quartier={quartier.data} />
          <Thanks quartier={quartier.data} />
          <Text className="text-center font-raleway text-secondary text-muted-foreground">
            Pas de classement ici : la sève du quartier monte quand on partage.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

/** Qui compte dans ce quartier — et pourquoi il est plus large que prévu. */
function Scope({ quartier }: { quartier: Quartier }) {
  const widened = quartier.radiusKm !== quartier.chosenRadiusKm
  const who = `${quartier.gardeners} jardinier${quartier.gardeners > 1 ? 's' : ''} ${quartierPlace(quartier.radiusKm)}`
  return (
    <Text className="font-raleway text-secondary text-muted-foreground">
      {widened
        ? `Ton rayon de ${quartier.chosenRadiusKm} km compte encore peu de jardiniers : ton quartier réunit ${who}.`
        : `Ton quartier réunit ${who}.`}
    </Text>
  )
}

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-poppins text-section text-forest" accessibilityRole="header">
        {children}
      </Text>
      {hint ? <Text className="font-raleway text-secondary text-muted-foreground">{hint}</Text> : null}
    </View>
  )
}

function Circulation({ quartier }: { quartier: Quartier }) {
  const { circulation } = quartier
  const tiles = [
    { value: circulation.exchanges, label: circulation.exchanges > 1 ? 'échanges menés à bien' : 'échange mené à bien' },
    { value: circulation.gifts, label: circulation.gifts > 1 ? 'gouttes offertes entre voisins' : 'goutte offerte entre voisins' },
    { value: circulation.secretsTried, label: circulation.secretsTried > 1 ? 'Secrets testés' : 'Secret testé' },
  ]
  return (
    <View className="gap-3">
      <SectionTitle hint={`Ces ${circulation.days} derniers jours, dans ton quartier`}>Ce qui a circulé</SectionTitle>
      <View className="flex-row gap-2.5">
        {tiles.map((tile) => (
          <View
            key={tile.label}
            accessible
            accessibilityLabel={`${tile.value} ${tile.label}`}
            className="flex-1 gap-1 rounded-xl bg-card p-3"
            style={CARD_SHADOW}
          >
            <Text className="font-poppins-bold text-forest" style={{ fontSize: 26, lineHeight: 32 }}>
              {tile.value}
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">{tile.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function SecretsHere({ quartier }: { quartier: Quartier }) {
  const router = useRouter()
  return (
    <View className="gap-3">
      <SectionTitle>Les Secrets qui marchent ici</SectionTitle>
      {quartier.secrets.length === 0 ? (
        <View className="rounded-xl bg-card p-4">
          <Text className="font-raleway text-secondary text-muted-foreground">
            Pas encore assez de retours dans ton quartier. Quand tu testes un Secret, dis si ça a marché : c’est ce qui
            remplit cette liste.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {quartier.secrets.map((secret) => (
            <Pressable
              key={secret.slug}
              onPress={() => router.navigate('/(tabs)/accueil/grimoire')}
              accessibilityRole="button"
              accessibilityLabel={`${secret.title} : ça a marché pour ${secret.worked} voisins sur ${secret.total}. Ouvrir le grimoire`}
              className="flex-row items-center gap-3 rounded-xl bg-card p-3.5"
              style={({ pressed }) => [CARD_SHADOW, pressed ? { transform: [{ scale: 0.98 }] } : null]}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-sun/40">
                <Lightbulb size={18} color="#1E5631" />
              </View>
              <View className="flex-1 gap-1.5">
                <Text className="font-raleway-semibold text-secondary text-forest" numberOfLines={2}>
                  {secret.title}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <SapProgressBar progress={secret.worked / secret.total} />
                  </View>
                  <Text className="font-raleway text-caption text-muted-foreground">
                    {secret.worked} voisin{secret.worked > 1 ? 's' : ''} sur {secret.total}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#1E5631" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

function reasonPhrase(reason: string): string {
  const parsed = sapGiftReasonSchema.safeParse(reason)
  return parsed.success ? SAP_GIFT_REASON_PHRASES[parsed.data] : ''
}

function Thanks({ quartier }: { quartier: Quartier }) {
  const { thanks } = quartier
  return (
    <View className="gap-3">
      <SectionTitle
        hint={
          thanks.weekCount > 0
            ? `${thanks.weekCount} goutte${thanks.weekCount > 1 ? 's' : ''} offerte${thanks.weekCount > 1 ? 's' : ''} dans ton quartier cette semaine`
            : undefined
        }
      >
        Tes mercis de la semaine
      </SectionTitle>
      {thanks.mine.length === 0 ? (
        <View className="flex-row items-center gap-3 rounded-xl bg-card p-4">
          <Gift size={20} color="#1E5631" />
          <Text className="flex-1 font-raleway text-secondary text-muted-foreground">
            Pas encore de goutte cette semaine. Une goutte s’offre sous la publication d’un voisin.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {thanks.mine.map((gift, index) => (
            <View key={`${gift.createdAt}-${index}`} className="flex-row items-start gap-3 rounded-xl bg-card p-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-lime">
                <Text className="font-poppins-bold text-secondary text-forest">
                  {gift.handle.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-raleway text-secondary text-forest">
                  {gift.direction === 'received' ? (
                    <>
                      <Text className="font-raleway-bold">{gift.handle}</Text> t’a offert une goutte {reasonPhrase(gift.reason)}
                    </>
                  ) : (
                    <>
                      Tu as offert une goutte à <Text className="font-raleway-bold">{gift.handle}</Text>
                    </>
                  )}
                </Text>
                <Text className="font-raleway text-caption text-muted-foreground">
                  {gift.message ? `« ${gift.message} » · ` : ''}
                  {formatLogDate(gift.createdAt)}
                </Text>
              </View>
              <SapDrop size={20} veins={false} />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function QuartierSkeleton() {
  return (
    <View className="px-4 pt-1" accessibilityLabel="Chargement de ton quartier">
      <Pulse style={{ gap: 14 }}>
        <Skeleton className="h-4 w-2/3" />
        <View className="h-[360px] w-full rounded-3xl bg-sand-dark" />
        <Skeleton className="h-5 w-1/3" />
        <View className="flex-row gap-2.5">
          <View className="h-20 flex-1 rounded-xl bg-sand-dark" />
          <View className="h-20 flex-1 rounded-xl bg-sand-dark" />
          <View className="h-20 flex-1 rounded-xl bg-sand-dark" />
        </View>
      </Pulse>
    </View>
  )
}
