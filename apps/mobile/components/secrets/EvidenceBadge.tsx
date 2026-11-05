import { Text, View } from 'react-native'
import { BadgeCheck, ScrollText, SearchCheck, Sprout } from 'lucide-react-native'
import { SECRET_EVIDENCE_LABELS, type SecretEvidence } from '@growi/shared'

/**
 * Le niveau de preuve d'un secret, **toujours visible** (décision du
 * 05/11/2026) : un remède présenté comme sûr fait perdre la confiance au
 * premier échec. Le fond porte le niveau ; le texte reste forest pour rester
 * lisible — le lime n'a pas le contraste d'un texte.
 */
const TONE: Record<SecretEvidence, string> = {
  PROVEN: 'bg-lime',
  PLAUSIBLE: 'bg-lime/40',
  FOLK: 'bg-sun/60',
  MYTH: 'bg-card border border-forest/30',
}

const ICON: Record<SecretEvidence, typeof Sprout> = {
  PROVEN: BadgeCheck,
  PLAUSIBLE: Sprout,
  FOLK: ScrollText,
  MYTH: SearchCheck,
}

export interface EvidenceBadgeProps {
  evidence: SecretEvidence
  /**
   * `sun` : la pastille de la planche (carte forest, feuille, grimoire) —
   * soleil plein quel que soit le niveau, que portent alors le libellé et
   * l'icône. Sur le fond forest de la carte, les teintes pâles de `default`
   * ne se distingueraient plus.
   */
  tone?: 'default' | 'sun'
  /** Ajouté après le libellé : « Tradition · 2 min ». */
  suffix?: string
}

export function EvidenceBadge({ evidence, tone = 'default', suffix }: EvidenceBadgeProps) {
  const Icon = ICON[evidence] ?? ScrollText
  const label = SECRET_EVIDENCE_LABELS[evidence] ?? SECRET_EVIDENCE_LABELS.FOLK
  const sun = tone === 'sun'

  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full ${
        sun ? 'bg-sun py-1 pl-2 pr-2.5' : `px-2.5 py-1 ${TONE[evidence] ?? TONE.FOLK}`
      }`}
      accessible
      accessibilityLabel={`Niveau de preuve : ${label}${suffix ? `, ${suffix}` : ''}`}
    >
      <Icon size={sun ? 13 : 12} color="#1E5631" strokeWidth={sun ? 2.2 : 2} />
      <Text
        className={`text-caption text-forest ${sun ? 'font-poppins' : 'font-raleway-semibold'}`}
        numberOfLines={1}
      >
        {label}
        {suffix ? ` · ${suffix}` : ''}
      </Text>
    </View>
  )
}
