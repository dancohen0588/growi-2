import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  CalendarCheck,
  ChevronLeft,
  Droplet,
  Gift,
  ImageIcon,
  Leaf,
  Lightbulb,
  Check,
  Lock,
  MessageCircle,
  Trophy,
  Users,
} from 'lucide-react-native'
import {
  SAP_HOME_THEMES,
  SAP_HOME_THEME_LABELS,
  SAP_KINDS,
  SAP_RULES,
  SAP_RULE_DISPLAY,
  SAP_THEME_RINGS,
  formatSapAmount,
  sapEntryLabel,
  sapRingName,
  sapRingThreshold,
  sapRingsLabel,
  sapRingsLine,
  sapRewardPendingLine,
  sapRewardUnlockedLine,
  sapRingOrdinal,
  type SapEntry,
  type SapHomeTheme,
  type SapReward,
  type SapKind,
  type SapRuleGroup,
  type SapSummary,
} from '@growi/shared'

import { HomeThemeLayer } from '@/components/sap/HomeThemeLayer'
import { SapDrop } from '@/components/sap/SapDrop'
import { SapProgressBar } from '@/components/sap/SapProgressBar'
import { TrunkRings } from '@/components/sap/TrunkRings'
import { Button } from '@/components/ui/Button'
import { CARD_SHADOW } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, Pulse, Skeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useSapHistory, useSapSummary, useSetHomeTheme } from '@/lib/queries/sap'

const FOREST = '#1E5631'
const MUTED = 'hsl(139 20% 40%)'
const MUTED_ON_DARK = '#E6F0DA'

/** Les cernes à venir qu'on laisse voir au-delà de celui qui se forme. */
const UPCOMING_RINGS = 1

/**
 * « Ta sève » — la coupe du tronc, les cernes, le barème et l'historique.
 *
 * L'écran ne compare à personne : pas de classement, pas de « meilleurs
 * jardiniers », et le bloc forest le dit en clair. Chaque cerne dit ce qu'il a
 * débloqué — un Secret en avant-première, un thème d'Accueil — ou ce qu'il
 * débloquera ; les thèmes acquis se choisissent plus bas.
 */
