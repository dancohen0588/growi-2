-- ============================================================
-- Growi — Seed catalogue de plantes pour Supabase
-- Coller et exécuter dans : Supabase > SQL Editor
-- ============================================================

INSERT INTO "plant_catalog" ("id","commonName","scientificName","family","emoji","category","descriptionShort","sunExposure","wateringFreqDays","wateringDifficulty","minTempCelsius","indoor","outdoor","edible","toxic","tags","updatedAt")
VALUES
  (gen_random_uuid(),'Monstera','Monstera deliciosa','Aracées','🌿','INDOOR','La plante tropicale aux grandes feuilles perforées, idéale pour les intérieurs lumineux.','PARTIAL',10,'EASY',15,true,false,false,true,'["tropical","tendance","grande feuille"]',now()),
  (gen_random_uuid(),'Ficus','Ficus benjamina','Moracées','🌳','INDOOR','Arbre d''intérieur classique, sensible aux déplacements.','PARTIAL',7,'MEDIUM',15,true,false,false,true,'["arbre intérieur","classique"]',now()),
  (gen_random_uuid(),'Pothos','Epipremnum aureum','Aracées','🌿','INDOOR','Plante retombante ultra-résistante, parfaite pour les débutants.','SHADE',14,'EASY',12,true,false,false,true,'["débutant","retombante","facile"]',now()),
  (gen_random_uuid(),'Cactus boule','Echinopsis','Cactacées','🌵','SUCCULENTS','Cactus sphérique très résistant, arrosage rare.','FULL_SUN',21,'EASY',5,true,true,false,false,'["cactée","succulente","xérophyte"]',now()),
  (gen_random_uuid(),'Orchidée Phalaenopsis','Phalaenopsis','Orchidacées','🌸','INDOOR','Orchidée de maison aux longues tiges fleuries, floraison majestueuse.','PARTIAL',10,'MEDIUM',16,true,false,false,false,'["fleur","élégante","longue floraison"]',now()),
  (gen_random_uuid(),'Tomate','Solanum lycopersicum','Solanacées','🍅','VEGETABLE','Le légume star du potager, nombreuses variétés disponibles.','FULL_SUN',2,'MEDIUM',15,false,true,true,false,'["légume","été","potager"]',now()),
  (gen_random_uuid(),'Courgette','Cucurbita pepo','Cucurbitacées','🥒','VEGETABLE','Légume prolixe et facile, idéal pour les débutants au potager.','FULL_SUN',3,'EASY',15,false,true,true,false,'["légume","facile","été","productif"]',now()),
  (gen_random_uuid(),'Laitue','Lactuca sativa','Astéracées','🥬','VEGETABLE','Salade rapide à pousser, idéale pour une première récolte.','PARTIAL',2,'EASY',5,false,true,true,false,'["salade","printemps","automne","rapide"]',now()),
  (gen_random_uuid(),'Carotte','Daucus carota','Apiacées','🥕','VEGETABLE','Légume racine classique, sol meuble et profond requis.','FULL_SUN',4,'MEDIUM',7,false,true,true,false,'["légume","racine","printemps"]',now()),
  (gen_random_uuid(),'Poivron','Capsicum annuum','Solanacées','🌶️','VEGETABLE','Légume du soleil, chaleur et arrosage régulier.','FULL_SUN',2,'MEDIUM',18,false,true,true,false,'["légume","été","chaleur"]',now()),
  (gen_random_uuid(),'Basilic','Ocimum basilicum','Lamiacées','🌿','HERBS','L''aromate incontournable, fragile au froid et à l''excès d''eau.','FULL_SUN',2,'MEDIUM',15,true,true,true,false,'["aromatique","cuisine","été"]',now()),
  (gen_random_uuid(),'Menthe','Mentha','Lamiacées','🌿','HERBS','Aromatique envahissante à planter en pot. Robuste et parfumée.','PARTIAL',3,'EASY',-10,true,true,true,false,'["aromatique","pot","robuste"]',now()),
  (gen_random_uuid(),'Romarin','Salvia rosmarinus','Lamiacées','🌿','HERBS','Aromatique méditerranéen très résistant à la sécheresse.','FULL_SUN',14,'EASY',-10,false,true,true,false,'["aromatique","méditerranéen","sec"]',now()),
  (gen_random_uuid(),'Rosier','Rosa','Rosacées','🌹','FLOWERS','La reine des jardins, nombreuses variétés, floraison estivale.','FULL_SUN',5,'MEDIUM',-15,false,true,false,false,'["fleur","classique","parfumé"]',now()),
  (gen_random_uuid(),'Lavande','Lavandula angustifolia','Lamiacées','💜','FLOWERS','Incontournable du jardin méditerranéen, floraison violette parfumée.','FULL_SUN',14,'EASY',-20,false,true,true,false,'["fleur","méditerranéen","parfumé","mellifère"]',now()),
  (gen_random_uuid(),'Géranium','Pelargonium','Géraniacées','🌸','FLOWERS','Fleur de balcon par excellence, colorée et résistante à la chaleur.','FULL_SUN',3,'EASY',5,false,true,false,false,'["balcon","été","coloré"]',now()),
  (gen_random_uuid(),'Pommier','Malus domestica','Rosacées','🍎','TREES_SHRUBS','Arbre fruitier classique, nombreuses variétés selon la région.','FULL_SUN',7,'MEDIUM',-25,false,true,true,false,'["fruitier","arbres","automne"]',now()),
  (gen_random_uuid(),'Hortensia','Hydrangea macrophylla','Hydrangéacées','💐','FLOWERS','Grand arbuste à fleurs en boules, besoin en eau élevé.','PARTIAL',3,'MEDIUM',-15,false,true,false,false,'["arbuste","ombre","fleur","estival"]',now()),
  (gen_random_uuid(),'Glycine','Wisteria sinensis','Fabacées','🌸','CLIMBING','Grimpante majestueuse aux grappes fleuries au printemps.','FULL_SUN',7,'MEDIUM',-20,false,true,false,true,'["grimpante","printemps","parfumé","pergola"]',now()),
  (gen_random_uuid(),'Lierre','Hedera helix','Araliacées','🍃','CLIMBING','Grimpante persistante ultra-robuste, couvre-sol ou murale.','SHADE',14,'EASY',-25,true,true,false,true,'["grimpante","persistante","couvre-sol"]',now())
ON CONFLICT ("scientificName") DO NOTHING;
