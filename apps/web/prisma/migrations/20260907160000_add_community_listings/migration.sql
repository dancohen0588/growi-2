-- Communauté — bourse aux graines (phase 3) : Listing, ListingThread,
-- ListingMessage.
--
-- Écrit par `prisma migrate diff` (voir CLAUDE.md), puis complété à la main de
-- l'index géographique, que Prisma ne sait pas décrire : il porte sur une
-- expression, pas sur des colonnes.

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "catalogPlantId" TEXT,
    "quantity" TEXT,
    "wants" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "expiryNotifiedAt" TIMESTAMPTZ(6),
    "threadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_threads" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMPTZ(6),
    "ownerReadAt" TIMESTAMPTZ(6),
    "requesterReadAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_status_category_createdAt_idx" ON "listings"("status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "listings_userId_createdAt_idx" ON "listings"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "listings_status_expiresAt_idx" ON "listings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "listing_threads_ownerId_lastMessageAt_idx" ON "listing_threads"("ownerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "listing_threads_requesterId_lastMessageAt_idx" ON "listing_threads"("requesterId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_threads_listingId_requesterId_key" ON "listing_threads"("listingId", "requesterId");

-- CreateIndex
CREATE INDEX "listing_messages_threadId_createdAt_idx" ON "listing_messages"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_catalogPlantId_fkey" FOREIGN KEY ("catalogPlantId") REFERENCES "plant_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_threads" ADD CONSTRAINT "listing_threads_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_threads" ADD CONSTRAINT "listing_threads_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_messages" ADD CONSTRAINT "listing_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "listing_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_messages" ADD CONSTRAINT "listing_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Index géographique de la bourse, jumeau de `posts_earth_idx`.
--
-- Les extensions `cube` et `earthdistance` ont été posées par la migration du
-- socle ; sans cet index, chaque page de la bourse ferait un parcours complet.
CREATE INDEX IF NOT EXISTS "listings_earth_idx" ON "listings" USING gist (ll_to_earth("lat", "lng"));
