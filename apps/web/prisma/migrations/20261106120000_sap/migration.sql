-- La Sève (spec 17) : le journal des gains et les gouttes offertes entre voisins.
-- Uniquement des créations : rien n'est modifié ni supprimé dans les tables existantes.

-- CreateTable
CREATE TABLE "sap_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sap_gifts" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "postId" TEXT,
    "week" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sap_entries_userId_kind_day_idx" ON "sap_entries"("userId", "kind", "day");

-- CreateIndex
CREATE INDEX "sap_entries_userId_createdAt_idx" ON "sap_entries"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sap_entries_userId_kind_sourceId_key" ON "sap_entries"("userId", "kind", "sourceId");

-- CreateIndex
CREATE INDEX "sap_gifts_fromUserId_week_idx" ON "sap_gifts"("fromUserId", "week");

-- CreateIndex
CREATE INDEX "sap_gifts_toUserId_createdAt_idx" ON "sap_gifts"("toUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "sap_entries" ADD CONSTRAINT "sap_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sap_gifts" ADD CONSTRAINT "sap_gifts_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sap_gifts" ADD CONSTRAINT "sap_gifts_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

