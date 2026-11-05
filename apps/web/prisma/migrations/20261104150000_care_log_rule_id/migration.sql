-- Règle du moteur à l'origine d'un geste noté depuis le planning.
-- Colonne nullable, sans défaut : aucune ligne existante n'est réécrite.
ALTER TABLE "care_logs" ADD COLUMN "ruleId" TEXT;
