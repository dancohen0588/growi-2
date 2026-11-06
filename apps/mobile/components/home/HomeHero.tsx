import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Droplets,
  Leaf,
  RotateCw,
  Sprout as SproutIcon,
} from 'lucide-react-native'
import { indicatorTone, type DashboardSummary, type HeroPhoto, type IndicatorTone } from '@growi/shared'

import { NotificationBell } from '@/components/community/NotificationBell'
import { GardenScene } from '@/components/home/illustrations'
import { HomeThemeLayer } from '@/components/sap/HomeThemeLayer'
import { SapPill } from '@/components/sap/SapPill'
import { useSapSummary } from '@/lib/queries/sap'
import { Button } from '@/components/ui/Button'
import { Pulse } from '@/components/ui/states'

/**
 * Le haut de l'accueil : une photo d'une plante de l'utilisateur sous un voile
 * forest, et le tableau de bord posé dessus.
 *
 * Trois cas, sans jamais d'écran blanc :
 * - une photo existe → elle remplit le bloc, tirée au sort par le serveur une
 *   fois par jour (`summary.heroPhoto`) ;
 * - des plantes mais aucune photo, ou une photo qui ne charge pas → le paysage
 *   illustré de `GardenScene` ;
 * - aucune plante → le paysage, et une invitation à ajouter la première à la
 *   place des compteurs, qui seraient tous à zéro.
 */

const SAND = '#F9F7E8'
const LIME = '#B4DD7F'
const MUTED_ON_DARK = '#E6F0DA'

export interface HomeHeroProps {
  title: string
  /** Date et météo du moment, sur une ligne. */
  subtitle: string
  summary: {
    data?: DashboardSummary
    isPending: boolean
    isError: boolean
    onRetry: () => void
  }
  onOpenProfile: () => void
  profileInitial: string
}

export function HomeHero({ title, subtitle, summary, onOpenProfile, profileInitial }: HomeHeroProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const photo = summary.data?.heroPhoto ?? null
  const showPhoto = photo !== null && photo.photoUrl !== failedUrl
  // Le thème qu'un cerne a débloqué, s'il y en a un de choisi.
  const homeTheme = useSapSummary().data?.homeTheme ?? null

  return (
    <View
      className="overflow-hidden rounded-b-[32px] bg-forest"
      style={{ paddingTop: insets.top + 12 }}
    >
      {showPhoto ? (
        <>
          <Image
            source={{ uri: photo.photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            onError={() => setFailedUrl(photo.photoUrl)}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Scrim />
        </>
      ) : null}

      {/* Par-dessus la photo et son voile, sous le texte. */}
      {homeTheme ? <HomeThemeLayer theme={homeTheme} /> : null}

      <View className="gap-4 px-4 pb-14">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="font-raleway-medium text-secondary" style={{ color: MUTED_ON_DARK }} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text className="font-poppins-bold text-screen text-sand" numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <SapPill />
            <NotificationBell onPhoto />
            <Pressable
              onPress={onOpenProfile}
              accessibilityRole="button"
              accessibilityLabel="Mon profil"
              className="h-11 w-11 items-center justify-center rounded-full bg-lime"
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : null)}
            >
              <Text className="font-poppins-bold text-body text-forest">{profileInitial}</Text>
            </Pressable>
          </View>
        </View>

        {showPhoto ? (
          <>
            <PhotoCaption photo={photo} />
            {/* Laisse respirer la photo entre l'en-tête et les compteurs. */}
            <View style={{ height: 112 }} />
          </>
        ) : (
          <View style={{ marginHorizontal: -16 }}>
            <GardenScene width={width} height={150} />
          </View>
        )}

        <HeroDashboard summary={summary} hasPhoto={showPhoto} />
      </View>
    </View>
  )
}

// ─── Voile ─────────────────────────────────────────────────────────────────

/**
 * Le voile forest qui rend le texte lisible sur n'importe quelle photo : léger
 * en haut pour laisser voir la plante, presque opaque là où sont les chiffres.
 */
function Scrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E5631" stopOpacity={0.6} />
          <Stop offset="0.3" stopColor="#1E5631" stopOpacity={0.35} />
          <Stop offset="0.6" stopColor="#1E5631" stopOpacity={0.88} />
          <Stop offset="1" stopColor="#1E5631" stopOpacity={0.97} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
  )
}

