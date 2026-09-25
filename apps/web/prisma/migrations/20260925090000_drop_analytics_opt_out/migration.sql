-- Suppression de l'ancien opt-out, remplacé par "analyticsConsent"
-- (migration 20260924090000_analytics_consent). Appliquée après le
-- déploiement du code qui ne la lit plus.

-- Dernière reprise des refus exprimés entre les deux migrations, quand la
-- version précédente écrivait encore cette colonne. Un refus est un choix : on
-- ne le perd pas. Sans effet sur une réponse déjà donnée depuis.
UPDATE "users"
SET "analyticsConsent" = false, "analyticsConsentAt" = now()
WHERE "analyticsOptOut" = true AND "analyticsConsent" IS NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "analyticsOptOut";
