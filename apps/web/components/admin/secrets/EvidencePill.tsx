import { SECRET_EVIDENCE_LABELS, type SecretEvidence } from '@growi/shared'

import { Pill } from '@/components/admin/bits'

/**
 * Le badge de preuve, tel que l'admin le lit. Seul « Éprouvé » est en vert :
 * les trois autres sont des nuances de prudence, pas des alertes.
 */
const TONES: Record<SecretEvidence, 'positive' | 'neutral' | 'warning'> = {
  PROVEN: 'positive',
  PLAUSIBLE: 'neutral',
  FOLK: 'warning',
  MYTH: 'neutral',
}

export function EvidencePill({ evidence }: { evidence: string }) {
  const known = evidence in SECRET_EVIDENCE_LABELS
  return (
    <Pill tone={known ? TONES[evidence as SecretEvidence] : 'danger'}>
      {known ? SECRET_EVIDENCE_LABELS[evidence as SecretEvidence] : `Inconnu (${evidence})`}
    </Pill>
  )
}
