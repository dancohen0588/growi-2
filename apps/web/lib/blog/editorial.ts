import { BLOG_TAG_LABELS, BLOG_TAGS, type BlogTag } from '@growi/shared'

/**
 * Ligne éditoriale du blog « Conseils » — **source de vérité** du ton, des
 * interdits et de la saisonnalité, pour le générateur comme pour la rédaction
 * à la main.
 *
 * Tout est pur ici : calendrier, prompts, contrôles. Le service de génération
 * (`lib/services/blog-generator.service.ts`) orchestre ; ce module décide de ce
 * qui est acceptable. Corriger une consigne ou un thème de saison, c'est
 * modifier ce fichier.
 */

// ─── Calendrier saisonnier ─────────────────────────────────────────────────

/**
 * Thèmes par mois, climat français métropolitain (plaine, hors montagne et
 * pourtour méditerranéen, qui ont deux à trois semaines d'écart).
 *
 * C'est le socle de la pertinence : le modèle choisit **parmi** ces thèmes
 * ceux qui tombent dans la fenêtre éditoriale, il n'invente pas la saison.
 */
export const SEASONAL_CALENDAR: Record<number, readonly string[]> = {
  1: [
    'Tailler les arbres fruitiers à pépins (pommiers, poiriers) hors gel',
    'Protéger les plantes en pot du gel : voile, paillage, emplacement abrité',
    'Planifier le potager : rotation des cultures et plan de l’année',
    'Plantes d’intérieur en hiver : lumière, arrosage réduit, air sec',
    'Commander ses graines et vérifier leur faculté germinative',
  ],
  2: [
    'Premiers semis au chaud : tomates, poivrons, aubergines',
    'Tailler les rosiers en fin d’hiver',
    'Préparer le sol du potager : décompacter sans retourner',
    'Planter l’ail, l’échalote et les petits fruits',
    'Surveiller les dernières gelées sur les bourgeons',
  ],
  3: [
    'Semer en pleine terre : radis, carottes, épinards, petits pois',
    'Rempoter les plantes d’intérieur au redémarrage de la végétation',
    'Scarifier et regarnir la pelouse',
    'Diviser les vivaces d’automne',
    'Planter les pommes de terre primeurs',
    'Premiers pucerons : les repérer sans traiter trop tôt',
  ],
  4: [
    'Les saints de glace : quoi planter avant, quoi attendre',
    'Endurcir les semis avant la mise en terre',
    'Pailler le potager au bon moment',
    'Limaces et escargots : protéger les jeunes plants',
    'Tailler les arbustes à floraison printanière après la fleur',
  ],
  5: [
    'Planter tomates, courgettes et courges après les saints de glace',
    'Installer un arrosage économe avant l’été',
    'Tuteurer et pincer les tomates',
    'Semer les fleurs mellifères pour les pollinisateurs',
    'Sortir les plantes d’intérieur : acclimater sans brûler',
  ],
  6: [
    'Arroser moins souvent mais plus profondément',
    'Oïdium et mildiou : conditions de départ et premiers signes',
    'Récolter et conserver les premières récoltes du potager',
    'Tailler les haies en respectant la nidification',
    'Semer les légumes d’automne : carottes, choux, poireaux',
  ],
  7: [
    'Canicule : protéger le jardin et les pots',
    'Arroser en vacances : solutions sans gaspillage',
    'Récolter les tomates et courgettes au bon stade',
    'Bouturer les arbustes et aromatiques en été',
    'Surveiller araignées rouges et thrips par temps sec',
  ],
  8: [
    'Préparer le potager d’automne : semis et plantations d’août',
    'Récolter et faire sécher ses graines',
    'Maladies de fin d’été : oïdium, mildiou, rouille',
    'Réduire l’arrosage des plantes d’intérieur à la rentrée',
    'Tailler la lavande après floraison',
  ],
  9: [
    'Semer les engrais verts sur les planches libérées',
    'Rentrer les plantes frileuses avant les premières fraîches',
    'Planter les bulbes de printemps',
    'Semer ou regarnir la pelouse en fin d’été',
    'Récolter et stocker courges et pommes de terre',
  ],
  10: [
    'Planter arbres, arbustes et haies : la meilleure saison',
    'Ramasser les feuilles et en faire un paillage',
    'Protéger les plantes du premier gel',
    'Diviser et replanter les vivaces de printemps',
    'Plantes d’intérieur : moins de lumière, moins d’eau',
    'Planter l’ail d’automne et les fraisiers',
  ],
  11: [
    'Hiverner le potager : paillage, couvert, planches au repos',
    'Planter les arbres fruitiers à racines nues',
    'Protéger les plantes en pot et les agrumes du froid',
    'Nettoyer et ranger les outils',
    'Récolter les légumes racines et les poireaux',
  ],
  12: [
    'Prendre soin des plantes d’intérieur en hiver',
    'Tailler les arbres fruitiers hors gel',
    'Nourrir les oiseaux du jardin sans leur nuire',
    'Préparer ses commandes de graines',
    'Protéger les vivaces fragiles du gel',
  ],
}

