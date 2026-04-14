-- ============================================================
-- Growi — schéma PostgreSQL pour Supabase
-- Généré depuis schema.prisma (conversion depuis SQLite)
-- Coller et exécuter dans : Supabase > SQL Editor
-- ============================================================

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT,
    "lastName" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "locationCity" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY ("id")
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
    PRIMARY KEY ("id"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,
    PRIMARY KEY ("id"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL
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
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT "gardens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "garden_zones" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorHex" TEXT,
    PRIMARY KEY ("id"),
    CONSTRAINT "garden_zones_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
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
    "datePlanted" TIMESTAMPTZ,
    "dateAdded" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wateringFreqDays" INTEGER,
    "lastWateredAt" TIMESTAMPTZ,
    "lastFertilizedAt" TIMESTAMPTZ,
    "soilType" TEXT,
    "sunExposure" TEXT,
    "healthStatus" TEXT NOT NULL DEFAULT 'HEALTHY',
    "healthNote" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT "plant_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "garden_zones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_catalogPlantId_fkey" FOREIGN KEY ("catalogPlantId") REFERENCES "plant_catalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watering_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "wateredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    PRIMARY KEY ("id"),
    CONSTRAINT "watering_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" TEXT NOT NULL,
    "plantInstanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "loggedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT "health_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");
CREATE UNIQUE INDEX "plant_catalog_scientificName_key" ON "plant_catalog"("scientificName");

-- Table interne Prisma (suivi des migrations)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("id")
);
