/**
 * L'habillage « planche BD » des secrets (direction validée le 05/11/2026,
 * maquettes Claude Design `Main`, `Planche`, `Embleme`).
 *
 * Les teintes hors tokens viennent de la charte des dessins
 * (`@growi/shared/secrets/art.ts`) : tintes `#DCEFC0` / `#FCE7A9`, papier
 * `#FFFDF5`, texte adouci `#4b6b55`, et les « socles » des boutons —
 * `#7fae4e` sous le lime, `#143D22` sous le forest — qui leur donnent leur
 * relief de bouton imprimé. Le relief s'enfonce au clic, sauf si
 * l'utilisateur a demandé moins d'animations.
 */

const BASE =
  'inline-flex min-h-[44px] items-center justify-center gap-2.5 font-poppins transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none [&_svg]:shrink-0'

/** Bouton principal sur fond forest : « Ouvrir la planche », « C'est fait ». */
export const BD_LIME_CTA = [
  BASE,
  'rounded-[14px] bg-lime px-[22px] py-3 text-base font-bold text-forest shadow-[0_6px_0_#7fae4e] hover:bg-lime-hover',
  'active:translate-y-[3px] active:shadow-[0_3px_0_#7fae4e] motion-reduce:active:translate-y-0',
  'focus-visible:ring-sun focus-visible:ring-offset-forest',
].join(' ')

/** Bouton secondaire sur fond forest. */
export const BD_ON_DARK_OUTLINE = [
  BASE,
  'rounded-[14px] border-2 border-sand/70 bg-transparent px-5 py-2.5 text-[15px] font-semibold text-sand hover:bg-white/10',
  'focus-visible:ring-sun focus-visible:ring-offset-forest',
].join(' ')

/** « Je tente », sur la planche. */
export const BD_FOREST_CTA = [
  BASE,
  'rounded-[14px] bg-forest px-[26px] py-3.5 text-[17px] font-bold text-white shadow-[0_6px_0_#143D22] hover:bg-forest-light',
  'active:translate-y-[3px] active:shadow-[0_3px_0_#143D22] motion-reduce:active:translate-y-0',
  'focus-visible:ring-lime focus-visible:ring-offset-[#FFFDF5]',
].join(' ')

/** « Plus tard », sur la planche. */
export const BD_OUTLINE = [
  BASE,
  'rounded-[14px] border-2 border-forest bg-white px-[22px] py-3 text-base font-semibold text-forest hover:bg-sand',
  'focus-visible:ring-lime focus-visible:ring-offset-[#FFFDF5]',
].join(' ')

/** « Pas pour moi » : un lien plus qu'un bouton, pour ne pas rivaliser avec « Je tente ». */
export const BD_TEXT_BUTTON = [
  BASE,
  'rounded-lg px-2 py-3 text-[15px] font-semibold text-[#4b6b55] underline underline-offset-4 hover:text-forest',
  'focus-visible:ring-lime focus-visible:ring-offset-[#FFFDF5]',
].join(' ')

/** Les cartes forest du planning : fond plein et ombre portée verte. */
export const BD_CARD =
  'relative overflow-hidden rounded-[28px] bg-forest text-sand shadow-[0_18px_40px_-18px_rgba(30,86,49,0.55)]'

/** Le papier de la planche ouverte. */
export const BD_PAPER = 'bg-[#FFFDF5]'

/** Fond des cases, en alternance — la première jaune, la deuxième verte. */
export const PANEL_TINTS = ['bg-[#FCE7A9]', 'bg-[#DCEFC0]'] as const

/** Eyebrow : capitales espacées, Poppins. */
export const BD_EYEBROW = 'font-poppins text-[13px] font-bold uppercase tracking-[0.12em]'