/** Un article se lit quand on en a besoin : un sujet d'octobre sort mi-septembre. */
export const EDITORIAL_WINDOW_DAYS = { from: 21, to: 35 } as const

const DAY_MS = 24 * 60 * 60 * 1000

export interface EditorialWindow {
  from: Date
  to: Date
  /** Mois (1–12) touchés par la fenêtre, du plus proche au plus lointain. */
  months: number[]
}

export function editorialWindow(today: Date): EditorialWindow {
  const from = new Date(today.getTime() + EDITORIAL_WINDOW_DAYS.from * DAY_MS)
  const to = new Date(today.getTime() + EDITORIAL_WINDOW_DAYS.to * DAY_MS)
  const months = [from.getUTCMonth() + 1]
  const last = to.getUTCMonth() + 1
  if (last !== months[0]) months.push(last)
  return { from, to, months }
}

// ─── Inventaire et priorités ───────────────────────────────────────────────

/** Ce tag est réservé aux annonces produit, écrites à la main. */
export const MANUAL_ONLY_TAGS: readonly BlogTag[] = ['actus-growi']

export const AUTO_TAGS: readonly BlogTag[] = BLOG_TAGS.filter(tag => !MANUAL_ONLY_TAGS.includes(tag))

export interface InventoryItem {
  title: string
  tags: string[]
  /** Date de publication, ou de création pour un brouillon. */
  date: Date
  status: string
}

/**
 * Tags choisissables automatiquement, du moins fourni au plus fourni. Tous les
 * statuts comptent : un brouillon en attente sur le potager suffit à ne pas en
 * proposer un second.
 */
export function tagPriority(inventory: readonly InventoryItem[]): Array<{ tag: BlogTag; count: number }> {
  return AUTO_TAGS
    .map(tag => ({ tag, count: inventory.filter(item => item.tags.includes(tag)).length }))
    .sort((a, b) => a.count - b.count || AUTO_TAGS.indexOf(a.tag) - AUTO_TAGS.indexOf(b.tag))
}

// ─── Similarité de titres ──────────────────────────────────────────────────

/** Au-delà, deux titres parlent du même sujet. */
export const TITLE_SIMILARITY_THRESHOLD = 0.6

/** Mots vides : sans eux, « Tailler ses rosiers » et « Tailler les rosiers » coïncident. */
const STOP_WORDS = new Set([
  'a', 'au', 'aux', 'avant', 'apres', 'avec', 'ce', 'ces', 'comment', 'dans', 'de', 'des', 'du',
  'en', 'et', 'la', 'le', 'les', 'l', 'd', 'mes', 'mon', 'ou', 'par', 'pas', 'pour', 'quand',
  'que', 'quoi', 'sa', 'sans', 'se', 'ses', 'son', 'sur', 'ta', 'tes', 'ton', 'un', 'une', 'vos',
  'votre', 'bien', 'bon', 'bons', 'bonne', 'bonnes', 'guide', 'conseils',
])

export function titleWords(title: string): Set<string> {
  const words = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
  return new Set(words)
}