export default function SeveScreen() {
  const router = useRouter()
  const summary = useSapSummary()
  const history = useSapHistory()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([summary.refetch(), history.refetch()])
    } finally {
      setRefreshing(false)
    }
  }, [summary, history])

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
          <ChevronLeft size={26} color={FOREST} />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-screen text-forest" accessibilityRole="header">
          Ta sève
        </Text>
      </View>

      {summary.isPending ? (
        <SeveSkeleton />
      ) : summary.isError ? (
        <ErrorState message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-7 px-4 pb-10 pt-2"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
          }
        >
          <TrunkBlock summary={summary.data} />
          <RingsList summary={summary.data} />
          <ThemePicker summary={summary.data} />
          <RulesSection />
          <HistorySection history={history} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ─── La coupe ──────────────────────────────────────────────────────────────

function TrunkBlock({ summary }: { summary: SapSummary }) {
  const { total, rings } = summary

  return (
    <View className="items-center gap-4 rounded-3xl bg-forest px-5 pb-5 pt-6">
      <TrunkRings count={rings.count} progress={rings.progress} size={220} halo label={sapRingsLabel(rings)} />

      <View className="items-center gap-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="font-poppins-bold text-sand" style={{ fontSize: 44, lineHeight: 50 }}>
            {total}
          </Text>
          <Text className="font-raleway-medium text-body" style={{ color: MUTED_ON_DARK }}>
            de sève
          </Text>
        </View>
        <Text className="font-raleway-semibold text-secondary text-lime">{sapRingsLine(rings)}</Text>
      </View>

      <View className="w-full gap-1.5">
        <SapProgressBar progress={rings.progress} onDark />
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-raleway text-caption" style={{ color: MUTED_ON_DARK }}>
            {rings.floor}
          </Text>
          <Text className="flex-1 text-center font-raleway text-caption" style={{ color: MUTED_ON_DARK }}>
            <Text className="font-raleway-bold text-sand">encore {rings.remaining}</Text> pour le{' '}
            {sapRingName(rings.count + 1).toLowerCase()}
          </Text>
          <Text className="font-raleway text-caption" style={{ color: MUTED_ON_DARK }}>
            {rings.next}
          </Text>
        </View>
      </View>

      <View className="w-full flex-row items-start gap-2.5 rounded-xl bg-forest-light/60 p-3">
        <Lock size={18} color="#B4DD7F" />
        <Text className="flex-1 font-raleway text-secondary" style={{ color: MUTED_ON_DARK }}>
          Ta sève n’est visible que par toi. Pas de classement : seulement ton jardin qui grandit.
        </Text>
      </View>
    </View>
  )
}

// ─── Les cernes ────────────────────────────────────────────────────────────

type RingState = 'formed' | 'forming' | 'upcoming'

function RingsList({ summary }: { summary: SapSummary }) {
  const { rings } = summary
  // Un serveur antérieur à la phase 6 ne rend pas de récompenses.
  const rewards = new Map((summary.rewards ?? []).map((reward) => [reward.ring, reward]))
  const shown = rings.count + 1 + UPCOMING_RINGS
  const items = Array.from({ length: shown }, (_, index) => {
    const n = index + 1
    const state: RingState = n <= rings.count ? 'formed' : n === rings.count + 1 ? 'forming' : 'upcoming'
    return { n, state, threshold: sapRingThreshold(n), reward: rewards.get(n) }
  })

  return (
    <View className="gap-3">
      <Text className="font-poppins text-section text-forest" accessibilityRole="header">
        Tes cernes
      </Text>
      <View className="gap-2">
        {items.map((item) => (
          <RingRow key={item.n} {...item} remaining={rings.remaining} />
        ))}
      </View>
    </View>
  )
}

function RingRow({
  n,
  state,
  threshold,
  remaining,
  reward,
}: {
  n: number
  state: RingState
  threshold: number
  remaining: number
  reward: SapReward | undefined
}) {
  const router = useRouter()
  const progress =
    state === 'formed' ? 'Formé' : state === 'forming' ? `Encore ${remaining} de sève` : 'À venir'
  const rewardLine =
    state === 'formed' ? (reward ? sapRewardUnlockedLine(reward) : null) : sapRewardPendingLine(n)
  // Un secret offert se lit au grimoire : la ligne y mène.
  const opensGrimoire = state === 'formed' && reward?.kind === 'secret' && Boolean(reward.value)

  const content = (
    <>
      <View
        className={[
          'h-9 w-9 items-center justify-center rounded-full',
          state === 'formed' ? 'bg-forest' : state === 'forming' ? 'bg-sun' : 'bg-sand-dark',
        ].join(' ')}
      >
        {state === 'upcoming' ? (
          <Lock size={16} color={MUTED} />
        ) : (
          <Text className={`font-poppins-bold text-secondary ${state === 'formed' ? 'text-lime' : 'text-forest'}`}>
            {n}
          </Text>
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-raleway-semibold text-body text-forest">
          {sapRingName(n)} · {threshold}
        </Text>
        <Text className="font-raleway text-caption text-muted-foreground">
          {rewardLine ? `${progress} · ${rewardLine}` : progress}
        </Text>
      </View>
      {state === 'forming' ? (
        <View className="rounded-full bg-sun px-2.5 py-1">
          <Text className="font-raleway-bold text-caption text-forest">En cours</Text>
        </View>
      ) : null}
    </>
  )

  const className = [
    'flex-row items-center gap-3 rounded-xl px-3.5 py-3',
    state === 'forming' ? 'border-2 border-forest bg-card' : 'bg-card',
    state === 'upcoming' ? 'opacity-70' : '',
  ].join(' ')
  const label = `${sapRingName(n)}, à ${threshold} de sève : ${progress}${rewardLine ? `. ${rewardLine}` : ''}`

  if (opensGrimoire) {
    return (
      <Pressable
        onPress={() => router.push('/(tabs)/accueil/grimoire')}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Ouvrir le grimoire`}
        className={className}
        style={({ pressed }) => [CARD_SHADOW, pressed ? { transform: [{ scale: 0.98 }] } : null]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      accessible
      accessibilityLabel={label}
      className={className}
      style={state === 'forming' ? undefined : CARD_SHADOW}
    >
      {content}
    </View>
  )
}

// ─── Les thèmes d'Accueil ──────────────────────────────────────────────────

type ThemeChoice = SapHomeTheme | null

/**
 * Le classique et les trois thèmes, chacun avec sa vignette. Un thème pas
 * encore débloqué reste visible — on voit ce qu'on vise — mais grisé, avec le
 * cerne qui l'apporte.
 */
function ThemePicker({ summary }: { summary: SapSummary }) {
  const toast = useToast()
  const setTheme = useSetHomeTheme()
  const unlocked = new Set(
    (summary.rewards ?? []).flatMap((reward) => (reward.kind === 'theme' && reward.value ? [reward.value] : [])),
  )
  const current: ThemeChoice = summary.homeTheme ?? null
  const choices: ThemeChoice[] = [null, ...SAP_HOME_THEMES]

  const choose = (theme: ThemeChoice) => {
    if (theme === current) return
    setTheme.mutate(theme, {
      onSuccess: () => toast(theme ? `Ton Accueil passe en « ${SAP_HOME_THEME_LABELS[theme]} »` : 'Retour à l’Accueil classique'),
      onError: (error) => toast(errorMessage(error), 'error'),
    })
  }

  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="font-poppins text-section text-forest" accessibilityRole="header">
          Ton thème d’Accueil
        </Text>
        <Text className="font-raleway text-secondary text-muted-foreground">
          Il habille le haut de ton Accueil. Les cernes en débloquent de nouveaux.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2.5">
        {choices.map((theme) => {
          const open = theme === null || unlocked.has(theme)
          const selected = theme === current
          const name = theme ? SAP_HOME_THEME_LABELS[theme] : 'Classique'
          const hint = open ? (selected ? 'Choisi' : 'Disponible') : `Au ${sapRingOrdinal(SAP_THEME_RINGS[theme!])} cerne`
          return (
            <Pressable
              key={theme ?? 'classique'}
              onPress={() => choose(theme)}
              disabled={!open}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !open }}
              accessibilityLabel={`${name} : ${hint}`}
              className={[
                'overflow-hidden rounded-xl bg-card',
                selected ? 'border-2 border-forest' : 'border-2 border-transparent',
                open ? '' : 'opacity-60',
              ].join(' ')}
              style={({ pressed }) => [{ width: '48%' }, CARD_SHADOW, pressed ? { transform: [{ scale: 0.98 }] } : null]}
            >
              <View className="h-[72px] bg-forest">
                {theme ? <HomeThemeLayer theme={theme} id={`picker-${theme}`} /> : null}
                {!open ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <Lock size={20} color="#F9F7E8" />
                  </View>
                ) : null}
              </View>
              <View className="flex-row items-center gap-2 px-3 py-2">
                <View className="flex-1">
                  <Text className="font-raleway-semibold text-secondary text-forest">{name}</Text>
                  <Text className="font-raleway text-caption text-muted-foreground">{hint}</Text>
                </View>
                {selected ? <Check size={18} color={FOREST} /> : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Le barème ─────────────────────────────────────────────────────────────

function RuleIcon({ kind }: { kind: SapKind }) {
  switch (kind) {
    case 'care':
      return <Droplet size={20} color={FOREST} />
    case 'task_on_time':
      return <CalendarCheck size={20} color={FOREST} />
    case 'plant_added':
      return <Leaf size={20} color={FOREST} />
    case 'secret_feedback':
      return <Lightbulb size={20} color={FOREST} />
    case 'post':
      return <ImageIcon size={20} color={FOREST} />
    case 'comment':
      return <MessageCircle size={20} color={FOREST} />
    case 'listing_done':
      return <Gift size={20} color={FOREST} />
    case 'gift_received':
      return <SapDrop size={20} veins={false} />
    case 'challenge_participation':
      return <Users size={20} color={FOREST} />
    case 'challenge_success':
      return <Trophy size={20} color={FOREST} />
  }
}

const GROUPS: { group: SapRuleGroup; title: string }[] = [
  { group: 'jardin', title: 'Au jardin' },
  { group: 'partage', title: 'En partageant' },
]

/** Le barème, tiré de `SAP_RULES` : l'écran ne peut pas promettre plus que le serveur. */
function RulesSection() {
  return (
    <View className="gap-3">
      <Text className="font-poppins text-section text-forest" accessibilityRole="header">
        Faire monter ta sève
      </Text>
      <View className="gap-4 rounded-2xl bg-card p-4" style={CARD_SHADOW}>
        {GROUPS.map(({ group, title }) => (
          <View key={group} className="gap-3">
            <Text className="font-raleway-bold text-caption uppercase tracking-widest text-muted-foreground">
              {title}
            </Text>
            {SAP_KINDS.filter((kind) => SAP_RULE_DISPLAY[kind].group === group).map((kind) => {
              const rule = SAP_RULE_DISPLAY[kind]
              const amount = SAP_RULES[kind].amount
              return (
                <View
                  key={kind}
                  accessible
                  accessibilityLabel={`${rule.title} : ${amount} de sève${rule.hint ? `. ${rule.hint}` : ''}`}
                  className="flex-row items-center gap-3"
                >
                  <RuleIcon kind={kind} />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-raleway-semibold text-secondary text-forest">{rule.title}</Text>
                    {rule.hint ? (
                      <Text className="font-raleway text-caption text-muted-foreground">{rule.hint}</Text>
                    ) : null}
                  </View>
                  <View className="min-w-[44px] items-center rounded-full bg-lime/40 px-2.5 py-1">
                    <Text className="font-poppins-bold text-secondary text-forest">
                      {formatSapAmount(amount)}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── L'historique ──────────────────────────────────────────────────────────

function HistorySection({ history }: { history: ReturnType<typeof useSapHistory> }) {
  const entries: SapEntry[] = history.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <View className="gap-3">
      <Text className="font-poppins text-section text-forest" accessibilityRole="header">
        Dernières gouttes
      </Text>

      {history.isPending ? (
        <Pulse style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </Pulse>
      ) : history.isError ? (
        <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />
      ) : entries.length === 0 ? (
        <View className="items-center gap-2 rounded-2xl bg-card p-5">
          <SapDrop size={32} />
          <Text className="text-center font-raleway text-secondary text-muted-foreground">
            Tes premières gouttes viendront avec ton prochain geste — un arrosage noté suffit 🌱
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {entries.map((entry) => (
            <View
              key={entry.id}
              accessible
              className="flex-row items-center gap-3 rounded-xl bg-card px-3.5 py-3"
            >
              <View className="min-w-[44px] items-center rounded-full bg-lime/40 px-2 py-1">
                <Text className="font-poppins-bold text-secondary text-forest">
                  {formatSapAmount(entry.amount)}
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-raleway-semibold text-secondary text-forest" numberOfLines={2}>
                  {sapEntryLabel(entry)}
                </Text>
                <Text className="font-raleway text-caption text-muted-foreground">
                  {capitalize(formatLogDate(entry.createdAt))}
                </Text>
              </View>
            </View>
          ))}

          {history.hasNextPage ? (
            <Button
              label="Voir les gouttes plus anciennes"
              variant="ghost"
              loading={history.isFetchingNextPage}
              onPress={() => void history.fetchNextPage()}
            />
          ) : null}
        </View>
      )}
    </View>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function SeveSkeleton() {
  return (
    <View className="gap-6 px-4 pt-2" accessibilityLabel="Chargement de ta sève">
      <Pulse style={{ gap: 12 }}>
        <View className="h-[380px] w-full rounded-3xl bg-sand-dark" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </Pulse>
    </View>
  )
}
