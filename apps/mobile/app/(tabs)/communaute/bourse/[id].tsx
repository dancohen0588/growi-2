import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native'
import type { Listing, ListingThread } from '@growi/shared'
import {
  LISTING_CATEGORY_LABELS,
  LISTING_KIND_LABELS,
  LISTING_STATUS_LABELS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import {
  useDeleteListing,
  useExpressInterest,
  useListing,
  useListingThreads,
  useReport,
  useUpdateListing,
} from '@/lib/queries/community'

/**
 * Écran 5 — le détail d'une annonce.
 *
 * Deux écrans en un, selon qui regarde : l'auteur y gère le statut et voit ses
 * intéressés ; les autres y trouvent le bouton « Je suis intéressé ».
 */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4 py-2">
      <Text className="font-raleway text-secondary text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right font-raleway-medium text-secondary text-forest">
        {value}
      </Text>
    </View>
  )
}

/** La liste des intéressés, sous l'annonce de son auteur. */
function Interested({ listingId }: { listingId: string }) {
  const router = useRouter()
  const threads = useListingThreads(listingId)

  if (!threads.data || threads.data.length === 0) return null

  return (
    <View className="gap-2">
      <Text className="font-poppins text-section text-forest">
        {threads.data.length} intéressé{threads.data.length > 1 ? 's' : ''}
      </Text>

      {threads.data.map((thread: ListingThread) => (
        <Pressable
          key={thread.id}
          onPress={() => router.push(`/(tabs)/communaute/messages/${thread.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Discussion avec ${thread.other.handle}`}
          className="flex-row items-center gap-3 rounded-xl bg-card p-3"
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
        >
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">
              {thread.other.handle}
            </Text>
            {thread.lastMessage ? (
              <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
                {thread.lastMessage}
              </Text>
            ) : null}
          </View>
          {thread.unread ? <View className="h-2 w-2 rounded-full bg-destructive" /> : null}
          <ChevronRight size={18} color="hsl(139 20% 40%)" />
        </Pressable>
      ))}
    </View>
  )
}

function ListingContent({ listing }: { listing: Listing }) {
  const router = useRouter()
  const toast = useToast()
  const { width } = useWindowDimensions()

  const interest = useExpressInterest(listing.id)
  const update = useUpdateListing(listing.id)
  const remove = useDeleteListing()
  const report = useReport()

  const expired = listing.status === 'expired'
  const closed = listing.status === 'done' || listing.status === 'hidden'

  const setStatus = (status: 'active' | 'reserved' | 'done', confirmation: string) => {
    update.mutate(
      { status },
      {
        onSuccess: () => toast(confirmation),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const openInterest = async () => {
    try {
      const thread = await interest.mutateAsync()
      router.push(`/(tabs)/communaute/messages/${thread.id}`)
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const confirmDelete = () => {
    Alert.alert('Supprimer cette annonce ?', 'Tes discussions en cours resteront lisibles.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(listing.id)
            toast('Annonce supprimée')
            router.back()
          } catch (error) {
            toast(errorMessage(error), 'error')
          }
        },
      },
    ])
  }

  const openReport = () => {
    Alert.alert('Signaler cette annonce', 'Pour quelle raison ?', [
      ...REPORT_REASONS.map((reason) => ({
        text: REPORT_REASON_LABELS[reason],
        onPress: () =>
          report.mutate(
            { targetType: 'listing', targetId: listing.id, reason },
            {
              onSuccess: () => toast('Merci — nous allons vérifier.'),
              onError: (error) => toast(errorMessage(error), 'error'),
            },
          ),
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ])
  }

  return (
    <ScrollView contentContainerClassName="pb-8 gap-4">
      {listing.photoUrl ? (
        <View className="bg-sand-dark" style={{ width, height: width * 0.6 }}>
          <Image
            source={listing.photoUrl}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      <View className="gap-3 px-4">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg bg-lime px-2 py-1">
            <Text className="font-raleway-medium text-caption text-forest">
              {LISTING_KIND_LABELS[listing.kind]}
            </Text>
          </View>
          {listing.status !== 'active' ? (
            <View className="rounded-lg bg-sand-dark px-2 py-1">
              <Text className="font-raleway-medium text-caption text-muted-foreground">
                {LISTING_STATUS_LABELS[listing.status]}
              </Text>
            </View>
          ) : null}
        </View>

        <Text className="font-poppins-bold text-screen text-forest">{listing.title}</Text>

        {listing.description ? (
          <Text className="font-raleway text-body text-forest">{listing.description}</Text>
        ) : null}

        <View className="rounded-xl bg-card px-4 py-1">
          <Field label="Catégorie" value={LISTING_CATEGORY_LABELS[listing.category]} />
          {listing.quantity ? <Field label="Quantité" value={listing.quantity} /> : null}
          {listing.wants ? <Field label="En échange de" value={listing.wants} /> : null}
          <Field label="Publiée" value={formatLogDate(listing.createdAt)} />
        </View>

        {/* L'auteur, tapable vers son profil — sauf s'il s'agit de soi. */}
        <Pressable
          onPress={() =>
            router.push(`/(tabs)/communaute/u/${listing.author.handle}`)
          }
          disabled={listing.isMine}
          accessibilityRole={listing.isMine ? undefined : 'button'}
          className="flex-row items-center gap-3 rounded-xl bg-card p-4"
          style={({ pressed }) => (pressed && !listing.isMine ? { opacity: 0.8 } : null)}
        >
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">
              {listing.isMine ? 'Ton annonce' : listing.author.handle}
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              {[listing.author.city, listing.author.distanceLabel].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {!listing.isMine ? <ChevronRight size={18} color="hsl(139 20% 40%)" /> : null}
        </Pressable>

        {listing.isMine ? (
          <View className="gap-3">
            <Interested listingId={listing.id} />

            {/* Le cycle de vie, dans l'ordre où il se parcourt. */}
            <View className="gap-2">
              {listing.status === 'active' ? (
                <Button
                  label="Marquer comme réservée"
                  variant="outline"
                  loading={update.isPending}
                  onPress={() => setStatus('reserved', 'Annonce réservée')}
                />
              ) : null}
              {listing.status === 'reserved' ? (
                <>
                  <Button
                    label="Marquer comme terminée"
                    loading={update.isPending}
                    onPress={() => setStatus('done', 'Échange terminé 🌱')}
                  />
                  <Button
                    label="Remettre en ligne"
                    variant="outline"
                    loading={update.isPending}
                    onPress={() => setStatus('active', 'Annonce remise en ligne')}
                  />
                </>
              ) : null}
              {expired ? (
                <Button
                  label="Prolonger de 60 jours"
                  loading={update.isPending}
                  onPress={() =>
                    update.mutate(
                      { extend: true },
                      {
                        onSuccess: () => toast('Annonce prolongée'),
                        onError: (error) => toast(errorMessage(error), 'error'),
                      },
                    )
                  }
                />
              ) : null}

              <Pressable onPress={confirmDelete} hitSlop={8} className="self-start py-2">
                <Text className="font-raleway text-caption text-destructive underline">
                  Supprimer cette annonce
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            {closed || expired ? (
              <View className="rounded-xl bg-card p-4">
                <Text className="font-raleway text-secondary text-muted-foreground">
                  Cette annonce n’est plus disponible.
                </Text>
              </View>
            ) : null}

            <Button
              label={
                listing.myThreadId
                  ? 'Reprendre la discussion'
                  : listing.status === 'reserved'
                    ? 'Annonce réservée'
                    : 'Je suis intéressé'
              }
              size="lg"
              loading={interest.isPending}
              disabled={!listing.myThreadId && listing.status !== 'active'}
              onPress={() =>
                listing.myThreadId
                  ? router.push(`/(tabs)/communaute/messages/${listing.myThreadId}`)
                  : void openInterest()
              }
            />

            <Pressable onPress={openReport} hitSlop={8} className="self-center py-2">
              <Text className="font-raleway text-caption text-muted-foreground underline">
                Signaler cette annonce
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default function AnnonceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const listing = useListing(id ?? '')

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
        <Text className="flex-1 font-poppins-bold text-screen text-forest">Annonce</Text>
        <MoreHorizontal size={24} color="transparent" />
      </View>

      {listing.isPending ? (
        <View className="px-4">
          <ListSkeleton count={3} />
        </View>
      ) : listing.isError ? (
        <ErrorState message={errorMessage(listing.error)} onRetry={() => void listing.refetch()} />
      ) : (
        <ListingContent listing={listing.data} />
      )}
    </SafeAreaView>
  )
}
