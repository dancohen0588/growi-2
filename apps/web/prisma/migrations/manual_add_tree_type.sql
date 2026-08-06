-- Ajoute le sous-type d'arbre/arbuste sur le catalogue encyclopédique.
-- Valeurs : CONIFER | DECIDUOUS | FRUIT | SHRUB (NULL pour les non-arbres).
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "treeType" TEXT;

-- Reclassement : 15 plantes herbacées étaient à tort en TREES_SHRUBS → FLOWERS.
UPDATE "plant_catalog" SET "category" = 'FLOWERS', "emoji" = '🌿'
WHERE "scientificName" IN (
  'Agrimonia eupatoria','Geum urbanum','Aphanes arvensis','Fragaria vesca',
  'Lotus corniculatus','Poterium sanguisorba','Argentina anserina',
  'Potentilla erecta','Potentilla sterilis','Potentilla verna','Potentilla reptans',
  'Filipendula ulmaria','Sanguisorba officinalis','Trifolium repens','Trifolium pratense'
);

-- Classification des 44 arbres & arbustes restants.
UPDATE "plant_catalog" SET "treeType" = 'CONIFER' WHERE "scientificName" IN (
  'Picea abies','Larix decidua','Pinus sylvestris','Abies alba',
  'Juniperus oxycedrus','Juniperus communis'
);
UPDATE "plant_catalog" SET "treeType" = 'FRUIT' WHERE "scientificName" IN (
  'Malus domestica','Prunus avium','Castanea sativa'
);
UPDATE "plant_catalog" SET "treeType" = 'SHRUB' WHERE "scientificName" IN (
  'Amelanchier ovalis','Crataegus monogyna','Crataegus laevigata','Corylus avellana',
  'Cornus mas','Prunus spinosa','Rubus idaeus','Prunus laurocerasus','Rubus ulmifolius',
  'Rubus caesius','Rubus fruticosus','Rosa arvensis','Rosa canina','Ligustrum vulgare'
);
UPDATE "plant_catalog" SET "treeType" = 'DECIDUOUS'
WHERE "category" = 'TREES_SHRUBS' AND "treeType" IS NULL;
