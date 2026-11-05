-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lunarCalendar" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "care_logs" ADD COLUMN     "tipSlug" TEXT,
ADD COLUMN     "tipVerdict" TEXT,
ADD COLUMN     "tipVerdictAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "garden_tips" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "teaser" TEXT NOT NULL,
    "story" TEXT,
    "recipe" TEXT NOT NULL,
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" TEXT NOT NULL,
    "cautions" TEXT,
    "prepDays" INTEGER NOT NULL DEFAULT 0,
    "effortMinutes" INTEGER,
    "cooldownDays" INTEGER NOT NULL DEFAULT 120,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garden_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garden_tip_picks" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garden_tip_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "revealedAt" TIMESTAMPTZ(6),
    "dismissedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garden_tips_slug_key" ON "garden_tips"("slug");

-- CreateIndex
CREATE INDEX "garden_tips_status_idx" ON "garden_tips"("status");

-- CreateIndex
CREATE INDEX "garden_tip_picks_plantInstanceId_idx" ON "garden_tip_picks"("plantInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "garden_tip_picks_gardenId_week_key" ON "garden_tip_picks"("gardenId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "user_tips_userId_slug_key" ON "user_tips"("userId", "slug");

-- CreateIndex
CREATE INDEX "care_logs_tipSlug_idx" ON "care_logs"("tipSlug");

-- AddForeignKey
ALTER TABLE "garden_tip_picks" ADD CONSTRAINT "garden_tip_picks_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garden_tip_picks" ADD CONSTRAINT "garden_tip_picks_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tips" ADD CONSTRAINT "user_tips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bibliothèque de départ : les 24 secrets de la spec (lib/secrets/library.ts),
-- générés par `pnpm --filter web secrets:seed --sql`. Une astuce déjà en base
-- n'est jamais écrasée.
INSERT INTO "garden_tips" ("id", "slug", "title", "teaser", "story", "recipe", "ingredients", "evidence", "cautions", "prepDays", "effortMinutes", "cooldownDays", "conditions", "status") VALUES
  ('tip_5cf26ec5065588717895', 'coquilles-godets', 'Des godets en coquille d’œuf', 'Ne jette pas tes coquilles d’œuf ce matin : elles font de parfaits godets.', 'Les jardiniers économes en faisaient des pots à semis bien avant le plastique. La coquille se met en terre avec le plant : pas de racines arrachées au repiquage.', 'Garde des demi-coquilles bien entières, rince-les à l’eau claire.
Perce le fond d’un petit trou avec une aiguille, pour que l’eau s’écoule.
Remplis de terreau à semis, sème une ou deux graines, tasse du doigt.
Cale les coquilles dans la boîte à œufs, près d’une fenêtre lumineuse.
Au repiquage, écrase légèrement la coquille et plante le tout.', ARRAY['coquilles d’œuf', 'terreau à semis', 'boîte à œufs']::TEXT[], 'PROVEN', 'Rince bien les coquilles : un reste de blanc moisit vite au chaud.', 0, 15, 120, '{"categories":["VEGETABLE","HERBS","FLOWERS"],"months":[2,3,4]}'::jsonb, 'PUBLISHED'),
  ('tip_b02681994dcbcbf41545', 'coquilles-pied', 'Le calcium caché des coquilles', 'Tes coquilles d’œuf renferment un trésor de calcium. Encore faut-il savoir le libérer.', 'On les émiette au pied des tomates depuis des générations, pour éviter le « cul noir ». La coquille est bien faite de calcium, mais elle le rend à la terre très lentement — en années, pas en semaines.', 'Fais sécher les coquilles quelques jours, puis broie-les le plus fin possible.
Ajoute la poudre au compost, ou griffe-la en surface au pied de la plante.
Pour le cul noir des tomates, la vraie parade est ailleurs : un arrosage régulier, sans à-coups.', ARRAY['coquilles d’œuf séchées']::TEXT[], 'FOLK', 'L’effet est lent et modeste. Le cul noir vient d’un arrosage irrégulier bien plus que d’un manque de calcium dans le sol.', 0, 10, 120, '{"categories":["VEGETABLE"],"months":[3,4,5,6,9,10,11],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_4c03e0712f8405f2f177', 'eau-banane', 'L’eau dorée des rosiers', 'Trois peaux de banane, un litre d’eau, trois jours de patience…', 'La peau de banane contient du potassium, l’élément des fleurs. Les rosiéristes amateurs en font macérer une eau qu’ils versent au pied pendant la floraison.', 'Coupe 2 ou 3 peaux de banane en morceaux.
Plonge-les dans 1 litre d’eau, dans un bocal fermé, à l’ombre.
Laisse macérer 3 jours, pas plus.
Filtre, dilue de moitié avec de l’eau, et arrose au pied.', ARRAY['peaux de banane', 'eau', 'un bocal']::TEXT[], 'FOLK', 'L’apport réel est faible. Au-delà de quelques jours, l’eau sent mauvais et attire les moucherons. Enterrer simplement la peau au pied marche aussi bien.', 3, 5, 120, '{"genera":["Rosa"],"months":[4,5,6,7,8],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_d4fc2a8180bc2001e40d', 'purin-ortie', 'Le purin qui réveille le potager', 'Une plante que tout le monde arrache cache le meilleur fortifiant du potager.', 'Riche en azote, l’ortie fermentée est le fortifiant fétiche des potagers bio. Son effet est réel, surtout sur la vigueur des feuilles ; ses vertus contre les maladies, elles, restent discutées.', 'Cueille 1 kg d’orties avant la floraison (avec des gants).
Hache-les grossièrement et plonge-les dans 10 litres d’eau de pluie, dans un seau non métallique.
Couvre sans fermer, et remue chaque jour.
Quand il ne se forme plus de bulles (10 à 15 jours), filtre.
Dilue à 10 % — un litre de purin pour dix d’eau — et arrose au pied.', ARRAY['1 kg d’orties', '10 L d’eau de pluie', 'un seau']::TEXT[], 'PLAUSIBLE', 'Odeur très forte : prépare-le loin de la maison. Jamais pur, ni sur des semis ou une plante malade. Garde un pied sans purin pour comparer.', 12, 20, 120, '{"categories":["VEGETABLE"],"months":[4,5,6],"locations":["OUTDOOR","BALCONY","GREENHOUSE"],"healthStatus":["HEALTHY"]}'::jsonb, 'PUBLISHED'),
  ('tip_fe5e1643f010a9bdcbaa', 'prele', 'La plante préhistorique contre les champignons', 'Elle poussait déjà du temps des dinosaures. Ses tiges protègent tes feuilles.', 'La prêle est chargée de silice, qui durcirait la surface des feuilles. On la pulvérise en prévention, avant que les taches n’apparaissent.', 'Fais tremper 100 g de prêle séchée dans 1 litre d’eau pendant 24 heures.
Le lendemain, fais bouillir doucement une heure, à couvert.
Laisse refroidir, filtre.
Dilue à 20 % (un volume pour quatre d’eau) et pulvérise sur le feuillage, par temps sec.', ARRAY['100 g de prêle séchée', 'eau', 'un pulvérisateur']::TEXT[], 'PLAUSIBLE', 'Un geste de prévention : sur une maladie déjà installée, il ne suffit pas.', 1, 20, 120, '{"genera":["Rosa","Solanum","Vitis"],"months":[4,5,6,7],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_7f12cddd4905b2f21612', 'lait-oidium', 'Un verre de lait contre le blanc', 'Par temps chaud, un voile blanc menace tes feuilles. La parade est dans ton frigo.', 'Des essais sur courgettes et vigne ont montré qu’un lait dilué freine l’oïdium, ce feutrage blanc des feuilles. Le soleil y aiderait : il active les protéines du lait.', 'Mélange 1 volume de lait (demi-écrémé convient) pour 9 volumes d’eau.
Pulvérise les deux faces des feuilles, un matin ensoleillé.
Recommence une fois par semaine tant qu’il fait chaud.', ARRAY['lait', 'eau', 'un pulvérisateur']::TEXT[], 'PLAUSIBLE', 'Essaie d’abord sur une feuille. Si une odeur aigre apparaît, rince à l’eau claire.', 0, 10, 120, '{"families":["Cucurbitaceae"],"months":[6,7,8,9],"locations":["OUTDOOR","BALCONY","GREENHOUSE"],"weather":{"tempMaxAbove":22}}'::jsonb, 'PUBLISHED'),
  ('tip_683581215de5f58fd6d6', 'bicarbonate', 'Le placard de la cuisine contre l’oïdium', 'Une pincée d’un produit que tu as sûrement sous l’évier…', 'Le bicarbonate rend la surface des feuilles moins accueillante pour les champignons. Il agit en prévention et au tout début d’une attaque.', 'Dissous 5 g de bicarbonate de soude (une cuillère à café rase) dans 1 litre d’eau.
Ajoute une goutte de savon noir pour que le mélange accroche.
Pulvérise le feuillage en fin de journée.', ARRAY['bicarbonate de soude', 'savon noir', 'eau']::TEXT[], 'PLAUSIBLE', 'Pas plus d’une fois tous les dix jours : le sodium s’accumule dans le sol.', 0, 5, 120, '{"genera":["Rosa","Vitis"],"months":[5,6,7,8,9],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_7d65a3b6564a733a77b2', 'savon-noir', 'Le shampooing anti-pucerons', 'Les pucerons détestent un produit que ta grand-mère utilisait pour les sols.', 'Le savon noir colle et asphyxie les pucerons, sans rester dans la plante. C’est l’un des rares remèdes maison dont l’efficacité est bien établie.', 'Dilue 15 à 30 g de savon noir liquide (une à deux cuillères à soupe) dans 1 litre d’eau tiède.
Pulvérise surtout le dessous des feuilles et les jeunes pousses.
Recommence trois jours plus tard si des pucerons restent.', ARRAY['savon noir liquide', 'eau tiède', 'un pulvérisateur']::TEXT[], 'PROVEN', 'Jamais en plein soleil. Prends du vrai savon noir, sans additif. Rince à l’eau claire les feuilles fragiles le lendemain.', 0, 10, 120, '{"categories":["VEGETABLE","FLOWERS","TREES_SHRUBS","CLIMBING"],"months":[4,5,6,7]}'::jsonb, 'PUBLISHED'),
  ('tip_6c99cb85f79f81e22679', 'ail-decoction', 'Une gousse d’ail pour les pucerons', 'L’odeur qui chasse les vampires chasse aussi quelques petites bêtes.', 'L’ail contient des composés soufrés à l’odeur forte, qui dérangeraient pucerons et acariens. Un répulsif doux, à renouveler.', 'Écrase 5 gousses d’ail dans 1 litre d’eau.
Porte à ébullition, puis laisse infuser à couvert jusqu’à refroidissement.
Filtre et pulvérise sur les pousses attaquées.', ARRAY['5 gousses d’ail', 'eau']::TEXT[], 'PLAUSIBLE', 'L’effet ne dure que quelques jours : recommence après une pluie.', 0, 15, 120, '{"genera":["Rosa"],"months":[4,5,6],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_9cbaa98ea8876249505d', 'ail-rosier', 'Le secret des vieux rosiéristes', 'Les anciens plantaient quelque chose au pied de leurs rosiers. Devine quoi.', 'Quelques gousses d’ail plantées au pied du rosier : la tradition dit qu’elles l’éloignent des maladies et des pucerons. Rien ne l’a démontré, mais l’ail y pousse bien — et tu récolteras des tiges vertes au printemps.', 'Choisis 4 ou 5 gousses d’ail bien fermes.
Plante-les pointe en haut, à 3 cm de profondeur, à 20 cm du pied du rosier.
Laisse-les pousser : coupe les tiges au printemps pour la cuisine.', ARRAY['gousses d’ail']::TEXT[], 'FOLK', 'Un effet contre les maladies n’a jamais été démontré : c’est une tradition, et une récolte en prime.', 0, 10, 120, '{"genera":["Rosa"],"months":[10,11,2,3],"locations":["OUTDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_72f490ee603aa0db59db', 'piege-biere', 'L’apéro des limaces', 'Les limaces ont un faible. Sers-leur à boire, elles ne reviendront pas.', 'Attirées par l’odeur de la fermentation, les limaces se noient dans la bière. Le piège est efficace, à condition de le relever souvent.', 'Enterre un gobelet près des plantes attaquées, le rebord à 1 cm au-dessus du sol.
Remplis-le à moitié de bière, même bon marché.
Vide et remplis de nouveau tous les deux ou trois jours.', ARRAY['un gobelet', 'de la bière']::TEXT[], 'PROVEN', 'Le rebord au-dessus du sol épargne les carabes, ces coléoptères qui mangent les limaces : ce sont tes alliés.', 0, 5, 120, '{"categories":["VEGETABLE","HERBS"],"months":[3,4,5,6,9,10],"locations":["OUTDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_6267379d1132be493a3e', 'marc-cafe', 'Le marc de café, mais bien dosé', 'Ton café du matin peut nourrir la terre. À une condition.', 'Le marc apporte un peu d’azote et de matière organique, et les vers de terre l’adorent. Mais en couche épaisse il se tasse, moisit, et freine la germination.', 'Fais sécher le marc sur une assiette quelques jours.
Mélange-le au compost, ou griffe une fine couche dans la terre au pied de la plante.
Une poignée par mois suffit.', ARRAY['marc de café séché']::TEXT[], 'PLAUSIBLE', 'Jamais sur des semis, ni en couche épaisse posée sur le sol.', 0, 5, 120, '{"categories":["VEGETABLE","FLOWERS","TREES_SHRUBS"],"months":[3,4,5,6,7,8,9,10,11],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_09f1b4bd015408ede2e9', 'marc-hortensia', 'Le marc de café rend-il la terre acide ?', 'Une idée répandue chez les amoureux d’hortensias. Elle ne tient pas.', 'Le café en grain est acide, mais l’acidité part dans ta tasse : le marc usé est presque neutre. Il ne changera pas le sol d’une plante de terre de bruyère.', 'Pour une plante qui aime l’acidité, arrose à l’eau de pluie plutôt qu’à l’eau du robinet, souvent calcaire.
Au printemps, ajoute de la terre de bruyère ou un paillis d’aiguilles de pin au pied.
Le marc peut aller au compost : il y sera utile, mais pour d’autres raisons.', ARRAY['eau de pluie', 'terre de bruyère']::TEXT[], 'MYTH', NULL, 0, 10, 120, '{"genera":["Hydrangea","Rhododendron","Camellia","Pieris","Skimmia","Vaccinium","Erica","Calluna","Gardenia","Azalea"],"months":[3,4,5,6,7,8,9,10]}'::jsonb, 'PUBLISHED'),
  ('tip_9ed8ca92b469bb741390', 'clous-hortensia', 'Des clous rouillés pour des hortensias bleus ?', 'On enterre des clous au pied des hortensias pour les bleuir. Vrai ou faux ?', 'Faux : ce n’est pas le fer qui bleuit l’hortensia, c’est l’aluminium, que la plante n’absorbe que dans un sol acide. Les clous ne font que rouiller.', 'Pour garder un hortensia bleu, maintiens un sol acide : eau de pluie, terre de bruyère au printemps.
Un engrais « hortensias bleus » apporte l’aluminium qui manque.
Sur un sol calcaire, il restera rose — et c’est très bien aussi.', ARRAY['eau de pluie', 'terre de bruyère']::TEXT[], 'MYTH', NULL, 0, 5, 120, '{"genera":["Hydrangea"],"months":[3,4,5,6,7,8,9]}'::jsonb, 'PUBLISHED'),
  ('tip_c617b535b5ea5adffda7', 'cendres', 'La potasse des cendres de cheminée', 'Ta cheminée produit un engrais. Ne le jette pas — mais ne le mets pas partout.', 'Les cendres de bois sont riches en potasse et en calcaire. Les potagers d’autrefois les recevaient chaque hiver, en fine couche.', 'Attends que les cendres soient parfaitement froides, plusieurs jours.
Tamise-les pour retirer les morceaux de charbon.
Répands une fine couche — une poignée par mètre carré — sur la terre, une fois par an.', ARRAY['cendres de bois froides']::TEXT[], 'PROVEN', 'Jamais sur les plantes de terre de bruyère ni sur un sol déjà calcaire. Seulement du bois non traité : ni charbon de barbecue, ni bois peint ou aggloméré.', 0, 10, 300, '{"categories":["VEGETABLE","TREES_SHRUBS","FLOWERS"],"excludeFamilies":["Ericaceae"],"excludeGenera":["Hydrangea","Rhododendron","Camellia","Pieris","Skimmia","Vaccinium","Erica","Calluna","Gardenia","Azalea"],"months":[11,12,1,2],"locations":["OUTDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_6d133308f4a9d580f5b4', 'eau-cuisson', 'L’eau des légumes, deuxième service', 'L’eau dans laquelle tu as cuit tes légumes peut servir deux fois.', 'Une partie des minéraux des légumes passe dans l’eau de cuisson. Refroidie, elle remplace un arrosage — un petit geste circulaire, plus qu’un engrais.', 'Garde l’eau de cuisson des légumes ou des œufs, sans sel ni matière grasse.
Laisse-la refroidir complètement.
Arrose comme d’habitude, à la place de l’eau du robinet.', ARRAY['eau de cuisson non salée']::TEXT[], 'FOLK', 'Jamais salée ni grasse : le sel brûle les racines, surtout en pot.', 0, 2, 120, '{"locations":["INDOOR","BALCONY"]}'::jsonb, 'PUBLISHED'),
  ('tip_2f9b4209cfcc331b0ddb', 'eau-riz', 'L’eau de rinçage du riz', 'Avant de cuire ton riz, garde son premier rinçage.', 'Une tradition venue d’Asie : l’eau trouble du rinçage contient un peu d’amidon et de minéraux. Certains jurent qu’elle fait briller les feuilles.', 'Rince ton riz une fois, et garde cette première eau.
Arrose ta plante avec, à la place d’un arrosage ordinaire.
Une fois par mois suffit.', ARRAY['eau de rinçage du riz']::TEXT[], 'FOLK', 'L’amidon peut faire moisir une terre qui reste humide : seulement sur un terreau qui sèche bien entre deux arrosages.', 0, 2, 120, '{"locations":["INDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_5f61d7f3dca095fbc273', 'saule-bouture', 'L’hormone cachée dans le saule', 'Un arbre au bord de l’eau sait faire pousser des racines à tes boutures.', 'Les rameaux de saule contiennent des substances qui favorisent l’enracinement. Leur eau de trempage sert d’hormone de bouturage naturelle.', 'Coupe une poignée de jeunes rameaux de saule, en morceaux de 5 cm.
Fais-les tremper 24 heures dans un verre d’eau.
Le lendemain, prélève tes boutures et laisse leur pied tremper quelques heures dans cette eau.
Plante-les dans un mélange de terreau et de sable, à l’ombre légère.', ARRAY['rameaux de saule', 'eau', 'terreau', 'sable']::TEXT[], 'PLAUSIBLE', NULL, 1, 20, 120, '{"genera":["Rosa","Lavandula","Salvia","Rosmarinus","Hydrangea","Forsythia","Buddleja","Ficus"],"months":[3,4,9,10]}'::jsonb, 'PUBLISHED'),
  ('tip_24567415ec5a70f90b8d', 'cannelle-semis', 'La cannelle contre la fonte des semis', 'Ton placard à épices protège tes semis d’un champignon redoutable.', 'La « fonte des semis » couche les jeunes plants d’un coup, à cause d’un champignon. La cannelle a un effet antifongique léger qui en freinerait l’apparition.', 'Après le semis, saupoudre une très fine pellicule de cannelle en poudre sur le terreau.
Arrose par le dessous, en remplissant la soucoupe.
Aère la mini-serre chaque jour.', ARRAY['cannelle en poudre']::TEXT[], 'PLAUSIBLE', 'La meilleure protection reste un terreau propre, un arrosage modéré et de l’air.', 0, 2, 120, '{"categories":["VEGETABLE","HERBS"],"months":[2,3,4]}'::jsonb, 'PUBLISHED'),
  ('tip_aed7b535a5caa2ea99fe', 'capucines', 'La plante sacrifiée', 'Il existe une fleur que les pucerons préfèrent à tes légumes.', 'Les capucines attirent les pucerons noirs, qui s’y installent plutôt que sur les fèves ou les choux voisins. Une plante « piège », jolie en prime — et ses fleurs se mangent.', 'Sème 3 ou 4 graines de capucine en bordure du potager, à 2 cm de profondeur.
Arrose légèrement jusqu’à la levée.
Surveille-les : quand les pucerons s’y regroupent, coupe et jette les tiges les plus envahies.', ARRAY['graines de capucine']::TEXT[], 'PLAUSIBLE', 'Sans surveillance, la plante piège devient un foyer qui essaime.', 0, 10, 120, '{"categories":["VEGETABLE"],"months":[4,5],"locations":["OUTDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_96d60b287f1913ad9b87', 'oeillets-inde', 'Les gardes du corps des tomates', 'Une fleur orange monte la garde au pied des tomates depuis des générations.', 'Les racines des œillets d’Inde libèrent des substances qui gênent certains vers microscopiques du sol, les nématodes. Leur odeur forte dérouterait aussi quelques insectes.', 'Plante un œillet d’Inde tous les deux ou trois pieds de tomate.
Arrose-les en même temps que les tomates.
Laisse-les en place toute la saison.', ARRAY['plants d’œillets d’Inde']::TEXT[], 'PLAUSIBLE', NULL, 0, 15, 120, '{"genera":["Solanum"],"months":[4,5,6],"locations":["OUTDOOR","BALCONY","GREENHOUSE"]}'::jsonb, 'PUBLISHED'),
  ('tip_9900ce7404dbd921a024', 'bouteille-oya', 'Le goutte-à-goutte en bouteille', 'Tu pars quelques jours ? Une bouteille vide peut arroser à ta place.', 'Le principe des oyas, ces jarres en terre enterrées des jardins d’autrefois : l’eau rejoint les racines lentement, sans s’évaporer en surface.', 'Perce 3 ou 4 petits trous dans le bouchon d’une bouteille en plastique.
Coupe le fond, enterre la bouteille goulot en bas, près des racines.
Remplis par le haut : elle se vide en un à trois jours.', ARRAY['une bouteille en plastique', 'un clou pour percer']::TEXT[], 'PROVEN', 'Essaie avant de partir pour régler le débit : trop de trous, et la bouteille se vide en une heure.', 0, 10, 120, '{"months":[6,7,8],"locations":["OUTDOOR","BALCONY"]}'::jsonb, 'PUBLISHED'),
  ('tip_63b6f729aa8e074d2ae1', 'feuilles-mortes', 'L’or brun de novembre', 'Ce que tes voisins mettent en sac, les jardiniers malins le gardent précieusement.', 'En forêt, personne ne ramasse les feuilles : elles protègent le sol du froid et deviennent humus. Au jardin, c’est un paillis gratuit — et dans un an, un terreau de feuilles très recherché.', 'Ramasse les feuilles mortes saines.
Étale-les en couche de 5 à 10 cm au pied des massifs et des arbustes.
Le surplus va en tas ou dans un sac percé : dans un an, tu auras du terreau.', ARRAY['feuilles mortes']::TEXT[], 'PROVEN', 'Écarte les feuilles malades, comme celles des rosiers tachés de noir : la maladie y passe l’hiver.', 0, 30, 300, '{"categories":["TREES_SHRUBS","FLOWERS","VEGETABLE"],"months":[10,11,12],"locations":["OUTDOOR"]}'::jsonb, 'PUBLISHED'),
  ('tip_5c7f259c35a05f390747', 'lune', 'Jour racine, jour feuille…', 'Selon la tradition, la Lune décide du meilleur jour pour chaque geste.', 'Les calendriers lunaires classent chaque jour selon la constellation devant laquelle passe la Lune : racine, feuille, fleur ou fruit. Aucune étude n’a montré d’effet sur les cultures. Beaucoup de jardiniers les suivent quand même — pour le rythme, et le plaisir.', 'Regarde le bandeau lunaire de ton planning : il te dit le type du jour.
Jour racine : carottes, radis, poireaux. Jour feuille : salades, épinards. Jour fleur : fleurs et bulbes. Jour fruit : tomates, haricots, fraisiers.
Sème ou repique ce qui correspond, et note ce que tu observes.', ARRAY[]::TEXT[], 'FOLK', 'Aucune preuve scientifique : 100 % tradition, 100 % plaisir.', 0, 5, 120, '{"categories":["VEGETABLE","HERBS"],"months":[2,3,4,5,6,7,8,9,10],"lunarOnly":true}'::jsonb, 'PUBLISHED')
ON CONFLICT ("slug") DO NOTHING;
