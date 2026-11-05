/**
 * Les dessins des « Secrets de jardinier » — planches façon BD, une case par
 * étape. Direction artistique validée le 05/11/2026 (canvas Claude Design
 * « Growi — Secret de jardinier, planche BD »).
 *
 * **Les dessins vivent dans le code**, pas en base : relus et versionnés comme
 * le reste, et aucun SVG ne vient jamais d'une saisie. La base ne porte que des
 * **clés** (`eau-cuisson/1`), validées contre ce registre ; une clé inconnue
 * fait écarter la planche, et le secret s'affiche alors en texte.
 *
 * Un même source sert au web (`dangerouslySetInnerHTML` sur une chaîne de ce
 * fichier, jamais d'ailleurs) et au mobile (`SvgXml` de react-native-svg). D'où
 * les contraintes, à tenir pour tout nouveau dessin :
 * - attributs de présentation seulement : ni `<style>`, ni `class`, ni filtre,
 *   dégradé, `<use>`, `<image>` ;
 * - pas de `paint-order` (ignoré par react-native-svg) : un texte détouré est
 *   dessiné deux fois, contour épais puis remplissage ;
 * - `<text>` réservé aux onomatopées et aux bulles, `font-family="Poppins"` —
 *   le mobile le remplace par la police qu'il a chargée (`Poppins_700Bold`) ;
 * - aucun `role` ni `aria-*` : le texte alternatif est la légende de la case,
 *   posé par le composant ;
 * - palette de la charte seulement : forest `#1E5631`, lime `#B4DD7F` /
 *   `#a2cf6b`, sun `#F6C445` / `#e4b030`, sand `#F9F7E8` / `#ede9cc`, tintes
 *   `#DCEFC0` et `#FCE7A9`, blanc.
 *
 * Cases en `viewBox="0 0 320 240"`, précautions en `viewBox="0 0 220 130"`,
 * dessinées en clair pour le fond forest de leur case.
 */

const SOL = '<rect x="0" y="198" width="320" height="42" fill="#ede9cc"/><path d="M0 198 H320" stroke="#1E5631" stroke-width="3"/>'

const panel = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">${SOL}${body}</svg>`
const caution = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130">${body}</svg>`

/** Texte d'onomatopée : contour forest puis remplissage blanc. */
const sfx = (text: string, x: number, y: number, size: number, rotate = '') =>
  [
    `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="800" fill="none" stroke="#1E5631" stroke-width="5" stroke-linejoin="round"${rotate}>${text}</text>`,
    `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="800" fill="#FFFFFF"${rotate}>${text}</text>`,
  ].join('')

const CAUTION_SEL_HUILE = caution(
  '<rect x="56" y="38" width="40" height="70" rx="10" fill="#F9F7E8"/>' +
    '<path d="M56 50 a20 14 0 0 1 40 0 Z" fill="#B4DD7F" stroke="#F9F7E8" stroke-width="3"/>' +
    '<circle cx="70" cy="44" r="2.5" fill="#1E5631"/><circle cx="82" cy="44" r="2.5" fill="#1E5631"/><circle cx="76" cy="40" r="2.5" fill="#1E5631"/>' +
    '<path d="M126 108 V60 l8 -14 V30 h12 v16 l8 14 v48 Z" fill="#F6C445" stroke="#F9F7E8" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="132" y="22" width="16" height="10" rx="2" fill="#F9F7E8"/>' +
    '<circle cx="108" cy="68" r="56" fill="none" stroke="#F6C445" stroke-width="7"/>' +
    '<path d="M68 28 L148 108" stroke="#F6C445" stroke-width="7" stroke-linecap="round"/>',
)

