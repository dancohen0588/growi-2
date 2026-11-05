import { Pressable, Text, View } from 'react-native'
import { BookOpen, ChevronRight } from 'lucide-react-native'
import type { GardenAction, GardenSecret, SecretStage } from '@growi/shared'

import { CARD_SHADOW } from '@/components/ui/Card'

import { EvidenceBadge } from './EvidenceBadge'

const EYEBROW: Record<SecretStage, string> = {
  discover: 'Secret de la semaine',
  ready: 'Ta préparation est prête',
  feedback: 'Ça a marché ?',
}

const CTA: Record<SecretStage, string> = {
  discover: 'Touche pour dévoiler',
  ready: "C'est le moment de t'en servir",
  feedback: 'Dis-nous ce que tu en penses',
}

export interface SecretCardProps {
  action: GardenAction
  secret: GardenSecret
  /** Nom du jardin, quand l'utilisateur en a plusieurs. */
  gardenName?: string
  onOpen: () => void
}

/**
 * Carte d'un secret de jardinier — à part des gestes ordinaires.
 *
 * Fond papier (`sand-dark`), marge de carnet en `sun`, bordure en pointillé :
 * elle doit se distinguer d'un coup d'œil d'une tâche à cocher. Avant
 * dévoilement elle ne montre que **l'accroche** et le niveau de preuve ; le
 * titre et la recette se découvrent dans la feuille.
 */
export function SecretCard({ action, secret, gardenName, onOpen }: SecretCardProps) {
  const stage = secret.stage
  const where = [action.plantName, gardenName].filter(Boolean).join(' · ')
  // Au dévoilement, le mystère tient à l'accroche. Ensuite, le titre est
  // connu : c'est lui qui fait reconnaître la préparation lancée.
  const headline = stage === 'discover' ? secret.teaser : secret.title
  const subline = stage === 'discover' ? null : stage === 'feedback' ? action.why : null

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${EYEBROW[stage]} : ${headline}`}
      accessibilityHint="Ouvre le secret"
      style={({ pressed }) => [CARD_SHADOW, pressed ? { transform: [{ scale: 0.98 }] } : null]}
    >
      <View className="flex-row overflow-hidden rounded-2xl border border-dashed border-forest/30 bg-sand-dark">
        {/* La marge du carnet. */}
        <View className="w-1.5 bg-sun" />

        <View className="flex-1 gap-3 p-4">
          <View className="flex-row items-center gap-2">
            <BookOpen size={16} color="#1E5631" />
            <Text
              className="flex-1 font-poppins text-caption uppercase tracking-wider text-forest"
              numberOfLines={1}
            >
              {EYEBROW[stage]}
            </Text>
            <EvidenceBadge evidence={secret.evidence} />
          </View>

          <Text
            className={`text-forest ${
              stage === 'discover'
                ? 'font-raleway-medium text-body italic leading-6'
                : 'font-poppins text-section'
            }`}
            numberOfLines={3}
          >
            {stage === 'discover' ? `« ${headline} »` : headline}
          </Text>

          {subline ? (
            <Text className="font-raleway text-secondary text-forest" numberOfLines={2}>
              {subline}
            </Text>
          ) : null}

          {/* Deux lignes plutôt qu'une : sur un iPhone SE, police agrandie,
              le nom de la plante et l'invitation se seraient tronqués l'un
              l'autre. */}
          <View className="flex-row items-center gap-2">
            <Text className="text-base">{action.plantEmoji || '🌿'}</Text>
            <Text
              className="flex-1 font-raleway text-caption text-muted-foreground"
              numberOfLines={1}
            >
              {where || 'Ton jardin'}
            </Text>
          </View>

          <View className="flex-row items-center justify-end gap-1 border-t border-forest/10 pt-2">
            <Text className="flex-shrink font-raleway-semibold text-secondary text-forest">
              {CTA[stage]}
            </Text>
            <ChevronRight size={16} color="#1E5631" />
          </View>
        </View>
      </View>
    </Pressable>
  )
}
