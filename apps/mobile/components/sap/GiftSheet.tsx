import { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { isApiError } from '@growi/api-client'
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg'
import {
  SAP_GIFT_MESSAGE_MAX_LENGTH,
  SAP_GIFT_REASON_LABELS,
  SAP_GIFT_REASONS,
  SAP_GIFTS_PER_WEEK,
  type SapGiftReason,
  type SapSummary,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OptionGroup } from '@/components/ui/OptionGroup'
import { errorMessage } from '@/lib/errors'
import { sapKeys } from '@/lib/queries/keys'
import { useGiveSapDrop, useSapSummary } from '@/lib/queries/sap'
import { queryClient } from '@/lib/query-client'
import { useSession } from '@/store/session'

import { GiftDrops } from './SapCard'
import { SapDrop } from './SapDrop'

const FOREST = '#1E5631'
const LIME = '#B4DD7F'
const SUN = '#F6C445'

/** À qui l'on offre, et d'où. */
export interface GiftTarget {
  handle: string
  avatarUrl?: string | null
  /** La publication ouverte, pour que la notification y mène. */
  postId?: string
}

const REASON_OPTIONS = SAP_GIFT_REASONS.map((value) => ({ value, label: SAP_GIFT_REASON_LABELS[value] }))

/** Ce qu'on lui propose d'écrire, d'après le motif choisi. */
const PLACEHOLDERS: Record<SapGiftReason, string> = {
  conseil: 'Merci pour ton conseil !',
  bouture: 'Merci pour la bouture !',
  jardin: 'Ton jardin donne envie !',
  aide: 'Merci pour le coup de main !',
}

function giftsLeftLine(left: number): string {
  if (left === 0) return 'Tu as offert tes gouttes de la semaine — elles reviennent lundi.'
  return `Il te reste ${left} goutte${left > 1 ? 's' : ''} à offrir cette semaine`
}

/** Un refus du serveur, dit pour ce geste-ci. */
function giftErrorMessage(error: unknown): string {
  if (isApiError(error) && error.isNotFound) return 'Ce jardinier n’est plus joignable.'
  return errorMessage(error)
}

function Avatar({ target, size }: { target: GiftTarget; size: number }) {
  if (target.avatarUrl) {
    return (
      <Image
        source={target.avatarUrl}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    )
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-lime"
      style={{ width: size, height: size }}
    >
      <Text className="font-poppins-bold text-section text-forest">
        {target.handle.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

/** La goutte qui part de toi vers lui — l'écran « envoyée ». */
function SentArt({ from, to }: { from: string; to: string }) {
  return (
    <Svg width={220} height={120} viewBox="0 0 220 120" accessible={false}>
      <Path d="M40 80 C 80 20, 140 20, 180 70" fill="none" stroke={FOREST} strokeWidth={3} strokeDasharray="4 8" strokeLinecap="round" />
      <Circle cx={34} cy={88} r={22} fill={SUN} stroke={FOREST} strokeWidth={3.5} />
      <SvgText x={34} y={95} textAnchor="middle" fontFamily="Poppins_700Bold" fontSize={20} fill={FOREST}>
        {from}
      </SvgText>
      <Circle cx={186} cy={84} r={22} fill={LIME} stroke={FOREST} strokeWidth={3.5} />
      <SvgText x={186} y={91} textAnchor="middle" fontFamily="Poppins_700Bold" fontSize={20} fill={FOREST}>
        {to}
      </SvgText>
      <Path
        d="M110 12 C 100 30, 88 40, 88 54 a22 22 0 0 0 44 0 c0 -14 -12 -24 -22 -42 z"
        fill={LIME}
        stroke={FOREST}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path d="M110 48 v22 M110 60 l-8 -7 M110 55 l8 -7" fill="none" stroke={FOREST} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  )
}

interface GiftSheetProps {
  target: GiftTarget
  onClose: () => void
}

/**
 * « Offrir une goutte » — un merci à un voisin, en feuille montante.
 *
 * Offrir ne retire rien à la sève du donneur : la feuille le dit d'emblée,
 * sans quoi on hésiterait à remercier. Trois gouttes par semaine ; une fois
 * offertes, la feuille l'explique et le bouton se désactive plutôt que de
 * laisser le serveur refuser.
 */
function GiftSheet({ target, onClose }: GiftSheetProps) {
  const summary = useSapSummary()
  const give = useGiveSapDrop()
  const firstName = useSession((s) => s.user?.firstName)
  const email = useSession((s) => s.user?.email)

  const [reason, setReason] = useState<SapGiftReason>(target.postId ? 'jardin' : 'conseil')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ giftsLeft: number } | null>(null)

  const perWeek = summary.data?.giftsPerWeek ?? SAP_GIFTS_PER_WEEK
  const left = summary.data?.giftsLeft ?? perWeek

  const submit = () => {
    setError(null)
    give.mutate(
      { handle: target.handle, reason, message: message.trim() || null, postId: target.postId ?? null },
      {
        onSuccess: (result) => setSent(result),
        onError: (failure) => {
          // Les gouttes sont parties d'un autre appareil entre-temps : on
          // aligne le compteur sur ce que dit le serveur.
          if (isApiError(failure) && failure.status === 429) {
            queryClient.setQueryData<SapSummary>(sapKeys.summary(), (current) =>
              current ? { ...current, giftsLeft: 0 } : current,
            )
          }
          setError(giftErrorMessage(failure))
        },
      },
    )
  }

  if (sent) {
    return (
      <View className="items-center gap-4 rounded-t-3xl bg-card px-5 pb-10 pt-3" accessibilityLiveRegion="polite">
        <View className="h-1 w-11 rounded-full bg-sand-dark" />
        <SentArt
          from={(firstName || email || '?').trim().charAt(0).toUpperCase()}
          to={target.handle.charAt(0).toUpperCase()}
        />
        <Text className="text-center font-poppins-bold text-forest" style={{ fontSize: 22, lineHeight: 28 }}>
          Goutte envoyée à {target.handle}
        </Text>
        <Text className="text-center font-raleway text-body text-forest-light">
          {target.handle} verra ton merci « {SAP_GIFT_REASON_LABELS[reason].toLowerCase()} » dans ses
          notifications.{' '}
          {sent.giftsLeft > 0
            ? `Il te reste ${sent.giftsLeft} goutte${sent.giftsLeft > 1 ? 's' : ''} cette semaine.`
            : 'C’était ta dernière goutte de la semaine.'}
        </Text>
        <View className="w-full">
          <Button label="Fermer" variant="forest" size="lg" font="poppins-bold" raised onPress={onClose} />
        </View>
      </View>
    )
  }

  return (
    <View className="max-h-[90%] rounded-t-3xl bg-card pt-3">
      <View className="mb-3 h-1 w-11 self-center rounded-full bg-sand-dark" />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <View style={{ width: 52, height: 52 }}>
            <Avatar target={target} size={52} />
            <View className="absolute" style={{ right: -6, bottom: -4 }}>
              <SapDrop size={26} />
            </View>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-poppins-bold text-section text-forest" accessibilityRole="header">
              Offrir une goutte à {target.handle}
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              Un merci en plus : ta propre sève ne baisse pas.
            </Text>
          </View>
        </View>

        <OptionGroup label="Pour quoi ?" options={REASON_OPTIONS} value={reason} onChange={setReason} />

        <Input
          label="Un petit mot (facultatif)"
          placeholder={PLACEHOLDERS[reason]}
          value={message}
          onChangeText={setMessage}
          maxLength={SAP_GIFT_MESSAGE_MAX_LENGTH}
          returnKeyType="done"
        />

        <View className="flex-row items-center gap-2.5">
          <GiftDrops left={left} perWeek={perWeek} />
          <Text className="flex-1 font-raleway text-secondary text-muted-foreground">{giftsLeftLine(left)}</Text>
        </View>

        {error ? (
          <Text className="font-raleway text-secondary text-destructive" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <View className="gap-2.5">
          <Button
            label="Offrir une goutte"
            variant="forest"
            size="lg"
            font="poppins-bold"
            raised
            loading={give.isPending}
            disabled={left === 0 || give.isPending}
            onPress={submit}
          />
          <Button label="Annuler" variant="ghost" font="poppins" onPress={onClose} />
        </View>
      </ScrollView>
    </View>
  )
}

/**
 * La feuille et son état, pour l'écran qui la propose :
 *
 * ```tsx
 * const gift = useGiftSheet()
 * <Button onPress={() => gift.open({ handle, postId })} />
 * {gift.sheet}
 * ```
 */
export function useGiftSheet() {
  const [target, setTarget] = useState<GiftTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])

  const sheet = target ? (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 bg-forest/60" onPress={close} accessibilityLabel="Fermer" />
        <GiftSheet target={target} onClose={close} />
      </KeyboardAvoidingView>
    </Modal>
  ) : null

  return { open: setTarget, sheet }
}

/** Le bouton « Offrir une goutte », tel qu'il se pose sous une publication. */
export function GiftButton({ onPress, compact = false }: { onPress: () => void; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Offrir une goutte de sève"
      hitSlop={compact ? 4 : 0}
      className="h-11 flex-row items-center gap-1.5 rounded-full bg-lime/30 px-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.97 }] } : null)}
    >
      <SapDrop size={18} veins={false} />
      <Text className="font-raleway-bold text-secondary text-forest">
        {compact ? 'Offrir' : 'Offrir une goutte'}
      </Text>
    </Pressable>
  )
}
