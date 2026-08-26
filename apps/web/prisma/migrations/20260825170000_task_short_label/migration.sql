-- Titre court des tâches du planning, `label` en devenant le détail.
--
-- `migrate diff` proposait d'ajouter la colonne en NOT NULL sans défaut, ce
-- qui échoue dès qu'il existe des lignes — et il y en a déjà. On l'ajoute donc
-- en trois temps, en abrégeant le libellé existant pour les tâches déjà
-- planifiées plutôt que de les vider ou de les perdre.

-- 1. Colonne nullable
ALTER TABLE "plant_tasks" ADD COLUMN "shortLabel" TEXT;

-- 2. Reprise de l'existant : la première proposition du libellé, coupée sur un
--    mot et sans ponctuation finale. Le détail complet reste dans `label`.
UPDATE "plant_tasks"
SET "shortLabel" =
  CASE
    WHEN length("label") <= 40 THEN rtrim("label", '. ')
    ELSE rtrim(
      substring("label" from 1 for 40 - strpos(reverse(substring("label" from 1 for 40)), ' ')),
      ',. '
    ) || '…'
  END
WHERE "shortLabel" IS NULL;

-- 3. Contrainte finale, une fois toutes les lignes renseignées
ALTER TABLE "plant_tasks" ALTER COLUMN "shortLabel" SET NOT NULL;
