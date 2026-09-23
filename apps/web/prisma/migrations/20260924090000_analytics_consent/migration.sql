-- Consentement à la mesure d'usage (opt-in) et trace d'acceptation des CGU.
-- Spec : Documentation/spec/13-spec-rgpd-consentement.md §2.1.
--
-- La colonne "analyticsOptOut" n'est PAS supprimée ici : la version en ligne la
-- lit encore, et cette migration s'applique avant son remplacement. Elle tombe
-- dans une migration séparée, une fois le nouveau code déployé.

-- AlterTable
ALTER TABLE "users"
ADD COLUMN     "analyticsConsent" BOOLEAN,
ADD COLUMN     "analyticsConsentAt" TIMESTAMPTZ(6),
ADD COLUMN     "termsAcceptedAt" TIMESTAMPTZ(6),
ADD COLUMN     "termsVersion" TEXT;

-- Un refus est un choix exprimé : on le garde. Les autres comptes n'ont jamais
-- consenti — ils restent à NULL et verront la question.
UPDATE "users"
SET "analyticsConsent" = false, "analyticsConsentAt" = now()
WHERE "analyticsOptOut" = true;

-- Le journal d'audit survit à la suppression du compte de son auteur : la
-- ligne reste, sans le nom. En cascade, supprimer un compte administrateur
-- effaçait ses traces.
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "admin_audit_logs_actorId_fkey";
ALTER TABLE "admin_audit_logs" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
