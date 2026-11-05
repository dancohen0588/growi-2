import { Pressable, Text, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { BookOpenText, CircleCheck, KeyRound, ThumbsUp } from 'lucide-react-native'
import type { GardenAction, GardenSecret, SecretStage } from '@growi/shared'

import { Button } from '@/components/ui/Button'

import { EvidenceBadge } from './EvidenceBadge'
import { SecretEmblem } from './SecretEmblem'

const EYEBROW: Record<SecretStage, string> = {
  discover: 'Secret de la semaine',
  ready: 'Ta préparation est prête',
  feedback: 'Ça a marché ?',
}

/** Le libellé du bouton : la planche s'annonce comme telle quand elle existe. */
function ctaLabel(stage: SecretStage, hasPlanche: boolean): string {
  if (stage === 'feedback') return 'Donner mon avis'
  if (hasPlanche) return 'Ouvrir la planche'
  return stage === 'ready' ? 'Voir comment faire' : 'Découvrir le secret'
}

function CtaIcon({ stage, hasPlanche }: { stage: SecretStage; hasPlanche: boolean }) {
  const props = { size: 20, color: '#1E5631', strokeWidth: 2.2 }
  if (stage === 'feedback') return <ThumbsUp {...props} />
  if (hasPlanche) return <BookOpenText {...props} />
  return stage === 'ready' ? <CircleCheck {...props} /> : <KeyRound {...props} />
}

/**
 * Feuilles en filigrane, au trait `forest-light` : la carte se reconnaît d'un
 * coup d'œil sans rien ajouter à lire. `slice` les cale en haut à gauche quelle
 * que soit la hauteur de la carte (police agrandie comprise).
 */
function Watermark() {
  return (
    <View
      pointerEvents="none"
      className="absolute bottom-0 left-0 right-0 top-0"
      style={{ opacity: 0.35 }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg width="100%" height="100%" viewBox="0 0 358 300" preserveAspectRatio="xMinYMin slice">
        <G fill="none" stroke="#2d7a47" strokeWidth={2} strokeLinecap="round">
          <Path d="M250 150 C268 132 294 132 306 146 C290 164 266 164 250 150 Z" />
          <Path d="M250 150 L316 148" />
          <Path d="M40 250 C56 234 80 236 90 250 C76 266 54 264 40 250 Z" />
          <Circle cx={320} cy={40} r={3} />
          <Circle cx={180} cy={270} r={3} />
        </G>
      </Svg>
    </View>
  )
}

/** Ombre portée de la carte, teintée forest comme toutes les ombres de l'app. */
const SECRET_CARD_SHADOW = {
  shadowColor: '#1E5631',
  shadowOpacity: 0.35,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 12 },
  elevation: 8,
} as const

export interface SecretCardProps {
  action: GardenAction
  secret: GardenSecret
  /** Nom du jardin, quand l'utilisateur en a plusieurs. */
  gardenName?: string
  onOpen: () => void
  /** Le lien « Mon grimoire » — absent, la carte ne le montre pas. */
  onOpenGrimoire?: () => void
  /** Progression du grimoire, si elle est déjà connue (cache) : « 3 / 24 ». */
  grimoireProgress?: { discovered: number; total: number } | null
}

/**
 * Carte d'un secret de jardinier — à part des gestes ordinaires (direction
 * « planche BD » validée le 05/11/2026, maquette Claude Design `Mobile.dc`).
 *
 * Fond forest, emblème, niveau de preuve en pastille soleil, accroche en blanc.
 * Avant dévoilement elle ne montre que **l'accroche** ; le titre, la recette ou
 * la planche se découvrent dans la feuille. Les cartes « préparation prête » et
 * « Ça a marché ? » prennent le même habillage, titre connu en tête.
 *
 * Seuls le bouton et le lien sont tactiles : une carte entière tactile qui
 * contient un lien imbriquerait deux cibles l'une dans l'autre.
 */
export function SecretCard({
  action,
  secret,
  gardenName,
  onOpen,
  onOpenGrimoire,
  grimoireProgress,
}: SecretCardProps) {
  const stage = secret.stage
  const hasPlanche = !!secret.planche
  // Au dévoilement, le mystère tient à l'accroche. Ensuite, le titre est
  // connu : c'est lui qui fait reconnaître la préparation lancée.
  const headline = stage === 'discover' ? secret.teaser : secret.title
  const subline = stage === 'feedback' ? action.why : null
  const where = [
    action.plantName,
    gardenName,
    stage === 'discover' && secret.effortMinutes ? `${secret.effortMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const grimoireLabel =
    grimoireProgress && grimoireProgress.total > 0
      ? `Mon grimoire · ${grimoireProgress.discovered} / ${grimoireProgress.total}`
      : 'Mon grimoire'

  return (
    <View style={SECRET_CARD_SHADOW}>
      <View className="gap-3.5 overflow-hidden rounded-3xl bg-forest p-5">
        <Watermark />

        <View className="flex-row items-center gap-3.5">
          <SecretEmblem size={68} />
          <View className="flex-1 gap-1.5">
            <Text
              className="font-poppins-bold text-caption uppercase tracking-widest text-lime"
              accessibilityRole="header"
            >
              {EYEBROW[stage]}
            </Text>
            <EvidenceBadge evidence={secret.evidence} tone="sun" />
          </View>
        </View>

        <Text
          className="font-poppins text-white"
          style={{ fontSize: 20, lineHeight: 26 }}
          numberOfLines={4}
        >
          {headline}
        </Text>

        {subline ? (
          <Text className="font-raleway text-secondary text-sand" numberOfLines={3}>
            {subline}
          </Text>
        ) : null}

        {/* Une ligne, mais qui peut passer à deux : sur un iPhone SE, police
            agrandie, plante et jardin se seraient tronqués l'un l'autre. */}
        <View className="flex-row items-center gap-2">
          <Text className="text-base">{action.plantEmoji || '🌿'}</Text>
          <Text className="flex-1 font-raleway text-secondary text-sand/85" numberOfLines={2}>
            {where || 'Ton jardin'}
          </Text>
        </View>

        <Button
          label={ctaLabel(stage, hasPlanche)}
          size="lg"
          font="poppins-bold"
          raised
          icon={<CtaIcon stage={stage} hasPlanche={hasPlanche} />}
          onPress={onOpen}
          accessibilityHint="Ouvre le secret"
        />

        {onOpenGrimoire ? (
          <Pressable
            onPress={onOpenGrimoire}
            accessibilityRole="link"
            accessibilityLabel={
              grimoireProgress && grimoireProgress.total > 0
                ? `Mon grimoire, ${grimoireProgress.discovered} secrets découverts sur ${grimoireProgress.total}`
                : 'Ouvrir mon grimoire'
            }
            className="min-h-11 items-center justify-center self-center px-3"
            style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
          >
            <Text className="font-poppins text-secondary text-sand underline">{grimoireLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