/** D'où vient la photo — et le chemin vers la fiche de la plante. */
function PhotoCaption({ photo }: { photo: HeroPhoto }) {
  const router = useRouter()
  const label = photo.gardenName ? `${photo.plantName} · ${photo.gardenName}` : photo.plantName

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/plantes/${photo.plantId}`)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Photo de ta plante ${label}. Ouvrir sa fiche`}
      className="max-w-full flex-row items-center gap-2 self-start rounded-full bg-sand/90 py-1 pl-1 pr-3"
    >
      <View className="h-6 w-6 items-center justify-center rounded-full bg-forest">
        <Camera size={12} color={LIME} />
      </View>
      <Text className="shrink font-raleway-semibold text-caption text-forest" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

// ─── Tableau de bord ───────────────────────────────────────────────────────

interface Indicator {
  key: string
  label: string
  value: number
  sub: string
  tone: IndicatorTone
  icon: (color: string) => React.ReactNode
  href: Href
  /** La seule tuile qui prend une couleur pleine : ce qu'il y a à faire tout de suite. */
  highlight: boolean
}

/** Les quatre indicateurs, dans l'ordre du tableau de bord web. */
function indicators(summary: DashboardSummary): Indicator[] {
  return [
    {
      key: 'plants',
      label: 'Plantes',
      value: summary.plants,
      sub: `dans ${summary.gardens} jardin${summary.gardens > 1 ? 's' : ''}`,
      tone: indicatorTone('plants', summary),
      icon: (color) => <Leaf size={16} color={color} />,
      href: '/(tabs)/plantes',
      highlight: false,
    },
    {
      key: 'tasks',
      label: 'Gestes du jour',
      value: summary.tasksToday,
      // L'arrosage passe devant le retard : c'est ce qui compose l'essentiel
      // du chiffre, et ce qui se règle d'un seul geste depuis le calendrier.
      sub:
        summary.plantsToWater > 0
          ? `dont ${summary.plantsToWater} arrosage${summary.plantsToWater > 1 ? 's' : ''}`
          : summary.tasksLate > 0
            ? `dont ${summary.tasksLate} en retard`
            : summary.tasksWeek > 0
              ? `${summary.tasksWeek} cette semaine`
              : 'rien ne presse',
      tone: indicatorTone('tasks', summary),
      icon: (color) => <CalendarDays size={16} color={color} />,
      href: '/(tabs)/calendrier',
      highlight: false,
    },
    {
      key: 'water',
      label: 'À arroser',
      value: summary.plantsToWater,
      sub: summary.plantsToWater > 0 ? "aujourd'hui" : 'tout est arrosé',
      tone: indicatorTone('water', summary),
      icon: (color) => <Droplets size={16} color={color} />,
      href: '/(tabs)/calendrier',
      highlight: summary.plantsToWater > 0,
    },
    {
      key: 'alerts',
      label: 'Alertes',
      value: summary.alerts,
      sub:
        summary.alertsHigh > 0
          ? `dont ${summary.alertsHigh} urgente${summary.alertsHigh > 1 ? 's' : ''}`
          : 'en cours',
      tone: indicatorTone('alerts', summary),
      icon: (color) => <AlertTriangle size={16} color={color} />,
      href: '/(tabs)/calendrier',
      highlight: false,
    },
  ]
}

/** La pastille qui porte la gravité sur une tuile sombre. */
const DOT: Record<IndicatorTone, string> = {
  neutral: 'bg-sand/40',
  good: 'bg-lime',
  warning: 'bg-sun',
  critical: 'bg-destructive',
}

