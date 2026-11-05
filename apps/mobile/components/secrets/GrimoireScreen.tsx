import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { BookOpen, ChevronLeft, Lock, RotateCcw } from 'lucide-react-native'
import { SECRET_VERDICT_LABELS, type GrimoireEntry } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { useTrack } from '@/lib/analytics/posthog'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useGrimoire, useRestoreSecret } from '@/lib/queries/secrets'

import { EvidenceBadge } from './EvidenceBadge'
import { SecretArt } from './SecretArt'
import { SecretEmblem } from './SecretEmblem'
import { SecretPlanche } from './SecretPlanche'
import { SecretRecipe } from './SecretRecipe'

/** « Essayé 2 fois · la dernière il y a 3 jours » */
function trialsLine(entry: GrimoireEntry): string | null {
  if (entry.trials === 0) return null
  const times = entry.trials > 1 ? `Essayé ${entry.trials} fois` : 'Essayé une fois'
  if (!entry.triedAt) return times
  const when = formatLogDate(entry.triedAt)
  return `${times} · ${entry.trials > 1 ? 'la dernière ' : ''}${when}`
}

/** L'ombre décalée pleine des cases de la planche, posée derrière une page. */
function PrintShadow({ faded }: { faded?: boolean }) {
  return (
    <View
      className={`absolute bottom-0 left-0 right-0 top-0 rounded-2xl ${faded ? 'bg-forest/25' : 'bg-forest'}`}
      style={{ transform: [{ translateX: 5 }, { translateY: 5 }] }}
    />
  )
}

/**
 * Une page du grimoire, dans l'habillage « planche BD » (comme le web) :
 *
 * - **découvert** : la première case en couverture, posée de biais, et
 *   « Ouvrir la planche », qui la rouvre en feuille montante ;
 * - **non découvert** : une couverture forest scellée — l'emblème et un
 *   cadenas, rien du dessin. Titre et accroche restent lisibles ;
 * - **mis de côté** : « Me le reproposer ».
 */
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
  const cover = entry.discovered ? entry.planche?.panels[0]?.art : undefined

  return (
    // La marge droite et basse laisse la place à l'ombre décalée.
    <View className="mb-1 mr-1.5">
      <PrintShadow faded={!entry.discovered} />
      <View
        className={`overflow-hidden rounded-2xl border-[3px] ${
          entry.discovered ? 'border-forest bg-card' : 'border-forest/80 bg-card'
        }`}
      >
        {entry.discovered ? (
          <View className="h-40 items-center justify-center border-b-[3px] border-forest bg-lime/50">
            {cover ? (
              <View
                className="w-[62%] overflow-hidden rounded-md border-[3px] border-forest bg-sun/40"
                style={{ transform: [{ rotate: '-2deg' }] }}
              >
                <SecretArt artKey={cover} />
              </View>
            ) : (
              <SecretEmblem size={88} />
            )}
          </View>
        ) : (
          <View
            className="h-40 items-center justify-center border-b-[3px] border-forest/80 bg-forest"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <SecretEmblem size={88} />
            <View className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full border-2 border-sand bg-forest">
              <Lock size={16} color="#F6C445" strokeWidth={2.4} />
            </View>
          </View>
        )}

        <View className="gap-2.5 px-4 pb-4 pt-3.5">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <EvidenceBadge evidence={entry.evidence} tone="sun" />
            {entry.dismissed ? (
              <View className="rounded-full border-2 border-forest/30 px-2.5 py-0.5">
                <Text className="font-poppins text-caption text-muted-foreground">Mis de côté</Text>
              </View>
            ) : null}
          </View>

          <Text className="font-poppins-bold text-section text-forest" accessibilityRole="header">
            {entry.title}
          </Text>
          <Text className="font-raleway text-secondary italic text-muted-foreground">
            « {entry.teaser} »
          </Text>

          {entry.discovered && (trials || entry.verdict) ? (
            <Text className="font-raleway text-caption text-muted-foreground">
              {trials}
              {trials && entry.verdict ? ' · ' : ''}
              {entry.verdict ? (
                <Text className="font-raleway-semibold text-forest">
                  {SECRET_VERDICT_LABELS[entry.verdict]}
                </Text>
              ) : null}
            </Text>
          ) : null}

          {entry.discovered ? (
            <View className="self-start pt-1">
              <Button
                label={entry.planche ? 'Ouvrir la planche' : 'Relire la recette'}
                variant="forest"
                font="poppins-bold"
                raised
                icon={<BookOpen size={18} color="#B4DD7F" />}
                onPress={() => setOpen(true)}
              />
            </View>
          ) : (
            <View className="flex-row items-center gap-1.5 pt-1">
              <Lock size={14} color="hsl(139 20% 40%)" />
              <Text className="font-poppins text-secondary text-muted-foreground">
                Se dévoile dans ton calendrier
              </Text>
            </View>
          )}

          {entry.dismissed ? <RestoreButton onPress={onRestore} loading={restoring} /> : null}
        </View>
      </View>

      {open ? <GrimoireSheet entry={entry} onClose={() => setOpen(false)} /> : null}
    </View>
  )
}

