-- Unification des quatre journaux d'entretien en une seule table `care_logs`.
--
-- Ordre volontaire : la nouvelle table est créée et alimentée AVANT que les
-- anciennes ne soient supprimées. Le SQL généré par Prisma faisait l'inverse,
-- ce qui aurait détruit l'historique existant.

-- CreateTable
CREATE TABLE "care_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "productUsed" TEXT,
    "status" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_logs_plantInstanceId_occurredAt_idx" ON "care_logs"("plantInstanceId", "occurredAt");

-- CreateIndex
CREATE INDEX "care_logs_type_idx" ON "care_logs"("type");

-- AddForeignKey
ALTER TABLE "care_logs" ADD CONSTRAINT "care_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise de l'historique. Les identifiants d'origine sont conservés, ce qui
-- rend la reprise rejouable et permet de retrouver une ligne d'avant migration.
INSERT INTO "care_logs" ("id", "plantInstanceId", "type", "occurredAt", "note")
SELECT "id", "plantInstanceId", 'watering', "wateredAt", "note" FROM "watering_logs";

-- `pruningType` décrivait la nature de la taille : il rejoint la note, seul
-- champ libre de la nouvelle table (aucune ligne n'en portait, en pratique).
INSERT INTO "care_logs" ("id", "plantInstanceId", "type", "occurredAt", "note")
SELECT "id", "plantInstanceId", 'pruning', "prunedAt",
       NULLIF(TRIM(CONCAT_WS(' — ', "pruningType", "note")), '')
FROM "pruning_logs";

INSERT INTO "care_logs" ("id", "plantInstanceId", "type", "occurredAt", "note", "productUsed")
SELECT "id", "plantInstanceId", 'fertilizing', "fertilizedAt", "note", "productUsed"
FROM "fertilizing_logs";

INSERT INTO "care_logs" ("id", "plantInstanceId", "type", "occurredAt", "note", "status", "photoUrl")
SELECT "id", "plantInstanceId", 'health', "loggedAt", "note", "status", "photoUrl"
FROM "health_logs";

-- Les anciennes tables ne sont supprimées qu'une fois la reprise faite.
ALTER TABLE "fertilizing_logs" DROP CONSTRAINT "fertilizing_logs_plantInstanceId_fkey";
ALTER TABLE "health_logs" DROP CONSTRAINT "health_logs_plantInstanceId_fkey";
ALTER TABLE "pruning_logs" DROP CONSTRAINT "pruning_logs_plantInstanceId_fkey";
ALTER TABLE "watering_logs" DROP CONSTRAINT "watering_logs_plantInstanceId_fkey";

DROP TABLE "fertilizing_logs";
DROP TABLE "health_logs";
DROP TABLE "pruning_logs";
DROP TABLE "watering_logs";
