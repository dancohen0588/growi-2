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

export function EvidenceBadge({ evidence }: { evidence: SecretEvidence }) {
  const Icon = ICON[evidence] ?? ScrollText
  const label = SECRET_EVIDENCE_LABELS[evidence] ?? SECRET_EVIDENCE_LABELS.FOLK

  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${TONE[evidence] ?? TONE.FOLK}`}
      accessible
      accessibilityLabel={`Niveau de preuve : ${label}`}
    >
      <Icon size={12} color="#1E5631" />
      <Text className="font-raleway-semibold text-caption text-forest">{label}</Text>
    </View>
  )
}
