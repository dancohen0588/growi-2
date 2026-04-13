-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "locationCity" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "gardens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OUTDOOR',
    "surfaceM2" REAL,
    "climateZone" TEXT,
    "soilType" TEXT,
    "orientation" TEXT,
    "canvasData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gardens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "garden_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gardenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "colorHex" TEXT,
    CONSTRAINT "garden_zones_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plant_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gardenId" TEXT,
    "zoneId" TEXT,
    "catalogPlantId" TEXT,
    "customName" TEXT,
    "emoji" TEXT,
    "photoUrl" TEXT,
    "location" TEXT NOT NULL DEFAULT 'OUTDOOR',
    "positionX" REAL,
    "positionY" REAL,
    "datePlanted" DATETIME,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wateringFreqDays" INTEGER,
    "lastWateredAt" DATETIME,
    "lastFertilizedAt" DATETIME,
    "soilType" TEXT,
    "sunExposure" TEXT,
    "healthStatus" TEXT NOT NULL DEFAULT 'HEALTHY',
    "healthNote" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "plant_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "gardens" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "garden_zones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "plant_instances_catalogPlantId_fkey" FOREIGN KEY ("catalogPlantId") REFERENCES "plant_catalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "plant_catalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "minTempCelsius" REAL,
    "maxTempCelsius" REAL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "watering_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantInstanceId" TEXT NOT NULL,
    "wateredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "watering_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantInstanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_logs_plantInstanceId_fkey" FOREIGN KEY ("plantInstanceId") REFERENCES "plant_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "plant_catalog_scientificName_key" ON "plant_catalog"("scientificName");
