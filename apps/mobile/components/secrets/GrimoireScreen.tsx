import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Lock,
  RotateCcw,
} from 'lucide-react-native'
import { SECRET_VERDICT_LABELS, type GrimoireEntry } from '@growi/shared'

import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { useTrack } from '@/lib/analytics/posthog'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useGrimoire, useRestoreSecret } from '@/lib/queries/secrets'

import { EvidenceBadge } from './EvidenceBadge'
import { SecretRecipe } from './SecretRecipe'

/** « Essayé 2 fois · la dernière il y a 3 jours » */
function trialsLine(entry: GrimoireEntry): string | null {
  if (entry.trials === 0) return null
  const times = entry.trials > 1 ? `Essayé ${entry.trials} fois` : 'Essayé une fois'
  if (!entry.triedAt) return times
  const when = formatLogDate(entry.triedAt)
  return `${times} · ${entry.trials > 1 ? 'la dernière ' : ''}${when}`
}

function EntryCard({
  entry,
  onRestore,
  restoring,
}: {
  entry: GrimoireEntry
  onRestore: () => void
  restoring: boolean
}) {
  const [open, setOpen] = useState(false)
  const trials = trialsLine(entry)

  if (!entry.discovered) {
    // Verrouillé : titre, accroche et badge. La recette se mérite.
    return (
      <View
        className="gap-2 rounded-xl border border-dashed border-forest/25 bg-card p-4"
        accessible
        accessibilityLabel={`${entry.title}, pas encore découvert. ${entry.teaser}`}
      >
        <View className="flex-row items-center gap-2">
          <Lock size={16} color="hsl(139 20% 40%)" />
          <Text className="flex-1 font-poppins text-body text-muted-foreground" numberOfLines={2}>
            {entry.title}
          </Text>
        </View>
        <Text className="font-raleway text-secondary italic text-muted-foreground">
          « {entry.teaser} »
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <EvidenceBadge evidence={entry.evidence} />
          {entry.dismissed ? (
            <Text className="font-raleway text-caption text-muted-foreground">Mis de côté</Text>
          ) : null}
        </View>
        {entry.dismissed ? <RestoreButton onPress={onRestore} loading={restoring} /> : null}
      </View>
    )
  }

  return (
    <View className="overflow-hidden rounded-xl border border-forest/15 bg-sand-dark">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${entry.title}${open ? '' : ', voir la recette'}`}
        className="gap-2 p-4"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 font-poppins text-body text-forest">{entry.title}</Text>
          {open ? (
            <ChevronUp size={20} color="#1E5631" />
          ) : (
            <ChevronDown size={20} color="#1E5631" />
          )}
        </View>
        <Text className="font-raleway text-secondary italic text-forest">« {entry.teaser} »</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <EvidenceBadge evidence={entry.evidence} />
          {entry.verdict ? (
            <View className="rounded-full bg-card px-2.5 py-1">
              <Text className="font-raleway-medium text-caption text-forest">
                {SECRET_VERDICT_LABELS[entry.verdict]}
              </Text>
            </View>
          ) : null}
        </View>
        {trials ? (
          <Text className="font-raleway text-caption text-muted-foreground">{trials}</Text>
        ) : null}
        {entry.dismissed ? (
          <Text className="font-raleway text-caption text-muted-foreground">
            Mis de côté — il ne t&apos;est plus proposé.
          </Text>
        ) : null}
      </Pressable>

      {open ? (
        <View className="border-t border-forest/10 px-4 pb-4 pt-3">
          <SecretRecipe
            story={entry.story}
            ingredients={entry.ingredients}
            recipe={entry.recipe}
            cautions={entry.cautions}
          />
        </View>
      ) : null}

      {entry.dismissed ? (
        <View className="px-4 pb-4">
          <RestoreButton onPress={onRestore} loading={restoring} />
        </View>
      ) : null}
    </View>
  )
}

function RestoreButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Me le reproposer"
      accessibilityState={{ busy: loading }}
      className="h-11 flex-row items-center gap-2 self-start rounded-lg border border-forest px-4"
      style={({ pressed }) => (pressed || loading ? { opacity: 0.6 } : null)}
    >
      <RotateCcw size={16} color="#1E5631" />
      <Text className="font-raleway-semibold text-secondary text-forest">Me le reproposer</Text>
    </Pressable>
  )
}

/**
 * Le grimoire — la collection des secrets de jardinier.
 *
 * Monté dans les piles Accueil et Calendrier (on y arrive depuis la carte du
 * planning comme depuis le profil), pour ne jamais faire changer d'onglet.
 */
export function GrimoireScreen() {
  const router = useRouter()
  const toast = useToast()
  const track = useTrack()
  const grimoire = useGrimoire()
  const restore = useRestoreSecret()
  const [refreshing, setRefreshing] = useState(false)

  // Une vue par chargement, pas une par rendu.
  const viewed = useRef(false)
  useEffect(() => {
    if (viewed.current || !grimoire.data) return
    viewed.current = true
    track('grimoire_viewed', {
      discovered: grimoire.data.discovered,
      total: grimoire.data.total,
    })
  }, [grimoire.data, track])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await grimoire.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [grimoire])

  const restoreEntry = (slug: string) =>
    restore.mutate(slug, {
      onSuccess: () => toast('Il revient dans la rotation de tes secrets 🌱'),
      onError: (error) => toast(errorMessage(error), 'error'),
    })

  const data = grimoire.data
  const progress = data && data.total > 0 ? data.discovered / data.total : 0

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="-ml-2 h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>

        <View className="flex-1">
          <Text className="font-poppins-bold text-screen text-forest">Mon grimoire</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            Les secrets de jardinier que tu as découverts.
          </Text>
        </View>
      </View>

      {grimoire.isPending ? (
        <View className="px-4 pt-2">
          <ListSkeleton count={4} />
        </View>
      ) : grimoire.isError ? (
        <ErrorState
          message={errorMessage(grimoire.error)}
          onRetry={() => void grimoire.refetch()}
        />
      ) : (
        <FlatList
          data={data?.entries ?? []}
          keyExtractor={(entry) => entry.slug}
          contentContainerClassName="gap-3 px-4 pb-8 pt-2"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
          }
          ListHeaderComponent={
            data && data.total > 0 ? (
              <View className="mb-2 gap-2 rounded-xl bg-card p-4">
                <Text className="font-poppins text-section text-forest">
                  {data.discovered} / {data.total} secret{data.total > 1 ? 's' : ''} découvert
                  {data.discovered > 1 ? 's' : ''}
                </Text>
                <View
                  className="h-2 overflow-hidden rounded-full bg-sand-dark"
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: data.total, now: data.discovered }}
                >
                  <View className="h-full rounded-full bg-lime" style={{ width: `${progress * 100}%` }} />
                </View>
                <Text className="font-raleway text-caption text-muted-foreground">
                  Un nouveau secret t&apos;attend chaque semaine dans ton calendrier.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              emoji="📖"
              title="Ton grimoire attend sa première page"
              message="Chaque semaine, ton calendrier te glisse un secret de jardinier. Dévoile-le : il viendra s'inscrire ici."
              cta={{ label: 'Voir mon calendrier', onPress: () => router.navigate('/(tabs)/calendrier') }}
            />
          }
          renderItem={({ item }) => (
            <EntryCard
              entry={item}
              onRestore={() => restoreEntry(item.slug)}
              restoring={restore.isPending && restore.variables === item.slug}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
