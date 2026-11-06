import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import type { SapSummary } from '@growi/shared'

import { CARD_SHADOW } from '@/components/ui/Card'
import { Pulse, Skeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { useCommunityHome } from '@/lib/queries/community'
import { useSapSummary } from '@/lib/queries/sap'
import { entryLabel, formatSapAmount, formingLine, ringsLabel } from '@/lib/sap'

import { SapDrop } from './SapDrop'
import { SapProgressBar } from './SapProgressBar'
import { TrunkRings } from './TrunkRings'

/**
 * « Ta sève » sur l'Accueil : la coupe du tronc en vignette, le total, le
 * cerne qui se forme, le dernier gain, et les gouttes qu'il reste à offrir.
 *
 * Toute la carte mène à l'écran « Ta sève », sauf la ligne des gouttes, qui
 * mène à la Communauté : c'est là qu'on trouve à qui les offrir.
 *
 * En erreur, la carte se tait plutôt que d'afficher une panne : la sève est
 * un agrément de l'Accueil, pas ce pour quoi on l'ouvre.
 */
export function SapCard() {
  const router = useRouter()
  const summary = useSapSummary()

  if (summary.isError) return null

  const openSeve = () => router.push('/(tabs)/accueil/seve')

  return (
    <View className="gap-3 px-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-poppins text-section text-forest">Ta sève</Text>
        <Pressable
          onPress={openSeve}
          hitSlop={10}
          accessibilityRole="button"
          className="min-h-[44px] flex-row items-center justify-center gap-1"
        >
          <Text className="font-raleway-semibold text-secondary text-forest-light">Voir tes cernes</Text>
          <ChevronRight size={16} color="#2d7a47" />
        </Pressable>
      </View>

      {summary.data ? <SapCardBody summary={summary.data} onOpen={openSeve} /> : <SapCardSkeleton />}
    </View>
  )
}

function SapCardBody({ summary, onOpen }: { summary: SapSummary; onOpen: () => void }) {
  const { total, rings, recent } = summary
  const last = recent[0]

  return (
    <View className="gap-3.5 rounded-2xl bg-card p-4" style={CARD_SHADOW}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Ta sève : ${total}. ${formingLine(rings)}. Ouvrir`}
        className="flex-row items-center gap-3.5"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <TrunkRings count={rings.count} progress={rings.progress} size={68} label={ringsLabel(rings)} />
        <View className="min-w-0 flex-1 gap-1.5">
          <View className="flex-row items-baseline gap-1.5">
            <Text className="font-poppins-bold text-forest" style={{ fontSize: 26, lineHeight: 30 }}>
              {total}
            </Text>
            <Text className="font-raleway-medium text-secondary text-muted-foreground">de sève</Text>
          </View>
          <Text className="font-raleway-medium text-caption text-muted-foreground" numberOfLines={1}>
            {formingLine(rings)}
          </Text>
          <SapProgressBar progress={rings.progress} />
        </View>
      </Pressable>

      <View className="h-px bg-sand-dark" />

      {last ? (
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-lime/30">
            <SapDrop size={18} />
          </View>
          <Text className="flex-1 font-raleway text-secondary text-forest" numberOfLines={2}>
            <Text className="font-raleway-bold">
              {formatSapAmount(last.amount)} {formatLogDate(last.createdAt)}.
            </Text>{' '}
            {entryLabel(last)}
          </Text>
        </View>
      ) : (
        <Text className="font-raleway text-secondary text-muted-foreground">
          Chaque geste noté fait monter ta sève — le premier arrosage suffit 🌱
        </Text>
      )}

      <GiftsRow giftsLeft={summary.giftsLeft} giftsPerWeek={summary.giftsPerWeek} />
    </View>
  )
}

/** Les gouttes de la semaine, pleines celles qui restent, vides celles offertes. */
export function GiftDrops({ left, perWeek, size = 18 }: { left: number; perWeek: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5" accessible={false}>
      {Array.from({ length: perWeek }, (_, index) => (
        <SapDrop key={index} size={size} empty={index >= left} veins={false} />
      ))}
    </View>
  )
}

function GiftsRow({ giftsLeft, giftsPerWeek }: { giftsLeft: number; giftsPerWeek: number }) {
  const router = useRouter()
  const community = useCommunityHome()
  const enabled = community.data?.enabled ?? true

  const title =
    giftsLeft === 0
      ? 'Tes gouttes de la semaine sont offertes'
      : `${giftsLeft} goutte${giftsLeft > 1 ? 's' : ''} à offrir cette semaine`
  const hint =
    giftsLeft === 0
      ? 'Elles reviennent lundi.'
      : enabled
        ? 'Remercie un voisin pour un conseil ou une bouture'
        : 'Active ton profil public pour remercier tes voisins'

  return (
    <Pressable
      // `navigate` sélectionne l'onglet Communauté au lieu d'empiler son
      // écran dans la pile Accueil.
      onPress={() => router.navigate('/(tabs)/communaute')}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      className="flex-row items-center gap-3 rounded-xl border border-sand-dark bg-sand px-3.5 py-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
    >
      <GiftDrops left={giftsLeft} perWeek={giftsPerWeek} />
      <View className="flex-1 gap-0.5">
        <Text className="font-raleway-semibold text-secondary text-forest">{title}</Text>
        <Text className="font-raleway text-caption text-muted-foreground">{hint}</Text>
      </View>
      <ChevronRight size={18} color="#1E5631" />
    </Pressable>
  )
}

function SapCardSkeleton() {
  return (
    <View className="rounded-2xl bg-card p-4" accessibilityLabel="Chargement de ta sève">
      <Pulse style={{ gap: 14 }}>
        <View className="flex-row items-center gap-3.5">
          <View className="h-[68px] w-[68px] rounded-full bg-sand-dark" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </View>
        </View>
        <Skeleton className="h-12 w-full" />
      </Pulse>
    </View>
  )
}
