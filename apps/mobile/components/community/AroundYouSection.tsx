import { FlatList, Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ChevronRight, Users } from 'lucide-react-native'
import type { CommunityPost } from '@growi/shared'

import { useCommunityHome } from '@/lib/queries/community'

/**
 * La carte « Autour de toi » de l'Accueil.
 *
 * Chargée **après** le reste de l'écran, par une route qui lui est propre :
 * l'accueil est la page la plus consultée de l'app, et une requête
 * géographique n'a pas à en retarder l'affichage.
 *
 * Elle ne s'affiche pas du tout tant que le profil public n'est pas activé —
 * proposer la communauté est le rôle de l'onglet Profil, pas celui d'un espace
 * vide en plein milieu de l'accueil.
 */

function Thumb({ post, onPress }: { post: CommunityPost; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Publication de ${post.author.handle}`}
      className="w-32 gap-1.5"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
    >
      <View className="h-32 w-32 overflow-hidden rounded-xl bg-sand-dark">
        {post.photos[0] ? (
          <Image
            source={post.photos[0]}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <Text className="font-raleway-medium text-caption text-forest" numberOfLines={1}>
        {post.author.handle}
      </Text>
      {post.author.distanceLabel ? (
        <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
          {post.author.distanceLabel}
        </Text>
      ) : null}
    </Pressable>
  )
}

export function AroundYouSection() {
  const router = useRouter()
  const home = useCommunityHome()

  // Ni squelette ni erreur : la carte est un complément. Tant qu'on ne sait
  // rien, l'accueil se lit très bien sans elle.
  if (!home.data?.enabled) return null

  // La communauté est un onglet à part : `navigate` le sélectionne avant
  // d'empiler, là où `push` empilerait la destination dans la pile Accueil.
  const openFeed = () => router.navigate('/(tabs)/communaute')

  return (
    <View className="gap-3">
      <Pressable
        onPress={openFeed}
        accessibilityRole="button"
        className="flex-row items-center gap-2 px-4"
        hitSlop={8}
      >
        <Users size={20} color="#1E5631" />
        <Text className="flex-1 font-poppins text-section text-forest">Autour de toi</Text>
        <ChevronRight size={18} color="hsl(139 20% 40%)" />
      </Pressable>

      {home.data.posts.length === 0 ? (
        <Pressable
          onPress={() => router.push('/publier')}
          accessibilityRole="button"
          className="mx-4 rounded-xl bg-card p-4"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        >
          <Text className="font-raleway text-secondary text-muted-foreground">
            Personne n’a encore publié près de chez toi — sois le premier 🌱
          </Text>
        </Pressable>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={home.data.posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Thumb
              post={item}
              onPress={() => router.navigate(`/(tabs)/communaute/publications/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  )
}
