-- La Sève, phase 6 (spec 17) : ce que débloquent les cernes, et le thème d'Accueil choisi.
-- Uniquement des ajouts : une colonne facultative et une table.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "homeTheme" TEXT;

-- CreateTable
CREATE TABLE "sap_rewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ring" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sap_rewards_userId_ring_key" ON "sap_rewards"("userId", "ring");

-- AddForeignKey
ALTER TABLE "sap_rewards" ADD CONSTRAINT "sap_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
