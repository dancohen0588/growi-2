import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react-native'
import {
  LUNAR_COURSE_ADVICE,
  LUNAR_DAY_ADVICE,
  LUNAR_DAY_LABELS,
  LUNAR_PHASE_EMOJIS,
  LUNAR_PHASE_LABELS,
  type LunarDay,
} from '@growi/shared'

import { EvidenceBadge } from '@/components/secrets/EvidenceBadge'

/**
 * Bandeau du calendrier lunaire — seulement si l'option est active, c'est-à-dire
 * si le serveur a renvoyé `planning.lunar`.
 *
 * Le badge « Tradition » est **permanent** (décision du 05/11/2026) : aucune
 * preuve n'établit l'effet de la Lune sur les cultures, et le bandeau ne doit
 * pas se lire comme une consigne au même titre qu'un arrosage. Un tap déplie
 * la lune montante/descendante et le rappel de ce que vaut ce calendrier.
 */
export function LunarBanner({ lunar }: { lunar: LunarDay }) {
  const [open, setOpen] = useState(false)
  const Course = lunar.ascending ? ArrowUp : ArrowDown
  const course = lunar.ascending ? 'Lune montante' : 'Lune descendante'

  return (
    <Pressable
      onPress={() => setOpen((value) => !value)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${LUNAR_DAY_LABELS[lunar.dayType]}, ${LUNAR_PHASE_LABELS[lunar.phase]}, ${course}. Tradition.`}
      accessibilityHint={open ? 'Replie le détail' : 'Déplie le détail'}
      className="mx-4 gap-2 rounded-xl bg-card p-4"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      <View className="flex-row items-center gap-3">
        <Text className="text-3xl" accessibilityElementsHidden importantForAccessibility="no">
          {LUNAR_PHASE_EMOJIS[lunar.phase] ?? '🌙'}
        </Text>

        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-poppins text-body text-forest">
              {LUNAR_DAY_LABELS[lunar.dayType]}
            </Text>
            <EvidenceBadge evidence="FOLK" />
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="flex-shrink font-raleway text-caption text-muted-foreground">
              {LUNAR_PHASE_LABELS[lunar.phase]} · {course}
            </Text>
            <Course size={12} color="hsl(139 20% 40%)" />
          </View>
        </View>

        {open ? (
          <ChevronUp size={18} color="#1E5631" />
        ) : (
          <ChevronDown size={18} color="#1E5631" />
        )}
      </View>

      <Text className="font-raleway text-secondary text-forest">
        {LUNAR_DAY_ADVICE[lunar.dayType]}
      </Text>

      {open ? (
        <View className="gap-2 border-t border-forest/10 pt-2">
          <Text className="font-raleway text-secondary text-forest">
            {lunar.ascending ? LUNAR_COURSE_ADVICE.ascending : LUNAR_COURSE_ADVICE.descending}
          </Text>
          <Text className="font-raleway text-caption italic text-muted-foreground">
            Une tradition de jardinier, transmise sans preuve scientifique. Suis-la pour le
            plaisir — les arrosages et les soins de ton planning, eux, ne s&apos;y règlent pas.
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