/** Indice de Jaccard sur les mots normalisés : 0 = rien de commun, 1 = identiques. */
export function titleSimilarity(a: string, b: string): number {
  const wordsA = titleWords(a)
  const wordsB = titleWords(b)
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const word of wordsA) if (wordsB.has(word)) shared += 1
  return shared / (wordsA.size + wordsB.size - shared)
}

/** Le titre existant le plus proche, s'il dépasse le seuil. */
export function findSimilarTitle(title: string, existing: readonly string[]): string | null {
  let best: { title: string; score: number } | null = null
  for (const candidate of existing) {
    const score = titleSimilarity(title, candidate)
    if (score > TITLE_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { title: candidate, score }
    }
  }
  return best?.title ?? null
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function frenchDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_FR[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Longueur maximale d'un sujet imposé depuis l'admin. */
export const MAX_TOPIC_LENGTH = 200

/**
 * Un sujet saisi dans l'admin entre dans un prompt : on le tronque, on le met
 * sur une ligne, et on retire ce qui pourrait fermer le bloc qui le délimite.
 */
export function sanitizeTopic(topic: string): string {
  return topic
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[`<>{}]/g, '')
    .replace(/"{3,}/g, '"')
    .trim()
    .slice(0, MAX_TOPIC_LENGTH)
}

/** Sortie attendue du choix de thème : trois candidats classés. */
export interface TopicCandidate {
  title: string
  tags: BlogTag[]
  angle: string
  why: string
}

export function buildTopicPrompt(input: {
  today: Date
  inventory: readonly InventoryItem[]
}): string {
  const window = editorialWindow(input.today)
  const priorities = tagPriority(input.inventory)

  const seasonal = window.months
    .map(month => `${MONTHS_FR[month - 1]} :\n${SEASONAL_CALENDAR[month].map(theme => `  - ${theme}`).join('\n')}`)
    .join('\n')

  const inventory = input.inventory.length === 0
    ? '  (aucun article pour l’instant)'
    : input.inventory
      .map(item => `  - ${item.title} — ${item.tags.join(', ')} — ${MONTHS_FR[item.date.getUTCMonth()]} ${item.date.getUTCFullYear()} (${item.status})`)
      .join('\n')

  const tags = priorities
    .map(({ tag, count }) => `  - ${tag} (${BLOG_TAG_LABELS[tag]}) : ${count} article(s)`)
    .join('\n')

  return `Tu choisis le prochain sujet du blog de Growi, une appli qui aide les particuliers à entretenir leur jardin, leur potager et leurs plantes d'intérieur en France métropolitaine.

Nous sommes le ${frenchDate(input.today)}. L'article sortira dans quelques jours et doit être utile au lecteur entre le ${frenchDate(window.from)} et le ${frenchDate(window.to)}.

Thèmes de saison pour cette période (choisis parmi eux, ou un sujet très proche) :
${seasonal}

Articles déjà écrits ou en préparation — ne propose rien qui leur ressemble :
${inventory}

Tags possibles, du moins fourni au plus fourni — privilégie les premiers :
${tags}

Propose exactement 3 sujets, du meilleur au moins bon. Pour chacun :
- "title" : le titre de l'article, 20 à 80 caractères, concret, sans point d'exclamation ;
- "tags" : 1 ou 2 tags parmi ${AUTO_TAGS.map(tag => `"${tag}"`).join(', ')} ;
- "angle" : en une phrase, ce que l'article apprend précisément au lecteur ;
- "why" : en une phrase, pourquoi ce sujet maintenant (saison, tag peu fourni…).

Réponds uniquement par ce JSON : {"candidates":[{"title":"…","tags":["…"],"angle":"…","why":"…"}]}`
}

/**
 * Consignes de rédaction. Chaque règle a une raison : le ton Growi, la
 * lisibilité sur mobile, ou le risque éditorial d'un conseil chiffré faux.
 */
export const ARTICLE_SYSTEM_PROMPT = `Tu rédiges un article pour le blog « Conseils » de Growi, une appli qui aide les particuliers à entretenir leur jardin, leur potager et leurs plantes d'intérieur, en France métropolitaine.

TON
- Tutoiement, toujours. Jamais « vous ».
- Concret : des seuils, des durées, des quantités, des repères visuels. Jamais « régulièrement », « suffisamment » ou « si besoin » sans chiffre ni repère.
- Saisonnier : l'article se lit au moment où le geste est à faire.
- Chaleureux et direct, sans emphase ni point d'exclamation en série.

STRUCTURE
- 800 à 1200 mots.
- Une introduction de 2 à 4 phrases, sans titre, qui dit ce que le lecteur va savoir faire.
- Un intertitre « ## » tous les 200 à 300 mots (au moins 3). Pas de « # » : le titre est affiché à part.
- Au moins un encadré, écrit exactement ainsi, seul sur ses lignes :
  <Callout tone="conseil" title="Titre court">Texte de l'encadré.</Callout>
  ou tone="attention" pour une mise en garde.
- Markdown et tableaux GFM autorisés. Aucune balise HTML, aucune image, aucun lien.
- Termine par une courte section pratique (récapitulatif, calendrier ou liste de vérification).

GROWI
- Mentionne Growi au plus deux fois, et seulement quand l'appli résout vraiment le problème du paragraphe : planning d'entretien calé sur la météo, diagnostic d'une plante à partir d'une photo, rappels.

INTERDITS ABSOLUS
- Le mot « IA », « intelligence artificielle », toute mention d'un modèle, d'un assistant, d'un outil de rédaction ou de la façon dont ce texte a été produit.
- Les personnes (prénoms, témoignages inventés), les marques, les prix.
- Les produits phytosanitaires de synthèse : privilégie les gestes, les solutions mécaniques et les préparations naturelles.

POUR LE RELECTEUR
- "reviewerNotes" : les chiffres, dates, doses, températures, durées et affirmations botaniques avancés dans l'article, formulés pour être vérifiés (ex. « Semer la phacélie jusqu'au 15 octobre »). **Entre 3 et 15 notes, jamais plus** : regroupe en une note les chiffres d'un même geste, et classe-les de la plus risquée (une erreur abîmerait une plante) à la moins risquée. Ces notes ne sont jamais publiées.

IMAGE DE COUVERTURE
- "coverPrompt" : en anglais, une photo documentaire du sujet concret de l'article (pas une image d'ambiance), dans un cadre français (muret de pierre, bâti ancien, terrasse en pierre), lumière naturelle rasante du matin ou de fin d'après-midi, "Natural documentary photography, shallow depth of field", palette verte et ocre chaude. Termine par "No people, no text, no logos, no watermark."
- "coverImageAlt" : en français, ce qu'on voit sur l'image, pas le sujet de l'article.

FORMAT DE RÉPONSE
Réponds uniquement par un objet JSON :
{"title":"…","slug":"…","excerpt":"…","tags":["…"],"mdx":"…","coverPrompt":"…","coverImageAlt":"…","reviewerNotes":["…"]}
- "title" : entre 30 et 70 caractères (80 est une limite dure).
- "slug" : le titre en minuscules, sans accents, mots séparés par des tirets.
- "excerpt" : entre 80 et 150 caractères (160 est une limite dure), donne envie de lire, sans répéter le titre.
- "tags" : 1 ou 2 parmi ${BLOG_TAGS.map(tag => `"${tag}"`).join(', ')}.
- "mdx" : le corps de l'article, sans le titre.`

export function buildArticlePrompt(input: {
  today: Date
  topic: { title: string; angle: string; tags: readonly string[] }
  /** Défauts de la version précédente, quand on la fait réécrire. */
  previousIssues?: readonly string[]
}): string {
  const lines = [
    `Nous sommes le ${frenchDate(input.today)}.`,
    '',
    'Sujet à traiter (entre les marqueurs) :',
    '"""',
    `Titre de travail : ${input.topic.title}`,
    `Angle : ${input.topic.angle}`,
    input.topic.tags.length > 0 ? `Tags : ${input.topic.tags.join(', ')}` : 'Tags : à choisir',
    '"""',
  ]
  if (input.previousIssues?.length) {
    lines.push(
      '',
      'Une première version a été refusée pour ces raisons. Corrige-les toutes :',
      ...input.previousIssues.map(issue => `- ${issue}`),
    )
  }
  return lines.join('\n')
}

// ─── Image de couverture ───────────────────────────────────────────────────

/** Clôture obligatoire de tout prompt d'image, ajoutée si le modèle l'oublie. */
export const COVER_PROMPT_CLOSING = 'No people, no text, no logos, no watermark.'

export function ensureCoverClosing(prompt: string): string {
  const trimmed = prompt.trim()
  return trimmed.toLowerCase().includes(COVER_PROMPT_CLOSING.toLowerCase())
    ? trimmed
    : `${trimmed.replace(/[.\s]*$/, '.')} ${COVER_PROMPT_CLOSING}`
}

// ─── Contrôles ─────────────────────────────────────────────────────────────

export const WORD_LIMITS = { min: 700, max: 1400 } as const
export const MIN_HEADINGS = 3
export const MIN_TUTOIEMENT = 5

/**
 * Tout ce qui trahirait le procédé de rédaction. Frontières de mots Unicode :
 * `\b` de JavaScript ignore les lettres accentuées, et « têtu » contiendrait
 * sinon un « tu ».
 */
const FORBIDDEN_TERMS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /(?<![\p{L}\p{N}])IA(?![\p{L}\p{N}])/iu, label: '« IA »' },
  { pattern: /intelligence\s+artificielle/iu, label: '« intelligence artificielle »' },
  { pattern: /en\s+tant\s+que\s+(?:mod[eè]le|assistant|IA)/iu, label: '« en tant que modèle/assistant »' },
  { pattern: /mod[eè]le\s+de\s+langage/iu, label: '« modèle de langage »' },
  { pattern: /(?<![\p{L}])assistant(?:e|s)?(?![\p{L}])/iu, label: '« assistant »' },
  { pattern: /chat\s*gpt/iu, label: '« ChatGPT »' },
  { pattern: /(?<![\p{L}])gemini(?![\p{L}])/iu, label: '« Gemini »' },
]

