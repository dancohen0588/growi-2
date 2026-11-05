/**
 * Bibliothèque de départ des « Secrets de jardinier » — les 24 astuces de la
 * spec (`16-analyse-moteur-reco-secrets.md` §5.3), relues.
 *
 * Ce fichier est la **source** du contenu initial : la migration
 * `…_garden_secrets` en a été générée (`pnpm --filter web secrets:seed --sql`),
 * et `secrets:seed` insère en base celles qui manquent, sans jamais écraser
 * une astuce retouchée depuis `/admin/secrets`. Une fois en base, c'est la
 * base qui fait foi.
 *
 * Règles d'écriture, les mêmes que pour le diagnostic et le blog :
 * - tutoiement ;
 * - aucune promesse au-delà du niveau de preuve affiché ;
 * - une précaution dès qu'un geste peut abîmer (sel, cendres, marc sur semis…) ;
 * - jamais le mot « IA ».
 */

import type { SecretConditions, SecretEvidence, SecretPlanche } from '@growi/shared'

import { PLANCHES_LOT1 } from './planches/lot1'

export interface SecretSeed {
  slug: string
  title: string
  teaser: string
  story?: string
  /** Étapes, une par ligne. */
  recipe: string
  ingredients: string[]
  evidence: SecretEvidence
  cautions?: string
  prepDays?: number
  effortMinutes?: number
  cooldownDays?: number
  conditions: SecretConditions
  /** La planche BD, quand le secret est dessiné (`@growi/shared` `SECRET_ART`). */
  planche?: SecretPlanche
}

const ALL_YEAR = undefined
const GARDEN = ['OUTDOOR', 'BALCONY', 'GREENHOUSE'] as const
const ACID_LOVERS = ['Hydrangea', 'Rhododendron', 'Camellia', 'Pieris', 'Skimmia', 'Vaccinium', 'Erica', 'Calluna', 'Gardenia', 'Azalea']

