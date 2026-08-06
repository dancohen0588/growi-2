-- Migration: add_recommendation_engine_fields
-- À exécuter dans l'éditeur SQL de Supabase

-- ============================================================
-- 1. PlantCatalog : nouveaux champs
-- ============================================================

-- Calendrier cultural
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "pruningMonths" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "pruningType" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "sowingMonthsIndoor" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "sowingMonthsOutdoor" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "transplantMonths" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "harvestMonthsStart" INTEGER;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "harvestMonthsEnd" INTEGER;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "harvestDaysFromSowing" INTEGER;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "dormancyMonths" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "floweringMonths" TEXT;

-- Agro-climatologie
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "frostSensitivity" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "heatStressThresholdC" DOUBLE PRECISION;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "wateringAdjHeat" DOUBLE PRECISION;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "wateringAdjRain" DOUBLE PRECISION;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "sunHoursNeeded" DOUBLE PRECISION;

-- Entretien spécialisé
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "repottingFreqMonths" INTEGER;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "repottingSeasons" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "fertilizationType" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "treatmentSeasons" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "mulchRecommended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "winterProtectionType" TEXT;

-- Care tips éditoriaux
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipWatering" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipLight" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipSoil" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipPruning" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipDiseases" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "careTipWinter" TEXT;
ALTER TABLE "plant_catalog" ADD COLUMN IF NOT EXISTS "funFact" TEXT;

-- ============================================================
-- 2. PlantInstance : nouveaux champs
-- ============================================================

-- Contexte pot/substrat
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "containerSizeLiters" DOUBLE PRECISION;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "containerMaterial" TEXT;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "substrateType" TEXT;

-- Historique interventions
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "lastPrunedAt" TIMESTAMP(3);
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "lastRepottedAt" TIMESTAMP(3);
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "lastTreatedAt" TIMESTAMP(3);

-- Données culturales
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "seedBatchRef" TEXT;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "growthStage" TEXT;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "isMultiYear" BOOLEAN;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "expectedHarvestDate" TIMESTAMP(3);
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "customWateringAdjFactor" DOUBLE PRECISION;
ALTER TABLE "plant_instances" ADD COLUMN IF NOT EXISTS "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 3. Nouvelles tables
-- ============================================================

CREATE TABLE IF NOT EXISTS "pruning_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "prunedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pruningType" TEXT,
    "note" TEXT,

    CONSTRAINT "pruning_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fertilizing_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "fertilizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productUsed" TEXT,
    "note" TEXT,

    CONSTRAINT "fertilizing_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "garden_advice_cache" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "garden_advice_cache_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. Index & Foreign Keys
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "garden_advice_cache_gardenId_key" ON "garden_advice_cache"("gardenId");

ALTER TABLE "pruning_logs"
    ADD CONSTRAINT "pruning_logs_plantInstanceId_fkey"
    FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fertilizing_logs"
    ADD CONSTRAINT "fertilizing_logs_plantInstanceId_fkey"
    FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
