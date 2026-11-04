/**
 * Protections d'hiver du catalogue (`winterProtectionType`) et ce qu'il faut
 * en dire. Partagé par l'alerte gel (r10) et la préparation de l'hivernage
 * (r14) : la même plante ne doit pas recevoir deux consignes différentes.
 */

export type WinterProtection = 'MULCH' | 'FLEECE' | 'INDOOR'

/** `NONE`, valeur absente ou inconnue : rien à protéger. */
export function winterProtectionOf(raw: string | null | undefined): WinterProtection | null {
  if (raw === 'MULCH' || raw === 'FLEECE' || raw === 'INDOOR') return raw
  return null
}

export const WINTER_HOW_TO: Record<WinterProtection, string> = {
  INDOOR:
    "Installe-la dans une pièce lumineuse et fraîche (10 à 15 °C), loin des radiateurs. Espace les arrosages tout l'hiver : elle pousse à peine.",
  FLEECE:
    "Pose un voile d'hivernage les nuits annoncées sous 0 °C, sans le serrer, et retire-le en journée quand il fait doux pour que la plante respire.",
  MULCH:
    "Étale 10 cm de feuilles mortes, de paille ou de broyat au pied, en laissant quelques centimètres libres autour de la tige : les racines passent l'hiver au chaud.",
}

/** Conseil générique quand le catalogue ne dit pas comment protéger. */
export const FROST_HOW_TO_DEFAULT =
  "Rentre-la si elle est en pot ; sinon couvre-la d'un voile d'hivernage pour la nuit et paille son pied."