const BASE_LIBRARY: SecretSeed[] = [
  {
    slug: 'coquilles-godets',
    title: 'Des godets en coquille d’œuf',
    teaser: 'Ne jette pas tes coquilles d’œuf ce matin : elles font de parfaits godets.',
    story:
      'Les jardiniers économes en faisaient des pots à semis bien avant le plastique. La coquille se met en terre avec le plant : pas de racines arrachées au repiquage.',
    recipe: [
      'Garde des demi-coquilles bien entières, rince-les à l’eau claire.',
      'Perce le fond d’un petit trou avec une aiguille, pour que l’eau s’écoule.',
      'Remplis de terreau à semis, sème une ou deux graines, tasse du doigt.',
      'Cale les coquilles dans la boîte à œufs, près d’une fenêtre lumineuse.',
      'Au repiquage, écrase légèrement la coquille et plante le tout.',
    ].join('\n'),
    ingredients: ['coquilles d’œuf', 'terreau à semis', 'boîte à œufs'],
    evidence: 'PROVEN',
    cautions: 'Rince bien les coquilles : un reste de blanc moisit vite au chaud.',
    effortMinutes: 15,
    conditions: { months: [2, 3, 4], categories: ['VEGETABLE', 'HERBS'] },
  },
  {
    slug: 'coquilles-pied',
    title: 'Le calcium caché des coquilles',
    teaser: 'Tes coquilles d’œuf renferment un trésor de calcium. Encore faut-il savoir le libérer.',
    story:
      'On les émiette au pied des tomates depuis des générations, pour éviter le « cul noir ». La coquille est bien faite de calcium, mais elle le rend à la terre très lentement — en années, pas en semaines.',
    recipe: [
      'Fais sécher les coquilles quelques jours, puis broie-les le plus fin possible.',
      'Ajoute la poudre au compost, ou griffe-la en surface au pied de la plante.',
      'Pour le cul noir des tomates, la vraie parade est ailleurs : un arrosage régulier, sans à-coups.',
    ].join('\n'),
    ingredients: ['coquilles d’œuf séchées'],
    evidence: 'FOLK',
    cautions:
      'L’effet est lent et modeste. Le cul noir vient d’un arrosage irrégulier bien plus que d’un manque de calcium dans le sol.',
    effortMinutes: 10,
    conditions: { months: [3, 4, 5, 6, 9, 10, 11], categories: ['VEGETABLE'], locations: [...GARDEN] },
  },
  {
    slug: 'eau-banane',
    title: 'L’eau dorée des rosiers',
    teaser: 'Trois peaux de banane, un litre d’eau, trois jours de patience…',
    story:
      'La peau de banane contient du potassium, l’élément des fleurs. Les rosiéristes amateurs en font macérer une eau qu’ils versent au pied pendant la floraison.',
    recipe: [
      'Coupe 2 ou 3 peaux de banane en morceaux.',
      'Plonge-les dans 1 litre d’eau, dans un bocal fermé, à l’ombre.',
      'Laisse macérer 3 jours, pas plus.',
      'Filtre, dilue de moitié avec de l’eau, et arrose au pied.',
    ].join('\n'),
    ingredients: ['peaux de banane', 'eau', 'un bocal'],
    evidence: 'FOLK',
    cautions:
      'L’apport réel est faible. Au-delà de quelques jours, l’eau sent mauvais et attire les moucherons. Enterrer simplement la peau au pied marche aussi bien.',
    prepDays: 3,
    effortMinutes: 5,
    conditions: { months: [4, 5, 6, 7, 8], genera: ['Rosa'], locations: [...GARDEN] },
  },
  {
    slug: 'purin-ortie',
    title: 'Le purin qui réveille le potager',
    teaser: 'Une plante que tout le monde arrache cache le meilleur fortifiant du potager.',
    story:
      'Riche en azote, l’ortie fermentée est le fortifiant fétiche des potagers bio. Son effet est réel, surtout sur la vigueur des feuilles ; ses vertus contre les maladies, elles, restent discutées.',
    recipe: [
      'Cueille 1 kg d’orties avant la floraison (avec des gants).',
      'Hache-les grossièrement et plonge-les dans 10 litres d’eau de pluie, dans un seau non métallique.',
      'Couvre sans fermer, et remue chaque jour.',
      'Quand il ne se forme plus de bulles (10 à 15 jours), filtre.',
      'Dilue à 10 % — un litre de purin pour dix d’eau — et arrose au pied.',
    ].join('\n'),
    ingredients: ['1 kg d’orties', '10 L d’eau de pluie', 'un seau'],
    evidence: 'PLAUSIBLE',
    cautions:
      'Odeur très forte : prépare-le loin de la maison. Jamais pur, ni sur des semis ou une plante malade. Garde un pied sans purin pour comparer.',
    prepDays: 12,
    effortMinutes: 20,
    conditions: { months: [4, 5, 6], categories: ['VEGETABLE'], locations: [...GARDEN], healthStatus: ['HEALTHY'] },
  },
  {
    slug: 'prele',
    title: 'La plante préhistorique contre les champignons',
    teaser: 'Elle poussait déjà du temps des dinosaures. Ses tiges protègent tes feuilles.',
    story:
      'La prêle est chargée de silice, qui durcirait la surface des feuilles. On la pulvérise en prévention, avant que les taches n’apparaissent.',
    recipe: [
      'Fais tremper 100 g de prêle séchée dans 1 litre d’eau pendant 24 heures.',
      'Le lendemain, fais bouillir doucement une heure, à couvert.',
      'Laisse refroidir, filtre.',
      'Dilue à 20 % (un volume pour quatre d’eau) et pulvérise sur le feuillage, par temps sec.',
    ].join('\n'),
    ingredients: ['100 g de prêle séchée', 'eau', 'un pulvérisateur'],
    evidence: 'PLAUSIBLE',
    cautions: 'Un geste de prévention : sur une maladie déjà installée, il ne suffit pas.',
    prepDays: 1,
    effortMinutes: 20,
    conditions: { months: [4, 5, 6, 7], genera: ['Rosa', 'Solanum', 'Vitis'], locations: [...GARDEN] },
  },
  {
    slug: 'lait-oidium',
    title: 'Un verre de lait contre le blanc',
    teaser: 'Par temps chaud, un voile blanc menace tes feuilles. La parade est dans ton frigo.',
    story:
      'Des essais sur courgettes et vigne ont montré qu’un lait dilué freine l’oïdium, ce feutrage blanc des feuilles. Le soleil y aiderait : il active les protéines du lait.',
    recipe: [
      'Mélange 1 volume de lait (demi-écrémé convient) pour 9 volumes d’eau.',
      'Pulvérise les deux faces des feuilles, un matin ensoleillé.',
      'Recommence une fois par semaine tant qu’il fait chaud.',
    ].join('\n'),
    ingredients: ['lait', 'eau', 'un pulvérisateur'],
    evidence: 'PLAUSIBLE',
    cautions: 'Essaie d’abord sur une feuille. Si une odeur aigre apparaît, rince à l’eau claire.',
    effortMinutes: 10,
    conditions: {
      months: [6, 7, 8, 9],
      families: ['Cucurbitaceae'],
      locations: [...GARDEN],
      weather: { tempMaxAbove: 22 },
    },
  },
  {
    slug: 'bicarbonate',
    title: 'Le placard de la cuisine contre l’oïdium',
    teaser: 'Une pincée d’un produit que tu as sûrement sous l’évier…',
    story:
      'Le bicarbonate rend la surface des feuilles moins accueillante pour les champignons. Il agit en prévention et au tout début d’une attaque.',
    recipe: [
      'Dissous 5 g de bicarbonate de soude (une cuillère à café rase) dans 1 litre d’eau.',
      'Ajoute une goutte de savon noir pour que le mélange accroche.',
      'Pulvérise le feuillage en fin de journée.',
    ].join('\n'),
    ingredients: ['bicarbonate de soude', 'savon noir', 'eau'],
    evidence: 'PLAUSIBLE',
    cautions: 'Pas plus d’une fois tous les dix jours : le sodium s’accumule dans le sol.',
    effortMinutes: 5,
    conditions: { months: [5, 6, 7, 8, 9], genera: ['Rosa', 'Vitis'], locations: [...GARDEN] },
  },
  {
    slug: 'savon-noir',
    title: 'Le shampooing anti-pucerons',
    teaser: 'Les pucerons détestent un produit que ta grand-mère utilisait pour les sols.',
    story:
      'Le savon noir colle et asphyxie les pucerons, sans rester dans la plante. C’est l’un des rares remèdes maison dont l’efficacité est bien établie.',
    recipe: [
      'Dilue 15 à 30 g de savon noir liquide (une à deux cuillères à soupe) dans 1 litre d’eau tiède.',
      'Pulvérise surtout le dessous des feuilles et les jeunes pousses.',
      'Recommence trois jours plus tard si des pucerons restent.',
    ].join('\n'),
    ingredients: ['savon noir liquide', 'eau tiède', 'un pulvérisateur'],
    evidence: 'PROVEN',
    cautions:
      'Jamais en plein soleil. Prends du vrai savon noir, sans additif. Rince à l’eau claire les feuilles fragiles le lendemain.',
    effortMinutes: 10,
    conditions: { months: [4, 5, 6, 7], categories: ['VEGETABLE', 'FLOWERS', 'TREES_SHRUBS', 'CLIMBING'] },
  },
  {
    slug: 'ail-decoction',
    title: 'Une gousse d’ail pour les pucerons',
    teaser: 'L’odeur qui chasse les vampires chasse aussi quelques petites bêtes.',
    story:
      'L’ail contient des composés soufrés à l’odeur forte, qui dérangeraient pucerons et acariens. Un répulsif doux, à renouveler.',
    recipe: [
      'Écrase 5 gousses d’ail dans 1 litre d’eau.',
      'Porte à ébullition, puis laisse infuser à couvert jusqu’à refroidissement.',
      'Filtre et pulvérise sur les pousses attaquées.',
    ].join('\n'),
    ingredients: ['5 gousses d’ail', 'eau'],
    evidence: 'PLAUSIBLE',
    cautions: 'L’effet ne dure que quelques jours : recommence après une pluie.',
    effortMinutes: 15,
    conditions: { months: [4, 5, 6], genera: ['Rosa'], locations: [...GARDEN] },
  },
  {
    slug: 'ail-rosier',
    title: 'Le secret des vieux rosiéristes',
    teaser: 'Les anciens plantaient quelque chose au pied de leurs rosiers. Devine quoi.',
    story:
      'Quelques gousses d’ail plantées au pied du rosier : la tradition dit qu’elles l’éloignent des maladies et des pucerons. Rien ne l’a démontré, mais l’ail y pousse bien — et tu récolteras des tiges vertes au printemps.',
    recipe: [
      'Choisis 4 ou 5 gousses d’ail bien fermes.',
      'Plante-les pointe en haut, à 3 cm de profondeur, à 20 cm du pied du rosier.',
      'Laisse-les pousser : coupe les tiges au printemps pour la cuisine.',
    ].join('\n'),
    ingredients: ['gousses d’ail'],
    evidence: 'FOLK',
    cautions: 'Un effet contre les maladies n’a jamais été démontré : c’est une tradition, et une récolte en prime.',
    effortMinutes: 10,
    conditions: { months: [10, 11, 2, 3], genera: ['Rosa'], locations: ['OUTDOOR'] },
  },
  {
    slug: 'piege-biere',
    title: 'L’apéro des limaces',
    teaser: 'Les limaces ont un faible. Sers-leur à boire, elles ne reviendront pas.',
    story:
      'Attirées par l’odeur de la fermentation, les limaces se noient dans la bière. Le piège est efficace, à condition de le relever souvent.',
    recipe: [
      'Enterre un gobelet près des plantes attaquées, le rebord à 1 cm au-dessus du sol.',
      'Remplis-le à moitié de bière, même bon marché.',
      'Vide et remplis de nouveau tous les deux ou trois jours.',
    ].join('\n'),
    ingredients: ['un gobelet', 'de la bière'],
    evidence: 'PROVEN',
    cautions:
      'Le rebord au-dessus du sol épargne les carabes, ces coléoptères qui mangent les limaces : ce sont tes alliés.',
    effortMinutes: 5,
    conditions: { months: [3, 4, 5, 6, 9, 10], categories: ['VEGETABLE', 'HERBS'], locations: ['OUTDOOR'] },
  },
  {
    slug: 'marc-cafe',
    title: 'Le marc de café, mais bien dosé',
    teaser: 'Ton café du matin peut nourrir la terre. À une condition.',
    story:
      'Le marc apporte un peu d’azote et de matière organique, et les vers de terre l’adorent. Mais en couche épaisse il se tasse, moisit, et freine la germination.',
    recipe: [
      'Fais sécher le marc sur une assiette quelques jours.',
      'Mélange-le au compost, ou griffe une fine couche dans la terre au pied de la plante.',
      'Une poignée par mois suffit.',
    ].join('\n'),
    ingredients: ['marc de café séché'],
    evidence: 'PLAUSIBLE',
    cautions: 'Jamais sur des semis, ni en couche épaisse posée sur le sol.',
    effortMinutes: 5,
    conditions: {
      months: [3, 4, 5, 6, 7, 8, 9, 10, 11],
      categories: ['VEGETABLE', 'FLOWERS', 'TREES_SHRUBS'],
      locations: [...GARDEN],
    },
  },
  {
    slug: 'marc-hortensia',
    title: 'Le marc de café rend-il la terre acide ?',
    teaser: 'Une idée répandue chez les amoureux d’hortensias. Elle ne tient pas.',
    story:
      'Le café en grain est acide, mais l’acidité part dans ta tasse : le marc usé est presque neutre. Il ne changera pas le sol d’une plante de terre de bruyère.',
    recipe: [
      'Pour une plante qui aime l’acidité, arrose à l’eau de pluie plutôt qu’à l’eau du robinet, souvent calcaire.',
      'Au printemps, ajoute de la terre de bruyère ou un paillis d’aiguilles de pin au pied.',
      'Le marc peut aller au compost : il y sera utile, mais pour d’autres raisons.',
    ].join('\n'),
    ingredients: ['eau de pluie', 'terre de bruyère'],
    evidence: 'MYTH',
    effortMinutes: 10,
    conditions: { months: [3, 4, 5, 6, 7, 8, 9, 10], genera: ACID_LOVERS },
  },
  {
    slug: 'clous-hortensia',
    title: 'Des clous rouillés pour des hortensias bleus ?',
    teaser: 'On enterre des clous au pied des hortensias pour les bleuir. Vrai ou faux ?',
    story:
      'Faux : ce n’est pas le fer qui bleuit l’hortensia, c’est l’aluminium, que la plante n’absorbe que dans un sol acide. Les clous ne font que rouiller.',
    recipe: [
      'Pour garder un hortensia bleu, maintiens un sol acide : eau de pluie, terre de bruyère au printemps.',
      'Un engrais « hortensias bleus » apporte l’aluminium qui manque.',
      'Sur un sol calcaire, il restera rose — et c’est très bien aussi.',
    ].join('\n'),
    ingredients: ['eau de pluie', 'terre de bruyère'],
    evidence: 'MYTH',
    effortMinutes: 5,
    conditions: { months: [3, 4, 5, 6, 7, 8, 9], genera: ['Hydrangea'] },
  },
  {
    slug: 'cendres',
    title: 'La potasse des cendres de cheminée',
    teaser: 'Ta cheminée produit un engrais. Ne le jette pas — mais ne le mets pas partout.',
    story:
      'Les cendres de bois sont riches en potasse et en calcaire. Les potagers d’autrefois les recevaient chaque hiver, en fine couche.',
    recipe: [
      'Attends que les cendres soient parfaitement froides, plusieurs jours.',
      'Tamise-les pour retirer les morceaux de charbon.',
      'Répands une fine couche — une poignée par mètre carré — sur la terre, une fois par an.',
    ].join('\n'),
    ingredients: ['cendres de bois froides'],
    evidence: 'PROVEN',
    cautions:
      'Jamais sur les plantes de terre de bruyère ni sur un sol déjà calcaire. Seulement du bois non traité : ni charbon de barbecue, ni bois peint ou aggloméré.',
    effortMinutes: 10,
    cooldownDays: 300,
    conditions: {
      months: [11, 12, 1, 2],
      categories: ['VEGETABLE', 'TREES_SHRUBS', 'FLOWERS'],
      locations: ['OUTDOOR'],
      excludeFamilies: ['Ericaceae'],
      excludeGenera: ACID_LOVERS,
    },
  },
  {
    slug: 'eau-cuisson',
    title: 'L’eau des légumes, deuxième service',
    teaser: 'L’eau dans laquelle tu as cuit tes légumes peut servir deux fois.',
    story:
      'Une partie des minéraux des légumes passe dans l’eau de cuisson. Refroidie, elle remplace un arrosage — un petit geste circulaire, plus qu’un engrais.',
    recipe: [
      'Garde l’eau de cuisson des légumes ou des œufs, sans sel ni matière grasse.',
      'Laisse-la refroidir complètement.',
      'Arrose comme d’habitude, à la place de l’eau du robinet.',
    ].join('\n'),
    ingredients: ['eau de cuisson non salée'],
    evidence: 'FOLK',
    cautions: 'Jamais salée ni grasse : le sel brûle les racines, surtout en pot.',
    effortMinutes: 2,
    conditions: { months: ALL_YEAR, locations: ['INDOOR', 'BALCONY'] },
    planche: {
      panels: [
        {
          art: 'eau-cuisson/1',
          caption: 'Garde l’eau de cuisson des légumes, sans sel ni matière grasse.',
          emphasis: 'sans sel ni matière grasse',
        },
        { art: 'eau-cuisson/2', caption: 'Laisse-la refroidir complètement : tiède, jamais chaude.', emphasis: 'refroidir complètement' },
        {
          art: 'eau-cuisson/3',
          caption: 'Arrose ta plante avec, à la place de l’eau du robinet.',
          emphasis: 'à la place de l’eau du robinet',
        },
      ],
      caution: {
        art: 'eau-cuisson/caution',
        title: 'Jamais salée ni grasse.',
        text: 'Le sel brûle les racines, surtout en pot. Si tu as salé ta cuisson, cette eau-là va à l’évier.',
      },
    },
  },
  {
    slug: 'eau-riz',
    title: 'L’eau de rinçage du riz',
    teaser: 'Avant de cuire ton riz, garde son premier rinçage.',
    story:
      'Une tradition venue d’Asie : l’eau trouble du rinçage contient un peu d’amidon et de minéraux. Certains jurent qu’elle fait briller les feuilles.',
    recipe: [
      'Rince ton riz une fois, et garde cette première eau.',
      'Arrose ta plante avec, à la place d’un arrosage ordinaire.',
      'Une fois par mois suffit.',
    ].join('\n'),
    ingredients: ['eau de rinçage du riz'],
    evidence: 'FOLK',
    cautions: 'L’amidon peut faire moisir une terre qui reste humide : seulement sur un terreau qui sèche bien entre deux arrosages.',
    effortMinutes: 2,
    conditions: { months: ALL_YEAR, locations: ['INDOOR'] },
  },
  {
    slug: 'saule-bouture',
    title: 'L’hormone cachée dans le saule',
    teaser: 'Un arbre au bord de l’eau sait faire pousser des racines à tes boutures.',
    story:
      'Les rameaux de saule contiennent des substances qui favorisent l’enracinement. Leur eau de trempage sert d’hormone de bouturage naturelle.',
    recipe: [
      'Coupe une poignée de jeunes rameaux de saule, en morceaux de 5 cm.',
      'Fais-les tremper 24 heures dans un verre d’eau.',
      'Le lendemain, prélève tes boutures et laisse leur pied tremper quelques heures dans cette eau.',
      'Plante-les dans un mélange de terreau et de sable, à l’ombre légère.',
    ].join('\n'),
    ingredients: ['rameaux de saule', 'eau', 'terreau', 'sable'],
    evidence: 'PLAUSIBLE',
    prepDays: 1,
    effortMinutes: 20,
    conditions: {
      months: [3, 4, 9, 10],
      genera: ['Rosa', 'Lavandula', 'Salvia', 'Rosmarinus', 'Hydrangea', 'Forsythia', 'Buddleja', 'Ficus'],
    },
  },
  {
    slug: 'cannelle-semis',
    title: 'La cannelle contre la fonte des semis',
    teaser: 'Ton placard à épices protège tes semis d’un champignon redoutable.',
    story:
      'La « fonte des semis » couche les jeunes plants d’un coup, à cause d’un champignon. La cannelle a un effet antifongique léger qui en freinerait l’apparition.',
    recipe: [
      'Après le semis, saupoudre une très fine pellicule de cannelle en poudre sur le terreau.',
      'Arrose par le dessous, en remplissant la soucoupe.',
      'Aère la mini-serre chaque jour.',
    ].join('\n'),
    ingredients: ['cannelle en poudre'],
    evidence: 'PLAUSIBLE',
    cautions: 'La meilleure protection reste un terreau propre, un arrosage modéré et de l’air.',
    effortMinutes: 2,
    conditions: { months: [2, 3, 4], categories: ['VEGETABLE', 'HERBS'] },
  },
  {
    slug: 'capucines',
    title: 'La plante sacrifiée',
    teaser: 'Il existe une fleur que les pucerons préfèrent à tes légumes.',
    story:
      'Les capucines attirent les pucerons noirs, qui s’y installent plutôt que sur les fèves ou les choux voisins. Une plante « piège », jolie en prime — et ses fleurs se mangent.',
    recipe: [
      'Sème 3 ou 4 graines de capucine en bordure du potager, à 2 cm de profondeur.',
      'Arrose légèrement jusqu’à la levée.',
      'Surveille-les : quand les pucerons s’y regroupent, coupe et jette les tiges les plus envahies.',
    ].join('\n'),
    ingredients: ['graines de capucine'],
    evidence: 'PLAUSIBLE',
    cautions: 'Sans surveillance, la plante piège devient un foyer qui essaime.',
    effortMinutes: 10,
    conditions: { months: [4, 5], categories: ['VEGETABLE'], locations: ['OUTDOOR'] },
  },
  {
    slug: 'oeillets-inde',
    title: 'Les gardes du corps des tomates',
    teaser: 'Une fleur orange monte la garde au pied des tomates depuis des générations.',
    story:
      'Les racines des œillets d’Inde libèrent des substances qui gênent certains vers microscopiques du sol, les nématodes. Leur odeur forte dérouterait aussi quelques insectes.',
    recipe: [
      'Plante un œillet d’Inde tous les deux ou trois pieds de tomate.',
      'Arrose-les en même temps que les tomates.',
      'Laisse-les en place toute la saison.',
    ].join('\n'),
    ingredients: ['plants d’œillets d’Inde'],
    evidence: 'PLAUSIBLE',
    effortMinutes: 15,
    conditions: { months: [4, 5, 6], genera: ['Solanum'], locations: [...GARDEN] },
  },
  {
    slug: 'bouteille-oya',
    title: 'Le goutte-à-goutte en bouteille',
    teaser: 'Tu pars quelques jours ? Une bouteille vide peut arroser à ta place.',
    story:
      'Le principe des oyas, ces jarres en terre enterrées des jardins d’autrefois : l’eau rejoint les racines lentement, sans s’évaporer en surface.',
    recipe: [
      'Perce 3 ou 4 petits trous dans le bouchon d’une bouteille en plastique.',
      'Coupe le fond, enterre la bouteille goulot en bas, près des racines.',
      'Remplis par le haut : elle se vide en un à trois jours.',
    ].join('\n'),
    ingredients: ['une bouteille en plastique', 'un clou pour percer'],
    evidence: 'PROVEN',
    cautions: 'Essaie avant de partir pour régler le débit : trop de trous, et la bouteille se vide en une heure.',
    effortMinutes: 10,
    conditions: { months: [6, 7, 8], locations: ['OUTDOOR', 'BALCONY'] },
  },
  {
    slug: 'feuilles-mortes',
    title: 'L’or brun de novembre',
    teaser: 'Ce que tes voisins mettent en sac, les jardiniers malins le gardent précieusement.',
    story:
      'En forêt, personne ne ramasse les feuilles : elles protègent le sol du froid et deviennent humus. Au jardin, c’est un paillis gratuit — et dans un an, un terreau de feuilles très recherché.',
    recipe: [
      'Ramasse les feuilles mortes saines.',
      'Étale-les en couche de 5 à 10 cm au pied des massifs et des arbustes.',
      'Le surplus va en tas ou dans un sac percé : dans un an, tu auras du terreau.',
    ].join('\n'),
    ingredients: ['feuilles mortes'],
    evidence: 'PROVEN',
    cautions: 'Écarte les feuilles malades, comme celles des rosiers tachés de noir : la maladie y passe l’hiver.',
    effortMinutes: 30,
    cooldownDays: 300,
    conditions: {
      months: [10, 11, 12],
      categories: ['TREES_SHRUBS', 'FLOWERS', 'VEGETABLE'],
      locations: ['OUTDOOR'],
    },
  },
  {
    slug: 'lune',
    title: 'Jour racine, jour feuille…',
    teaser: 'Selon la tradition, la Lune décide du meilleur jour pour chaque geste.',
    story:
      'Les calendriers lunaires classent chaque jour selon la constellation devant laquelle passe la Lune : racine, feuille, fleur ou fruit. Aucune étude n’a montré d’effet sur les cultures. Beaucoup de jardiniers les suivent quand même — pour le rythme, et le plaisir.',
    recipe: [
      'Regarde le bandeau lunaire de ton planning : il te dit le type du jour.',
      'Jour racine : carottes, radis, poireaux. Jour feuille : salades, épinards. Jour fleur : fleurs et bulbes. Jour fruit : tomates, haricots, fraisiers.',
      'Sème ou repique ce qui correspond, et note ce que tu observes.',
    ].join('\n'),
    ingredients: [],
    evidence: 'FOLK',
    cautions: 'Aucune preuve scientifique : 100 % tradition, 100 % plaisir.',
    effortMinutes: 5,
    conditions: { months: [2, 3, 4, 5, 6, 7, 8, 9, 10], categories: ['VEGETABLE', 'HERBS'], lunarOnly: true },
  },
]

/** Les planches livrées par lots (`planches/`), validées dans Claude Design. */
const PLANCHES: Readonly<Record<string, SecretPlanche>> = { ...PLANCHES_LOT1 }

export const SECRET_LIBRARY: SecretSeed[] = BASE_LIBRARY.map((seed) =>
  seed.planche || !PLANCHES[seed.slug] ? seed : { ...seed, planche: PLANCHES[seed.slug] },
)