export const SECRET_ART: Readonly<Record<string, string>> = {
  // ── L'eau des légumes, deuxième service ─────────────────────────────────
  'eau-cuisson/1': panel(
    '<g transform="translate(50 70) rotate(32 60 40)">' +
      '<rect x="-52" y="12" width="52" height="14" rx="7" fill="#1E5631"/>' +
      '<rect x="0" y="0" width="120" height="84" rx="12" fill="#B4DD7F" stroke="#1E5631" stroke-width="4"/>' +
      '<rect x="-8" y="-8" width="136" height="14" rx="7" fill="#a2cf6b" stroke="#1E5631" stroke-width="4"/>' +
      '<path d="M14 30 h92" stroke="#1E5631" stroke-width="3" stroke-linecap="round" opacity="0.35"/>' +
      '</g>' +
      '<circle cx="150" cy="78" r="9" fill="#F6C445" stroke="#1E5631" stroke-width="3"/>' +
      '<circle cx="168" cy="92" r="7" fill="#F6C445" stroke="#1E5631" stroke-width="3"/>' +
      '<path d="M188 112 C206 118 220 130 226 150" fill="none" stroke="#1E5631" stroke-width="16" stroke-linecap="round"/>' +
      '<path d="M188 112 C206 118 220 130 226 150" fill="none" stroke="#DCEFC0" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M214 150 H240 V162 C262 170 266 182 266 194 V196 H188 V194 C188 182 192 170 214 162 Z" fill="#FFFFFF" stroke="#1E5631" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M194 180 C210 176 244 176 262 180 V196 H192 Z" fill="#DCEFC0"/>' +
      '<path d="M80 34 c-8 -8 8 -14 0 -24 M104 28 c-8 -8 8 -14 0 -24" fill="none" stroke="#1E5631" stroke-width="3" stroke-linecap="round" opacity="0.7"/>' +
      sfx('glou glou', 206, 62, 26, ' transform="rotate(-8 240 56)"'),
  ),
  'eau-cuisson/2': panel(
    '<path d="M132 92 H178 V112 C210 124 216 146 216 168 V196 H94 V168 C94 146 100 124 132 112 Z" fill="#FFFFFF" stroke="#1E5631" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M100 150 C130 144 180 144 210 150 V196 H98 Z" fill="#DCEFC0"/>' +
      '<path d="M120 164 h18 M150 176 h26" stroke="#1E5631" stroke-width="3" stroke-linecap="round" opacity="0.3"/>' +
      '<path d="M140 76 c-8 -8 8 -14 0 -24 M164 70 c-8 -8 8 -14 0 -24" fill="none" stroke="#1E5631" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 7" opacity="0.45"/>' +
      '<circle cx="258" cy="70" r="34" fill="#F6C445" stroke="#1E5631" stroke-width="4"/>' +
      '<path d="M258 48 V70 L274 80" fill="none" stroke="#1E5631" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M232 36 l-8 -8 M284 36 l8 -8" stroke="#1E5631" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="44" y="96" width="20" height="92" rx="10" fill="#FFFFFF" stroke="#1E5631" stroke-width="4"/>' +
      '<circle cx="54" cy="190" r="14" fill="#B4DD7F" stroke="#1E5631" stroke-width="4"/>' +
      '<rect x="50" y="160" width="8" height="24" rx="4" fill="#B4DD7F"/>' +
      '<path d="M74 112 l10 0 M74 130 l10 0 M74 148 l10 0" stroke="#1E5631" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M86 102 l0 20 M78 114 l8 8 l8 -8" fill="none" stroke="#1E5631" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  'eau-cuisson/3': panel(
    '<g transform="translate(40 30) rotate(60 35 46)">' +
      '<path d="M22 0 H48 V14 C70 22 72 40 72 60 V84 Q72 92 64 92 H6 Q-2 92 -2 84 V60 C-2 40 0 22 22 14 Z" fill="#FFFFFF" stroke="#1E5631" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M70 52 V84 Q70 90 64 90 H40 C44 74 56 60 70 52 Z" fill="#DCEFC0"/>' +
      '</g>' +
      '<path d="M122 66 C150 76 168 110 176 146" fill="none" stroke="#1E5631" stroke-width="14" stroke-linecap="round"/>' +
      '<path d="M122 66 C150 76 168 110 176 146" fill="none" stroke="#DCEFC0" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M206 150 V108 M206 128 C190 120 184 108 186 96 M206 118 C222 110 230 98 228 86" fill="none" stroke="#1E5631" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="184" cy="96" rx="16" ry="11" transform="rotate(-30 184 96)" fill="#B4DD7F" stroke="#1E5631" stroke-width="4"/>' +
      '<ellipse cx="230" cy="84" rx="16" ry="11" transform="rotate(25 230 84)" fill="#B4DD7F" stroke="#1E5631" stroke-width="4"/>' +
      '<ellipse cx="206" cy="100" rx="13" ry="18" fill="#B4DD7F" stroke="#1E5631" stroke-width="4"/>' +
      '<ellipse cx="188" cy="126" rx="14" ry="9" transform="rotate(-15 188 126)" fill="#a2cf6b" stroke="#1E5631" stroke-width="4"/>' +
      '<ellipse cx="226" cy="124" rx="14" ry="9" transform="rotate(15 226 124)" fill="#a2cf6b" stroke="#1E5631" stroke-width="4"/>' +
      '<path d="M166 160 H246 L236 198 H176 Z" fill="#F6C445" stroke="#1E5631" stroke-width="4" stroke-linejoin="round"/>' +
      '<rect x="160" y="148" width="92" height="16" rx="4" fill="#e4b030" stroke="#1E5631" stroke-width="4"/>' +
      '<path d="M244 46 h56 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-30 l-12 12 v-12 h-14 a10 10 0 0 1 -10 -10 v-16 a10 10 0 0 1 10 -10 z" fill="#FFFFFF" stroke="#1E5631" stroke-width="3" stroke-linejoin="round"/>' +
      '<text x="272" y="70" text-anchor="middle" font-family="Poppins" font-size="16" font-weight="700" fill="#1E5631">Merci !</text>',
  ),
  'eau-cuisson/caution': CAUTION_SEL_HUILE,
}

