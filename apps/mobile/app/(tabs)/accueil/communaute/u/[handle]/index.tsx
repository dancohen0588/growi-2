import { Alert, FlatList, Pressable, RefreshControl, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, MoreHorizontal, ShieldBan } from 'lucide-react-native'
import type { CommunityPost, CommunityProfile } from '@growi/shared'
import { REPORT_REASONS, REPORT_REASON_LABELS } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import {
  useCommunityProfile,
  useReport,
  useToggleBlock,
  useToggleFollow,
  useUserPosts,
} from '@/lib/queries/community'

/**
 * Écran 3 — le profil public d'un jardinier.
 *
 * Avatar, pseudo, ville, présentation, compteurs, et la grille de ses
 * publications. C'est le seul endroit d'où l'on suit, bloque et signale
 * quelqu'un.
 */

function Counter({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      className="h-11 flex-1 items-center justify-center"
      style={({ pressed }) => (pressed && onPress ? { opacity: 0.7 } : null)}
    >
      <Text className="font-poppins-bold text-section text-forest">{value}</Text>
      <Text className="font-raleway text-caption text-muted-foreground">{label}</Text>
    </Pressable>
  )
}

function ProfileHeader({ profile }: { profile: CommunityProfile }) {
  const router = useRouter()
  const toast = useToast()
  const follow = useToggleFollow(profile.handle)
  const block = useToggleBlock(profile.handle)
  const report = useReport()

  const confirmBlock = () => {
    Alert.alert(
      `Bloquer ${profile.handle} ?`,
      'Vous ne verrez plus vos contenus respectifs, et vos abonnements seront rompus des deux côtés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: () => {
            block.mutate(true, {
              onSuccess: () => {
                toast('Compte bloqué')
                router.back()
              },
              onError: (error) => toast(errorMessage(error), 'error'),
            })
          },
        },
      ],
    )
  }

  const openReport = () => {
    Alert.alert('Signaler ce compte', 'Pour quelle raison ?', [
      ...REPORT_REASONS.map((reason) => ({
        text: REPORT_REASON_LABELS[reason],
        onPress: () => {
          report.mutate(
            { targetType: 'user', targetId: profile.id, reason },
            {
              // Idempotent côté serveur : signaler deux fois n'est pas une
              // faute, et on remercie de la même façon.
              onSuccess: () => toast('Merci — nous allons vérifier.'),
              onError: (error) => toast(errorMessage(error), 'error'),
            },
          )
        },
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ])
  }

  const openMenu = () => {
    Alert.alert(profile.handle, undefined, [
      { text: 'Signaler ce compte', onPress: openReport },
      { text: 'Bloquer ce compte', style: 'destructive' as const, onPress: confirmBlock },
      { text: 'Annuler', style: 'cancel' as const },
    ])
  }

  return (
    <View className="gap-4 px-4 pb-4">
      <View className="flex-row items-center gap-4">
        {profile.avatarUrl ? (
          <Image
            source={profile.avatarUrl}
            style={{ width: 72, height: 72, borderRadius: 36 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            className="h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ backgroundColor: profile.avatarColor ?? '#B4DD7F' }}
          >
            <Text className="font-poppins-bold text-screen text-forest">
              {profile.handle.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1 gap-0.5">
          <Text className="font-poppins-bold text-screen text-forest" numberOfLines={1}>
            {profile.handle}
          </Text>
          <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
            {[profile.city, profile.distanceLabel].filter(Boolean).join(' · ') || 'Jardinier'}
          </Text>
        </View>

        {!profile.isSelf ? (
          <Pressable
            onPress={openMenu}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Plus d’options"
          >
            <MoreHorizontal size={24} color="hsl(139 20% 40%)" />
          </Pressable>
        ) : null}
      </View>

      {profile.bio ? (
        <Text className="font-raleway text-body text-forest">{profile.bio}</Text>
      ) : null}

      <View className="flex-row rounded-xl bg-card py-2">
        <Counter value={profile.postCount} label="publications" />
        <Counter
          value={profile.followerCount}
          label="abonnés"
          onPress={() =>
            router.push(`/(tabs)/accueil/communaute/u/${profile.handle}/abonnes`)
          }
        />
        <Counter
          value={profile.followingCount}
          label="abonnements"
          onPress={() =>
            router.push(`/(tabs)/accueil/communaute/u/${profile.handle}/abonnements`)
          }
        />
      </View>

      {profile.isBlocked ? (
        <View className="flex-row items-center gap-2 rounded-xl bg-card p-4">
          <ShieldBan size={20} color="hsl(139 20% 40%)" />
          <Text className="flex-1 font-raleway text-secondary text-muted-foreground">
            Tu as bloqué ce compte. Débloque-le depuis tes réglages pour revoir ses publications.
          </Text>
        </View>
      ) : profile.isSelf ? (
        <Button
          label="Modifier mon profil"
          variant="outline"
          onPress={() => router.push('/(tabs)/accueil/communaute/activer')}
        />
      ) : (
        <Button
          label={profile.isFollowing ? 'Abonné·e' : 'Suivre'}
          variant={profile.isFollowing ? 'outline' : 'primary'}
          loading={follow.isPending}
          onPress={() =>
            follow.mutate(!profile.isFollowing, {
              onError: (error) => toast(errorMessage(error), 'error'),
            })
          }
        />
      )}
    </View>
  )
}

export default function ProfilPublicScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const router = useRouter()
  const { width } = useWindowDimensions()

  const profile = useCommunityProfile(handle ?? '')
  const posts = useUserPosts(handle ?? '')

  const items: CommunityPost[] = posts.data?.pages.flatMap((page) => page.items) ?? []
  // Grille de trois, marges de 16 et gouttières de 2.
  const tile = (width - 32 - 4) / 3

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-screen text-forest" numberOfLines={1}>
          {profile.data?.handle ?? 'Profil'}
        </Text>
      </View>

      {profile.isPending ? (
        <View className="px-4">
          <ListSkeleton count={2} />
        </View>
      ) : profile.isError ? (
        <ErrorState
          message={errorMessage(profile.error)}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(post) => post.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerClassName="px-4 pb-8 gap-0.5"
          ListHeaderComponent={<ProfileHeader profile={profile.data} />}
          refreshControl={
            <RefreshControl
              refreshing={profile.isRefetching}
              onRefresh={() => {
                void profile.refetch()
                void posts.refetch()
              }}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🌿"
              title="Rien à voir pour l’instant"
              message={
                profile.data.isSelf
                  ? 'Tes publications apparaîtront ici.'
                  : 'Ce jardinier n’a encore rien publié.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(`/(tabs)/accueil/communaute/publications/${item.id}`)
              }
              accessibilityRole="button"
              accessibilityLabel={`Publication du ${item.createdAt}`}
              className="overflow-hidden rounded-lg bg-sand-dark"
              style={{ width: tile, height: tile }}
            >
              {item.photos[0] ? (
                <Image
                  source={item.photos[0]}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={150}
                  recyclingKey={item.id}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}