function HeroDashboard({ summary, hasPhoto }: { summary: HomeHeroProps['summary']; hasPhoto: boolean }) {
  if (summary.isPending) return <DashboardSkeleton />

  if (summary.isError || !summary.data) {
    return (
      <View className="items-start gap-3 rounded-2xl bg-forest-light/85 p-4">
        <Text className="font-raleway text-secondary text-sand">
          Impossible de charger ton jardin — réessaie dans un instant.
        </Text>
        <Button
          label="Réessayer"
          variant="primary"
          icon={<RotateCw size={18} color="#1E5631" />}
          onPress={summary.onRetry}
        />
      </View>
    )
  }

  if (summary.data.plants === 0) return <EmptyGarden />

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full bg-lime" />
        <Text className="font-raleway-semibold text-caption uppercase tracking-widest text-lime">
          Ton jardin aujourd'hui
        </Text>
      </View>

      <View className="gap-2.5">
        {/* Deux par ligne : quatre colonnes seraient illisibles ici. */}
        {[0, 2].map((start) => (
          <View key={start} className="flex-row gap-2.5">
            {indicators(summary.data!)
              .slice(start, start + 2)
              .map((indicator) => (
                <HeroStat key={indicator.key} indicator={indicator} />
              ))}
          </View>
        ))}
      </View>

      {/* Des plantes, mais aucune photo : on dit comment voir la sienne ici. */}
      {!hasPhoto ? (
        <Text className="font-raleway text-caption" style={{ color: MUTED_ON_DARK }}>
          Prends tes plantes en photo : l'une d'elles habillera cet écran chaque jour.
        </Text>
      ) : null}
    </View>
  )
}

function HeroStat({ indicator }: { indicator: Indicator }) {
  const router = useRouter()
  const { highlight } = indicator
  const ink = highlight ? '#1E5631' : SAND

  return (
    <Pressable
      onPress={() => router.push(indicator.href)}
      accessibilityRole="button"
      accessibilityLabel={`${indicator.label} : ${indicator.value}, ${indicator.sub}`}
      className={[
        'min-h-[92px] flex-1 justify-between gap-2 rounded-xl p-3.5',
        highlight ? 'bg-sun' : 'border border-lime/25 bg-forest-light/85',
      ].join(' ')}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
    >
      <View className="flex-row items-center gap-2">
        {indicator.icon(highlight ? '#1E5631' : LIME)}
        <Text
          className={`flex-1 text-caption ${highlight ? 'font-raleway-semibold' : 'font-raleway-medium'}`}
          style={{ color: highlight ? '#1E5631' : MUTED_ON_DARK }}
          numberOfLines={1}
        >
          {indicator.label}
        </Text>
      </View>

      <View className="flex-row items-baseline gap-1.5">
        <Text className="font-poppins-bold" style={{ color: ink, fontSize: 30, lineHeight: 34 }}>
          {indicator.value}
        </Text>
        <View className="flex-1 flex-row items-center gap-1.5">
          {!highlight ? <View className={`h-2 w-2 rounded-full ${DOT[indicator.tone]}`} /> : null}
          <Text
            className="flex-1 font-raleway text-caption"
            style={{ color: highlight ? '#1E5631' : MUTED_ON_DARK }}
            numberOfLines={1}
          >
            {indicator.sub}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

function DashboardSkeleton() {
  return (
    <View accessibilityLabel="Chargement de ton jardin">
      <Pulse style={{ gap: 10 }}>
        {[0, 1].map((row) => (
          <View key={row} className="flex-row gap-2.5">
            <View className="h-[92px] flex-1 rounded-xl bg-forest-light/70" />
            <View className="h-[92px] flex-1 rounded-xl bg-forest-light/70" />
          </View>
        ))}
      </Pulse>
    </View>
  )
}

/** À la place des compteurs, tant que le jardin est vide. */
function EmptyGarden() {
  const router = useRouter()

  return (
    <View className="gap-3 rounded-2xl border border-lime/25 bg-forest-light/85 p-4">
      <View className="flex-row items-center gap-2">
        <SproutIcon size={18} color={LIME} />
        <Text className="font-poppins text-section text-sand">Ton jardin t'attend</Text>
      </View>
      <Text className="font-raleway text-secondary" style={{ color: MUTED_ON_DARK }}>
        Ajoute ta première plante : Growi te dira quand l'arroser, la tailler ou la mettre à
        l'abri. Ta photo viendra ensuite habiller cet écran.
      </Text>
      <Button
        label="Ajouter ma première plante"
        variant="primary"
        fullWidth
        icon={<Leaf size={18} color="#1E5631" />}
        onPress={() => router.navigate('/(tabs)/plantes')}
      />
    </View>
  )
}