/** Une clé de dessin connue du registre. */
export function isSecretArt(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SECRET_ART, key)
}

/** Les clés, pour le sélecteur de l'admin. */
export const SECRET_ART_KEYS: readonly string[] = Object.keys(SECRET_ART).sort()

/** Une case de précaution — à distinguer d'une case d'étape dans l'admin. */
export function isCautionArt(key: string): boolean {
  return key.endsWith('/caution')
}

// ─── L'emblème ─────────────────────────────────────────────────────────────

const SCEAU =
  'M88.0 48.0 Q94.3 56.2 85.6 61.7 Q88.7 71.5 78.6 73.7 Q78.2 84.0 68.0 82.6 Q64.1 92.2 54.9 87.4 Q48.0 95.0 41.1 87.4 Q31.9 92.2 28.0 82.6 Q17.8 84.0 17.4 73.7 Q7.3 71.5 10.4 61.7 Q1.7 56.2 8.0 48.0 Q1.7 39.8 10.4 34.3 Q7.3 24.5 17.4 22.3 Q17.8 12.0 28.0 13.4 Q31.9 3.8 41.1 8.6 Q48.0 1.0 54.9 8.6 Q64.1 3.8 68.0 13.4 Q78.2 12.0 78.6 22.3 Q88.7 24.5 85.6 34.3 Q94.3 39.8 88.0 48.0 Z'

/**
 * L'emblème des secrets : un sceau soleil, une serrure d'où sort une pousse.
 * Réservé aux secrets — aucune autre carte du planning ne le porte.
 *
 * - `full` : 40 px et plus (carte, planche, grimoire) ;
 * - `small` : 20 à 40 px, sans pointillés, traits épaissis ;
 * - `line` : pictogramme au trait en `currentColor`, pour la navigation.
 */
export const SECRET_EMBLEM_SVG = {
  full:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
    `<path d="${SCEAU}" fill="#F6C445"/>` +
    '<circle cx="48" cy="48" r="33" fill="none" stroke="#1E5631" stroke-width="1.6" stroke-dasharray="2 3"/>' +
    '<path d="M48 40 a10 10 0 0 1 5.8 18.1 L57 72 H39 L42.2 58.1 A10 10 0 0 1 48 40 Z" fill="#1E5631"/>' +
    '<path d="M48 40 V27" stroke="#1E5631" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M48 31 C41 31 35.5 27 34.5 20.5 C41.5 20.5 47 24 48 31 Z" fill="#B4DD7F" stroke="#1E5631" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M48 28 C51.5 21.5 57 18.5 62.5 19.5 C61.5 26 55.5 29.5 48 28 Z" fill="#B4DD7F" stroke="#1E5631" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>',
  small:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
    `<path d="${SCEAU}" fill="#F6C445"/>` +
    '<path d="M48 36 a12 12 0 0 1 7 21.8 L60 76 H36 L41 57.8 A12 12 0 0 1 48 36 Z" fill="#1E5631"/>' +
    '<path d="M48 36 V22 M48 26 C40 26 34 21 33 14 M48 24 C52 17 58 14 64 15" fill="none" stroke="#1E5631" stroke-width="5" stroke-linecap="round"/>' +
    '</svg>',
  line:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="13" r="9"/>' +
    '<path d="M12 11.5a2 2 0 0 1 1.2 3.6L14 18h-4l.8-2.9A2 2 0 0 1 12 11.5Z"/>' +
    '<path d="M12 11.5V7M12 8.5c-1.6 0-2.8-1-3-2.5M12 8c.8-1.4 2-2.1 3.3-1.9"/>' +
    '</svg>',
} as const

export type SecretEmblemVariant = keyof typeof SECRET_EMBLEM_SVG