const word = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${w})(?![\\p{L}\\p{N}])`, 'giu')
const TUTOIEMENT = word('tu|ton|ta|tes|toi')
const VAGUE_TERMS = word('régulièrement|suffisamment|si besoin|si nécessaire|de temps en temps')
const VOUVOIEMENT = word('vous|votre|vos')

/** Retire les blocs de code : leur contenu ne compte ni en mots ni en balises. */
function withoutCode(mdx: string): string {
  return mdx.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
}

export function countWords(mdx: string): number {
  const text = withoutCode(mdx)
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[#>*_|[\]()-]+/g, ' ')
  return text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token)).length
}

/** Le texte lu, balises des composants retirées mais attributs (`title`) gardés. */
function readableText(mdx: string): string {
  return withoutCode(mdx).replace(/<\/?[A-Za-z]+/g, ' ')
}

/** Le procédé de rédaction ne doit jamais transparaître. Vide = aucun terme interdit. */
export function forbiddenTermsIn(text: string): string[] {
  return FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

export interface LintIssue {
  /** Stable, pour les tests et les traces. */
  code:
    | 'forbidden_term'
    | 'too_short'
    | 'too_long'
    | 'few_headings'
    | 'h1_in_body'
    | 'no_callout'
    | 'bad_callout_tone'
    | 'vouvoiement'
    | 'few_tutoiement'
    | 'raw_html'
    | 'external_link'
    | 'image_in_body'
    | 'vague_term'
  /** Phrase lisible, renvoyée telle quelle au modèle lors d'une réécriture. */
  message: string
  /** La longueur n'est qu'un avertissement quand un administrateur édite. */
  severity: 'error' | 'warning'
}

export interface LintOptions {
  /** Dans l'admin, l'humain a le dernier mot sur la longueur. */
  lengthAsWarning?: boolean
}

/**
 * Contrôles lexicaux et structurels d'un article (spec § 5.4, points 4 à 7).
 * La compilation MDX, elle, est faite par le service : elle demande le
 * compilateur, que ce module pur n'importe pas.
 */
export function lintArticle(
  article: { title: string; excerpt: string; mdx: string },
  options: LintOptions = {},
): LintIssue[] {
  const issues: LintIssue[] = []
  const lengthSeverity = options.lengthAsWarning ? 'warning' : 'error'
  const body = withoutCode(article.mdx)
  const text = readableText(article.mdx)

  const forbidden = forbiddenTermsIn(`${article.title}\n${article.excerpt}\n${text}`)
  if (forbidden.length > 0) {
    issues.push({
      code: 'forbidden_term',
      message: `Termes interdits : ${forbidden.join(', ')}. Aucune mention du procédé de rédaction.`,
      severity: 'error',
    })
  }

  const words = countWords(article.mdx)
  if (words < WORD_LIMITS.min) {
    issues.push({ code: 'too_short', message: `Trop court : ${words} mots, il en faut au moins ${WORD_LIMITS.min}.`, severity: lengthSeverity })
  } else if (words > WORD_LIMITS.max) {
    issues.push({ code: 'too_long', message: `Trop long : ${words} mots, ${WORD_LIMITS.max} au plus.`, severity: lengthSeverity })
  }

  const headings = body.match(/^##\s+\S/gm)?.length ?? 0
  if (headings < MIN_HEADINGS) {
    issues.push({ code: 'few_headings', message: `${headings} intertitre(s) « ## », il en faut au moins ${MIN_HEADINGS}.`, severity: 'error' })
  }
  if (/^#\s+\S/m.test(body)) {
    issues.push({ code: 'h1_in_body', message: 'Pas de titre « # » dans le corps : le titre est affiché à part.', severity: 'error' })
  }

  const callouts = [...body.matchAll(/<Callout\b([^>]*)>/g)]
  if (callouts.length === 0) {
    issues.push({ code: 'no_callout', message: 'Il faut au moins un encadré <Callout>.', severity: 'error' })
  }
  for (const [, attributes] of callouts) {
    const tone = attributes.match(/tone\s*=\s*"([^"]*)"/)?.[1]
    if (tone !== undefined && tone !== 'conseil' && tone !== 'attention') {
      issues.push({ code: 'bad_callout_tone', message: `Ton d'encadré inconnu : « ${tone} » (conseil ou attention).`, severity: 'error' })
    }
  }

  const vouvoiement = text.match(VOUVOIEMENT)?.length ?? 0
  if (vouvoiement > 0) {
    issues.push({ code: 'vouvoiement', message: `Vouvoiement relevé ${vouvoiement} fois : tutoiement uniquement.`, severity: 'error' })
  }
  const tutoiement = text.match(TUTOIEMENT)?.length ?? 0
  if (tutoiement < MIN_TUTOIEMENT) {
    issues.push({ code: 'few_tutoiement', message: `Tutoiement trop rare (${tutoiement}) : adresse-toi au lecteur.`, severity: 'error' })
  }

  // Toute balise qui n'est ni un Callout ni une vidéo est du HTML brut.
  const rawTag = body.match(/<\/?(?!(?:Callout|YouTube)\b)[A-Za-z!][^>]*>/)
  if (rawTag) {
    issues.push({ code: 'raw_html', message: `Balise non autorisée : ${rawTag[0].slice(0, 40)}.`, severity: 'error' })
  }
  if (/https?:\/\/|www\./i.test(body)) {
    issues.push({ code: 'external_link', message: 'Aucun lien externe dans le corps.', severity: 'error' })
  }
  if (/!\[[^\]]*\]\(/.test(body)) {
    issues.push({ code: 'image_in_body', message: 'Aucune image dans le corps de l’article.', severity: 'error' })
  }

  // Le prompt les interdit sans chiffre. Pas bloquant — « arroser suffisamment
  // pour que l'eau ressorte sous le pot » est précis — mais le relecteur doit
  // les voir.
  const vague = [...new Set(text.match(VAGUE_TERMS)?.map(term => term.toLowerCase()))]
  if (vague.length > 0) {
    issues.push({
      code: 'vague_term',
      message: `Termes vagues à préciser : ${vague.map(term => `« ${term} »`).join(', ')}.`,
      severity: 'warning',
    })
  }

  return issues
}

export const blockingIssues = (issues: readonly LintIssue[]) =>
  issues.filter(issue => issue.severity === 'error')
