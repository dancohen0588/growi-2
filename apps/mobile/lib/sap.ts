import { SAP_KIND_LABELS, sapRingOrdinal, type SapEntry } from '@growi/shared'

/**
 * Les phrases de la sève, partagées par la pastille, la carte de l'Accueil,
 * l'écran « Ta sève » et les annonces de gain.
 */

interface RingsLike {
  count: number
  progress: number
  remaining: number
}

/** Pour les lecteurs d'écran : « 3 cernes formés, le 4ᵉ à 20 % ». */
export function ringsLabel(rings: RingsLike): string {
  const percent = Math.round(rings.progress * 100)
  const next = sapRingOrdinal(rings.count + 1)
  if (rings.count === 0) return `Coupe de ton tronc : ton ${next} cerne à ${percent} %`
  const formed = rings.count === 1 ? '1 cerne formé' : `${rings.count} cernes formés`
  return `Coupe de ton tronc : ${formed}, le ${next} à ${percent} %`
}

/** « Ton 4ᵉ cerne se forme · encore 160 » */
export function formingLine(rings: RingsLike): string {
  return `Ton ${sapRingOrdinal(rings.count + 1)} cerne se forme · encore ${rings.remaining}`
}

/** « 3 cernes · ton 4ᵉ se forme » — sous le total, sur le bloc forest. */
export function ringsLine(rings: RingsLike): string {
  const next = sapRingOrdinal(rings.count + 1)
  if (rings.count === 0) return `Ton ${next} cerne se forme`
  return `${rings.count} cerne${rings.count > 1 ? 's' : ''} · ton ${next} se forme`
}

/** Ce qui a rapporté : le libellé figé par le serveur, sinon celui du type. */
export function entryLabel(entry: Pick<SapEntry, 'kind' | 'label'>): string {
  return entry.label?.trim() || SAP_KIND_LABELS[entry.kind]
}

/** « +2 », jamais « 2 » : un gain se lit comme un gain. */
export function formatSapAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`
}

/**
 * Ce que dit l'annonce d'un gain qui en regroupe plusieurs (« Tout arrosé »
 * en crédite autant que de plantes) : le libellé quand il n'y en a qu'un, le
 * type et le nombre quand ils sont tous du même type.
 */
export function gainsLabel(entries: SapEntry[]): string {
  if (entries.length === 0) return 'Merci pour ton jardin'
  if (entries.length === 1) return entryLabel(entries[0])
  const [first] = entries
  if (entries.every((entry) => entry.kind === first.kind)) {
    return `${SAP_KIND_LABELS[first.kind]} ×${entries.length}`
  }
  return 'Merci pour tes gestes'
}