/**
 * La planche relue depuis le grimoire, en feuille montante comme depuis le
 * calendrier — sans « Je tente » : un secret se tente quand le calendrier le
 * propose, pour une plante.
 */
function GrimoireSheet({ entry, onClose }: { entry: GrimoireEntry; onClose: () => void }) {
  const insets = useSafeAreaInsets()

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 bg-forest/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <View className="max-h-[92%] rounded-t-3xl bg-card" accessibilityViewIsModal>
        <View className="mb-2 mt-3 h-1.5 w-11 self-center rounded-full bg-sand-dark" />
        <ScrollView contentContainerClassName="gap-4 px-4 pb-5 pt-2" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center gap-3.5">
            <SecretEmblem size={60} />
            <View className="flex-1 gap-1.5">
              <EvidenceBadge evidence={entry.evidence} tone="sun" />
              <Text
                className="font-poppins-bold text-forest"
                style={{ fontSize: 22, lineHeight: 27 }}
                accessibilityRole="header"
              >
                {entry.title}
              </Text>
            </View>
          </View>

          {entry.planche ? (
            <SecretPlanche planche={entry.planche} story={entry.story} />
          ) : (
            <SecretRecipe
              story={entry.story}
              ingredients={entry.ingredients}
              recipe={entry.recipe}
              cautions={entry.cautions}
            />
          )}
        </ScrollView>
        <View
          className="border-t border-sand-dark bg-card px-4 pt-3.5"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          <Button label="Fermer" variant="outline" font="poppins" onPress={onClose} />
        </View>
      </View>
    </Modal>
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

        {/* L'emblème des secrets, en tête du recueil qui les rassemble. */}
        <SecretEmblem size={52} />
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
          contentContainerClassName="gap-4 px-4 pb-8 pt-2"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
          }
          ListHeaderComponent={
            data && data.total > 0 ? (
              <View className="mb-2 gap-3 overflow-hidden rounded-3xl bg-forest p-5">
                <View className="flex-row flex-wrap items-baseline gap-x-2">
                  <Text className="font-poppins-bold text-white" style={{ fontSize: 36, lineHeight: 40 }}>
                    {data.discovered}
                  </Text>
                  <Text className="font-poppins-bold text-section text-lime">/ {data.total}</Text>
                  <Text className="font-poppins text-body text-white">
                    secret{data.discovered > 1 ? 's' : ''} découvert{data.discovered > 1 ? 's' : ''}
                  </Text>
                </View>
                <View
                  className="h-3.5 overflow-hidden rounded-full border-2 border-lime/40 bg-forest-light/40"
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: data.total, now: data.discovered }}
                >
                  <View
                    className="h-full rounded-full bg-lime"
                    style={{ width: `${Math.max(progress * 100, data.discovered > 0 ? 4 : 0)}%` }}
                  />
                </View>
                <Text className="font-raleway text-secondary text-sand">
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
