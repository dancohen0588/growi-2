
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMPTZ(6),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT,
    "lastName" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "locationCity" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "gardenType" TEXT,
    "avatarColor" TEXT,
    "alertConfig" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gardens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OUTDOOR',
    "surfaceM2" DOUBLE PRECISION,
    "climateZone" TEXT,
    "soilType" TEXT,
    "orientation" TEXT,
    "canvasData" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gardens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garden_zones" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorHex" TEXT,

    CONSTRAINT "garden_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_catalog" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "family" TEXT,
    "emoji" TEXT,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "descriptionShort" TEXT,
    "descriptionLong" TEXT,
    "sunExposure" TEXT NOT NULL,
    "wateringFreqDays" INTEGER NOT NULL,
    "wateringDifficulty" TEXT NOT NULL DEFAULT 'EASY',
    "minTempCelsius" DOUBLE PRECISION,
    "maxTempCelsius" DOUBLE PRECISION,
    "hardinesZone" TEXT,
    "soilTypes" TEXT,
    "fertilizerMonths" TEXT,
    "indoor" BOOLEAN NOT NULL DEFAULT false,
    "outdoor" BOOLEAN NOT NULL DEFAULT true,
    "edible" BOOLEAN NOT NULL DEFAULT false,
    "toxic" BOOLEAN NOT NULL DEFAULT false,
    "aliases" TEXT,
    "tags" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slug" TEXT,
    "pruningMonths" TEXT,
    "pruningType" TEXT,
    "sowingMonthsIndoor" TEXT,
    "sowingMonthsOutdoor" TEXT,
    "transplantMonths" TEXT,
    "harvestMonthsStart" INTEGER,
    "harvestMonthsEnd" INTEGER,
    "harvestDaysFromSowing" INTEGER,
    "dormancyMonths" TEXT,
    "floweringMonths" TEXT,
    "frostSensitivity" TEXT,
    "heatStressThresholdC" DOUBLE PRECISION,
    "wateringAdjHeat" DOUBLE PRECISION,
    "wateringAdjRain" DOUBLE PRECISION,
    "sunHoursNeeded" DOUBLE PRECISION,
    "repottingFreqMonths" INTEGER,
    "repottingSeasons" TEXT,
    "fertilizationType" TEXT,
    "treatmentSeasons" TEXT,
    "mulchRecommended" BOOLEAN NOT NULL DEFAULT false,
    "winterProtectionType" TEXT,
    "careTipWatering" TEXT,
    "careTipLight" TEXT,
    "careTipSoil" TEXT,
    "careTipPruning" TEXT,
    "careTipDiseases" TEXT,
    "careTipWinter" TEXT,
    "funFact" TEXT,
    "treeType" TEXT,

    CONSTRAINT "plant_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_instances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gardenId" TEXT,
    "zoneId" TEXT,
    "catalogPlantId" TEXT,
    "customName" TEXT,
    "emoji" TEXT,
    "photoUrl" TEXT,
    "location" TEXT NOT NULL DEFAULT 'OUTDOOR',
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "datePlanted" TIMESTAMPTZ(6),
    "dateAdded" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wateringFreqDays" INTEGER,
    "lastWateredAt" TIMESTAMPTZ(6),
    "lastFertilizedAt" TIMESTAMPTZ(6),
    "soilType" TEXT,
    "sunExposure" TEXT,
    "healthStatus" TEXT NOT NULL DEFAULT 'HEALTHY',
    "healthNote" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "containerSizeLiters" DOUBLE PRECISION,
    "containerMaterial" TEXT,
    "substrateType" TEXT,
    "lastPrunedAt" TIMESTAMP(3),
    "lastRepottedAt" TIMESTAMP(3),
    "lastTreatedAt" TIMESTAMP(3),
    "seedBatchRef" TEXT,
    "growthStage" TEXT,
    "isMultiYear" BOOLEAN,
    "expectedHarvestDate" TIMESTAMP(3),
    "customWateringAdjFactor" DOUBLE PRECISION,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plant_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watering_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "wateredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "watering_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "loggedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pruning_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "prunedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pruningType" TEXT,
    "note" TEXT,

    CONSTRAINT "pruning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fertilizing_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "fertilizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productUsed" TEXT,
    "note" TEXT,

    CONSTRAINT "fertilizing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garden_advice_cache" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "garden_advice_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "embedding" vector,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(6) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plant_catalog_scientificName_key" ON "plant_catalog"("scientificName");

-- CreateIndex
CREATE UNIQUE INDEX "plant_catalog_slug_key" ON "plant_catalog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "garden_advice_cache_gardenId_key" ON "garden_advice_cache"("gardenId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "documents_embedding_idx" ON "documents"("embedding");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garden_zones" ADD CONSTRAINT "garden_zones_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_instances" ADD CONSTRAINT "plant_instances_catalogPlantId_fkey" FOREIGN KEY ("catalogPlantId") REFERENCES "plant_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_instances" ADD CONSTRAINT "plant_instances_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_instances" ADD CONSTRAINT "plant_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_instances" ADD CONSTRAINT "plant_instances_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "garden_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watering_logs" ADD CONSTRAINT "watering_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_logs" ADD CONSTRAINT "health_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pruning_logs" ADD CONSTRAINT "pruning_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fertilizing_logs" ADD CONSTRAINT "fertilizing_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

