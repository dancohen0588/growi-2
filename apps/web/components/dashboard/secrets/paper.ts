/**
 * Le « papier » des secrets : une page de carnet, lignée, avec sa marge.
 *
 * Fond sand (le token, pas une teinte ajoutée), lignes et marge tracées en
 * forest et sun très légers — la carte se distingue d'un coup d'œil des
 * cartes blanches du planning sans sortir de la palette. La marge est un
 * pseudo-élément : elle ne coûte aucun nœud et ne se lit pas au lecteur d'écran.
 */
export const PAPER_CLASS = [
  'relative overflow-hidden bg-sand ring-1 ring-inset ring-forest/10 shadow-card',
  'bg-[image:repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,rgba(30,86,49,0.06)_27px,rgba(30,86,49,0.06)_28px)]',
  "before:pointer-events-none before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-sun/60 before:content-['']",
].join(' ')

/** Le retrait du texte, pour qu'il commence après la marge du carnet. */
export const PAPER_INSET = 'pl-10 pr-5'
